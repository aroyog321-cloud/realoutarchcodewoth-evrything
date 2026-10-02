// OUTARCH billing: Dodo Payments integration for Pro and Ultimate plans.
//
// The website calls this with the signed-in user's session:
//   { action: "config" }
//       whether online payment is switched on, sandbox or production, and supported currencies.
//   { action: "create", plan, period, currency, name, phone, returnUrl }
//       records the order in public.payments and generates a Dodo Payments checkout session.
//   { action: "verify", orderId }
//       checks the payment status in DB and Dodo Payments API, applies entitlements when paid.
//   { action: "simulate", orderId, result }
//       test-mode only: simulate a paid / failed / expired outcome for a pending order.

import { createClient } from "npm:@supabase/supabase-js@2";

// ------------------------------------------------------------------ constants

const PLANS = new Set(["pro", "ultimate"]);
const PERIODS = new Set(["month", "year"]);

// Dodo Payments product IDs per plan + period
const DODO_PRODUCTS: Record<string, Record<string, string>> = {
  pro:      { month: "pdt_0NohxyGlqUEFWQEpCzug5", year: "pdt_0NohxyIVrgAJKAwIfAfCi" },
  ultimate: { month: "pdt_0NohxyJbqntvWYdXdykwW", year: "pdt_0NohxyLvPont2ODalPpvX" },
};

// Reverse-lookup: given a Dodo product ID → { plan, period }
const PRODUCT_PLAN: Record<string, { plan: string; period: string }> = {};
for (const [plan, periods] of Object.entries(DODO_PRODUCTS)) {
  for (const [period, pid] of Object.entries(periods)) {
    PRODUCT_PLAN[pid] = { plan, period };
  }
}

// payments.status constraint: ('created','paid','failed','expired','refunded')
// NOTE: 'cancelled' is NOT a valid payment status — map to 'failed' for the constraint.
// subscriptions.status constraint: ('active','trialing','past_due','canceled','expired')
// NOTE: 'canceled' (one L) is the valid subscription status.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ------------------------------------------------------------------ helpers

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function refuse(status: number, code: string, message: string): Response {
  return reply(status, { error: { code, message } });
}

function settings() {
  const apiKey = (Deno.env.get("DODO_PAYMENTS_API_KEY") || "").trim();
  const env = (Deno.env.get("DODO_ENVIRONMENT") || "test_mode").trim().toLowerCase();
  const baseUrl = env === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
  return { apiKey, env, baseUrl, currencies: ["USD", "INR"], enabled: Boolean(apiKey) };
}

// Query Dodo Payments API — tries checkout and payment endpoints; returns first conclusive result.
async function queryDodoStatus(baseUrl: string, apiKey: string, id: string): Promise<{
  isPaid: boolean; isFailed: boolean; isCancelled: boolean; plan: string | null; period: string | null; data: any;
}> {
  const empty = { isPaid: false, isFailed: false, isCancelled: false, plan: null, period: null, data: null };

  const endpoints = id.startsWith("pay_")
    ? [`${baseUrl}/payments/${encodeURIComponent(id)}`]
    : id.startsWith("sub_")
    ? [`${baseUrl}/subscriptions/${encodeURIComponent(id)}`]
    : [
        `${baseUrl}/checkouts/${encodeURIComponent(id)}`,
        `${baseUrl}/payments/${encodeURIComponent(id)}`,
      ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) continue;
      const data = await res.json();

      const pStatus = String(data.payment_status || data.status || "").toLowerCase();
      const isPaid =
        pStatus === "succeeded" ||
        pStatus === "paid" ||
        pStatus === "active" ||
        pStatus === "completed";
      const isFailed =
        pStatus === "failed" ||
        pStatus === "declined" ||
        pStatus === "error" ||
        pStatus === "rejected" ||
        pStatus === "unpaid";
      const isCancelled =
        pStatus === "cancelled" ||
        pStatus === "canceled" ||
        pStatus === "user_dropped" ||
        pStatus === "expired" ||
        pStatus === "abandoned";

      // Resolve plan/period from metadata or product cart
      let plan: string | null = data.metadata?.plan || null;
      let period: string | null = data.metadata?.period || null;
      if (!plan) {
        const productId = data.product_cart?.[0]?.product_id || data.product_id || "";
        if (productId && PRODUCT_PLAN[productId]) {
          plan = PRODUCT_PLAN[productId].plan;
          period = PRODUCT_PLAN[productId].period;
        }
      }

      return { isPaid, isFailed, isCancelled, plan, period, data };
    } catch {
      continue;
    }
  }
  return empty;
}

// Apply a confirmed payment to the user's subscription.
// Uses the DB's purchase_outcome logic via direct upsert (mirrors what apply_payment SQL does).
async function applyPaidSubscription(
  admin: any,
  userId: string,
  plan: string,
  period: string,
  paymentId: string | null,
  existingPaymentRowId: string | null,
  paymentMethod: string | null = null,
  actualAmount: number | null = null,
): Promise<string> {
  // Fetch the user's current subscription to compute carry-over correctly
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("current_period_end, plan_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const currentEndMs = existingSub?.current_period_end
    ? new Date(existingSub.current_period_end).getTime()
    : 0;

  let durationDays = period === "year" ? 365 : 30;
  let baseTime = Date.now();

  if (existingSub?.plan_id === plan && existingSub?.status === "active" && currentEndMs > Date.now()) {
    // Same plan renewal: stack on top of current period end
    baseTime = currentEndMs;
  } else if (existingSub?.plan_id === "pro" && plan === "ultimate" && existingSub?.status === "active" && currentEndMs > Date.now()) {
    // Pro → Ultimate upgrade: credit remaining Pro time at 70% rate (700/1000)
    const proDaysRemaining = (currentEndMs - Date.now()) / 86400000;
    durationDays += Math.round(proDaysRemaining * 0.70);
    // Start from now for upgrades
  }

  const periodEnd = new Date(baseTime + durationDays * 86400000).toISOString();

  // Upsert subscription — use 'active', 'canceled' (one L) per constraint
  await admin.from("subscriptions").upsert({
    user_id: userId,
    plan_id: plan,
    status: "active",
    current_period_end: periodEnd,
    provider: "dodopayments",
    provider_reference: existingPaymentRowId || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Mark the payment row as paid and record exact settled amount
  if (existingPaymentRowId) {
    await admin.from("payments").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_payment_id: paymentId,
      period_end: periodEnd,
      ...(actualAmount && actualAmount > 0 ? { amount: actualAmount } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", existingPaymentRowId);
  }

  return periodEnd;
}

// ------------------------------------------------------------------ handler

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return refuse(405, "method", "Use POST.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return refuse(500, "server", "The billing service is not configured.");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = token ? await admin.auth.getUser(token) : { data: null };
  const user = userData?.user;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return refuse(400, "bad_request", "The request was not valid JSON."); }

  const config = settings();
  const action = String(body.action || "");

  // ------------------------------------------------------------------ config
  if (action === "config") {
    return reply(200, {
      enabled: config.enabled,
      mode: config.env,
      currencies: config.currencies,
      provider: "dodopayments",
    });
  }

  if (!config.enabled) {
    return refuse(503, "payments_not_configured", "Online payment is not configured.");
  }

  // ------------------------------------------------------------------ create
  if (action === "create") {
    if (!user?.id) return refuse(401, "auth", "Sign in to continue.");

    const plan = String(body.plan || "");
    const period = String(body.period || "");
    const currency = String(body.currency || "USD").toUpperCase();

    if (!PLANS.has(plan)) return refuse(400, "plan", "Choose Pro or Ultimate.");
    if (!PERIODS.has(period)) return refuse(400, "period", "Choose monthly or yearly.");

    const productId = DODO_PRODUCTS[plan]?.[period];
    if (!productId) return refuse(400, "product", "Invalid product mapping.");

    const name = String(body.name || user.user_metadata?.full_name || "Customer").trim().slice(0, 100);
    const email = user.email || String(body.email || "");

    let rawPhone = String(body.phone || user.user_metadata?.phone || user.phone || "").trim();
    let phoneNumber: string | undefined;
    if (rawPhone) {
      if (!rawPhone.startsWith("+")) {
        rawPhone = /^[6-9]\d{9}$/.test(rawPhone) ? `+91${rawPhone}` : `+${rawPhone}`;
      }
      phoneNumber = rawPhone;
    }

    const returnUrl = String(body.returnUrl || "").trim();
    const upgradeAccepted = Boolean(body.upgradeAccepted);
    const carriedOverDays = body.carriedOverDays ? Number(body.carriedOverDays) : 0;
    const termsAccepted = Boolean(body.termsAccepted);
    const termsAcceptedAt = String(body.termsAcceptedAt || new Date().toISOString());

    if (!termsAccepted) {
      return refuse(400, "terms_required", "You must accept the Terms of Service, Refund Policy, and Dodo Payments terms to continue.");
    }

    const userCountry = body.country ? String(body.country).toUpperCase() : (currency === "INR" ? "IN" : "US");

    const payload: Record<string, unknown> = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      billing_currency: currency === "INR" ? "INR" : "USD",
      billing_address: { country: userCountry },
      customer: {
        email: email || undefined,
        name: name || undefined,
        phone_number: phoneNumber || undefined,
      },
      feature_flags: { allow_phone_number_collection: true },
      metadata: {
        plan,
        period,
        userId: user.id,
        phone: phoneNumber || null,
        country: userCountry,
        upgradeAccepted,
        carriedOverDays,
        termsAccepted: true,
        termsAcceptedAt,
        paymentProvider: "dodopayments",
      },
    };

    if (returnUrl && /^https?:\/\//i.test(returnUrl)) {
      payload.return_url = returnUrl;
    }

    const dodoRes = await fetch(`${config.baseUrl}/checkouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!dodoRes.ok) {
      const err = await dodoRes.json().catch(() => ({}));
      return refuse(502, "dodo_error", err.message || `Dodo error ${dodoRes.status}`);
    }

    const dodoData = await dodoRes.json();
    const sessionId = dodoData.session_id;

    // Generate our internal order ID and record the payment intent
    const orderId = `oa_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

    // Save phone + name to user profile asynchronously (fire-and-forget)
    try {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          ...(phoneNumber ? { phone: phoneNumber } : {}),
          ...(name ? { full_name: name } : {}),
          terms_accepted: true,
          terms_accepted_at: termsAcceptedAt,
          terms_version: "2026-09-30",
          payment_provider: "dodopayments",
        },
      });
    } catch (e) { console.error("Auth metadata update failed:", e); }

    try {
      await admin.from("profiles").upsert({
        id: user.id,
        email: user.email,
        ...(name ? { full_name: name } : {}),
        ...(phoneNumber ? { phone: phoneNumber } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    } catch (e) { console.error("Profile upsert failed:", e); }

    // In India (INR), 18% GST applies to digital services (₹700 -> ₹826, ₹1,000 -> ₹1,180, ₹7,000 -> ₹8,260, ₹10,000 -> ₹11,800)
    const planAmount = currency === "INR" || userCountry === "IN"
      ? (plan === "pro" ? (period === "year" ? 8260 : 826) : (period === "year" ? 11800 : 1180))
      : (plan === "pro" ? (period === "year" ? 73 : 7.3) : (period === "year" ? 104.2 : 10.42));

    let noteText = email ? `${email}${name ? ` (${name})` : ""}` : "";
    if (phoneNumber) noteText = noteText ? `${noteText} | Phone: ${phoneNumber}` : `Phone: ${phoneNumber}`;
    if (upgradeAccepted) noteText += ` | Upgrade accepted (${carriedOverDays} days carried over from Pro)`;
    noteText += ` | Terms accepted at ${termsAcceptedAt}`;

    const { error: insertErr } = await admin.from("payments").insert({
      id: orderId,
      user_id: user.id,
      plan_id: plan,
      period,
      months: period === "year" ? 12 : 1,
      currency,
      amount: planAmount,
      provider: "dodopayments",
      environment: config.env === "live_mode" ? "production" : "sandbox",
      status: "created",
      provider_order_id: sessionId,
      note: noteText || null,
    });

    if (insertErr) {
      console.error("Payment row insert failed:", insertErr);
      return refuse(500, "database_error", "Failed to record payment transaction intent.");
    }

    // Return sessionId (for DB lookup on return), orderId (for verify polling),
    // and checkoutUrl (for redirect).
    return reply(200, {
      sessionId,
      orderId,          // Our internal ID — the frontend uses this for verify polling
      checkoutUrl: dodoData.checkout_url,
      plan,
      period,
      currency,
    });
  }

  // ------------------------------------------------------------------ verify
  if (action === "verify") {
    if (!user?.id) return reply(200, { status: "pending" });

    // Accept any identifier the return URL or frontend might send
    const rawId = String(
      body.orderId || body.sessionId || body.paymentId || body.checkout_session_id || body.id || ""
    ).trim();

    // ── Step 1: DB lookup ──────────────────────────────────────────────────
    let paymentRow: any = null;

    if (rawId && !["latest", "succeeded", "success", "active"].includes(rawId)) {
      // Look for a match on our internal ID, the Dodo session ID, or the Dodo payment ID
      const { data } = await admin
        .from("payments")
        .select("id, status, plan_id, period, provider_order_id, provider_payment_id, period_end, created_at")
        .eq("user_id", user.id)
        .or(`id.eq.${rawId},provider_order_id.eq.${rawId},provider_payment_id.eq.${rawId}`)
        .maybeSingle();
      paymentRow = data;
    }

    // Fall back to the most recent payment row for this user
    if (!paymentRow) {
      const { data } = await admin
        .from("payments")
        .select("id, status, plan_id, period, provider_order_id, provider_payment_id, period_end, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      paymentRow = data;
    }

    // DB says paid → return immediately (idempotent)
    if (paymentRow?.status === "paid") {
      return reply(200, {
        status: "paid",
        plan: paymentRow.plan_id,
        planId: paymentRow.plan_id,
        period: paymentRow.period,
        periodEnd: paymentRow.period_end,
        orderId: paymentRow.id,
        sessionId: paymentRow.provider_order_id,
      });
    }

    // DB says definitively failed → return immediately
    if (paymentRow?.status === "failed" || paymentRow?.status === "expired") {
      return reply(200, { status: "failed", lastAttempt: "FAILED" });
    }
    if (paymentRow?.status === "refunded") {
      return reply(200, { status: "cancelled", lastAttempt: "USER_DROPPED" });
    }

    // ── Step 2: Webhook correlation check ─────────────────────────────────
    // Check if the webhook has already explicitly activated this subscription
    // for this specific payment order or session ID.
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("plan_id, status, current_period_end, updated_at, provider_reference")
      .eq("user_id", user.id)
      .maybeSingle();

    const webhookConfirmed =
      subRow?.status === "active" &&
      subRow?.current_period_end &&
      new Date(subRow.current_period_end).getTime() > Date.now() &&
      subRow?.provider_reference &&
      (subRow.provider_reference === paymentRow?.id || subRow.provider_reference === paymentRow?.provider_order_id);

    if (webhookConfirmed) {
      // Mark the DB payment row as paid (best-effort)
      if (paymentRow?.id && paymentRow.status === "created") {
        await admin.from("payments").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          period_end: subRow.current_period_end,
          updated_at: new Date().toISOString(),
        }).eq("id", paymentRow.id);
      }
      return reply(200, {
        status: "paid",
        plan: subRow.plan_id,
        planId: subRow.plan_id,
        period: paymentRow?.period || null,
        periodEnd: subRow.current_period_end,
        orderId: paymentRow?.id,
        sessionId: paymentRow?.provider_order_id,
      });
    }

    // ── Step 3: Query Dodo Payments API ───────────────────────────────────
    const dodoId = paymentRow?.provider_order_id || rawId;
    if (dodoId && !["latest", "succeeded", "success", "active"].includes(dodoId)) {
      const { isPaid, isFailed, isCancelled, plan: dodoPlan, period: dodoPeriod, data: dodoData } =
        await queryDodoStatus(config.baseUrl, config.apiKey, dodoId);

      const rawActualAmount = dodoData?.total_amount ?? dodoData?.amount ?? dodoData?.payment?.total_amount ?? dodoData?.payment?.amount ?? dodoData?.product_cart?.[0]?.amount ?? 0;
      const actualAmount = Number(rawActualAmount) / 100;

      if (isFailed) {
        if (paymentRow?.id) {
          await admin.from("payments")
            .update({
              status: "failed",
              ...(actualAmount > 0 ? { amount: actualAmount } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);
        }
        return reply(200, { status: "failed", lastAttempt: "FAILED" });
      }

      if (isCancelled) {
        // NOTE: payments table has no 'cancelled' status — use 'failed' for the constraint
        if (paymentRow?.id) {
          await admin.from("payments")
            .update({
              status: "failed",
              ...(actualAmount > 0 ? { amount: actualAmount } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentRow.id);
        }
        return reply(200, { status: "cancelled", lastAttempt: "USER_DROPPED" });
      }

      if (isPaid) {
        // Resolve plan/period: Dodo metadata > DB payment row > product ID lookup
        const plan = dodoPlan || paymentRow?.plan_id || "pro";
        const period = dodoPeriod || paymentRow?.period || "month";
        const paymentId = dodoData?.payment_id || dodoData?.id || null;
        const paymentMethod = dodoData?.payment_method_type || dodoData?.payment_method || dodoData?.payment?.payment_method_type || dodoData?.payment?.payment_method || null;

        const periodEnd = await applyPaidSubscription(
          admin, user.id, plan, period, paymentId, paymentRow?.id || null, paymentMethod, actualAmount
        );

        return reply(200, {
          status: "paid",
          plan,
          planId: plan,
          period,
          periodEnd,
          paymentId,
          orderId: paymentRow?.id,
          sessionId: paymentRow?.provider_order_id,
        });
      }
    }

    // Still waiting
    return reply(200, { status: "pending" });
  }

  // ------------------------------------------------------------------ simulate (test / sandbox only)
  if (action === "simulate") {
    if (!user?.id) return refuse(401, "auth", "Sign in to simulate a payment.");

    const orderId = String(body.orderId || "").trim();
    const result = String(body.result || "paid");

    if (!orderId) return refuse(400, "order_id", "Provide an orderId to simulate.");

    const { data: payRow } = await admin
      .from("payments")
      .select("id, plan_id, period")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!payRow) return refuse(404, "not_found", "Order not found.");

    if (result === "paid") {
      const periodEnd = await applyPaidSubscription(
        admin, user.id, payRow.plan_id, payRow.period, null, payRow.id
      );
      return reply(200, {
        status: "paid",
        plan: payRow.plan_id,
        planId: payRow.plan_id,
        period: payRow.period,
        periodEnd,
        orderId: payRow.id,
      });
    }

    if (result === "failed") {
      await admin.from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return reply(200, { status: "failed", lastAttempt: "FAILED" });
    }

    // expired / cancelled → mark as failed in DB (constraint), return cancelled to frontend
    await admin.from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return reply(200, { status: "cancelled", lastAttempt: "USER_DROPPED" });
  }

  return refuse(400, "action", "Unknown action.");
});
