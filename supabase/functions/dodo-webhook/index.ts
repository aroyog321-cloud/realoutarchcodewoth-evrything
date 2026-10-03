// OUTARCH dodo-webhook: Comprehensive Dodo Payments Webhook Handler
// Standard Webhooks HMAC-SHA256 signature verification + webhook-id idempotency.
// Processes payments, subscriptions, cancellations, renewals, disputes, and refunds.
//
// DB constraints:
//   payments.status: ('created','paid','failed','expired','refunded') — NO 'cancelled'
//   subscriptions.status: ('active','trialing','past_due','canceled','expired') — ONE L in 'canceled'

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Product ID → plan + period lookup
const PRODUCT_MAP: Record<string, { plan: string; period: string }> = {
  // Live products
  "pdt_0Nov3J3YiTwFKjr6EsslN": { plan: "pro",      period: "month" },
  "pdt_0Nov3J7j5e01EyiKgomhA": { plan: "pro",      period: "year"  },
  "pdt_0Nov3JCi7Wi4Hd3g6UH37": { plan: "ultimate", period: "month" },
  "pdt_0Nov3JFSpuBh3MPl5TBlJ": { plan: "ultimate", period: "year"  },
  // Test products
  "pdt_0NohxyGlqUEFWQEpCzug5": { plan: "pro",      period: "month" },
  "pdt_0NohxyIVrgAJKAwIfAfCi": { plan: "pro",      period: "year"  },
  "pdt_0NohxyJbqntvWYdXdykwW": { plan: "ultimate", period: "month" },
  "pdt_0NohxyLvPont2ODalPpvX": { plan: "ultimate", period: "year"  },
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyDodoWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): Promise<{ valid: boolean; reason?: string }> {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const webhookSignature = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { valid: false, reason: "Missing required Standard Webhook headers (webhook-id, webhook-timestamp, webhook-signature)" };
  }

  const timestampNum = parseInt(webhookTimestamp, 10);
  if (isNaN(timestampNum)) {
    return { valid: false, reason: "Invalid webhook-timestamp header value" };
  }

  // Tolerance check (5 minutes = 300 seconds)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampNum) > 300) {
    return { valid: false, reason: `Timestamp skew too large: ${Math.abs(nowSec - timestampNum)}s > 300s` };
  }

  // Decode secret (handle whsec_ base64 prefix or raw utf8)
  let keyBytes: Uint8Array;
  if (secret.startsWith("whsec_")) {
    const base64Part = secret.slice("whsec_".length);
    try {
      const binaryStr = atob(base64Part);
      keyBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        keyBytes[i] = binaryStr.charCodeAt(i);
      }
    } catch {
      keyBytes = new TextEncoder().encode(secret);
    }
  } else {
    try {
      const binaryStr = atob(secret);
      keyBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        keyBytes[i] = binaryStr.charCodeAt(i);
      }
    } catch {
      keyBytes = new TextEncoder().encode(secret);
    }
  }

  const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const dataBytes = new TextEncoder().encode(toSign);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedBase64 = btoa(String.fromCharCode(...signatureArray));

  const signatures = webhookSignature.split(" ");
  for (const sig of signatures) {
    const [version, signatureValue] = sig.split(",");
    if (version === "v1" && signatureValue) {
      if (timingSafeEqual(signatureValue, expectedBase64)) {
        return { valid: true };
      }
    }
  }

  return { valid: false, reason: "Signature mismatch" };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return reply(405, { error: "Use POST" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return reply(503, { error: "Supabase service role unconfigured" });

    const webhookSecret = Deno.env.get("DODO_WEBHOOK_SECRET");
    const raw = await request.text();

    // Signature verification (if webhook secret is configured)
    if (webhookSecret) {
      const verification = await verifyDodoWebhookSignature(raw, request.headers, webhookSecret);
      if (!verification.valid) {
        console.warn("[dodo-webhook] Signature verification failed:", verification.reason);
        return reply(401, { error: "Unauthorized", reason: verification.reason });
      }
    } else {
      console.warn("[dodo-webhook] DODO_WEBHOOK_SECRET is not set; running without signature verification.");
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const webhookId = request.headers.get("webhook-id");

    // Idempotency check: have we already processed this webhook-id?
    if (webhookId) {
      try {
        const { data: alreadyProcessed } = await admin
          .from("processed_webhooks")
          .select("webhook_id, event_type")
          .eq("webhook_id", webhookId)
          .maybeSingle();

        if (alreadyProcessed) {
          console.log(`[dodo-webhook] Webhook ${webhookId} already processed (${alreadyProcessed.event_type}). Returning 200 OK.`);
          return reply(200, { received: true, duplicate: true, webhook_id: webhookId });
        }
      } catch (e) {
        console.warn("[dodo-webhook] processed_webhooks check error:", e);
      }
    }

    let event: any = null;
    try { event = JSON.parse(raw); } catch { return reply(400, { error: "Invalid JSON body" }); }

    const eventType = String(event?.type || event?.event_type || "");
    const data = event?.data || event;

    console.log(`[dodo-webhook] ${eventType}`, JSON.stringify(data).slice(0, 400));

    // ── Identify the customer ──────────────────────────────────────────────────
    const customerEmail = String(data?.customer?.email || data?.customer_email || data?.email || "").trim().toLowerCase();
    const customerName  = String(data?.customer?.name  || data?.customer_name  || "").trim();
    const metadata      = data?.metadata || {};

    let userId: string | null = metadata?.userId || null;

    const paymentId = String(data?.payment_id || data?.id || "");
    const sessionId = String(data?.session_id || data?.checkout_session_id || "");

    // Resolve plan/period from metadata first, then product ID, then amount heuristic
    const rawProductId = String(data?.product_id || data?.product_cart?.[0]?.product_id || "");
    const mappedProduct = PRODUCT_MAP[rawProductId] || null;

    const rawAmount = data?.total_amount ?? data?.amount ?? data?.payment?.total_amount ?? data?.payment?.amount ?? data?.product_cart?.[0]?.amount ?? 0;
    const amount   = Number(rawAmount) / 100;
    const currency = String(data?.currency || data?.billing_currency || "USD").toUpperCase();

    // Priority order: explicit metadata > product ID map > amount heuristic
    const plan   = String(metadata?.plan   || mappedProduct?.plan   || (amount >= 10 && currency === "USD" ? "ultimate" : amount >= 1000 && currency === "INR" ? "ultimate" : "pro"));
    const period = String(metadata?.period || mappedProduct?.period || "month");

    const userNote = customerEmail ? `${customerEmail}${customerName ? ` (${customerName})` : ""}` : null;

    // 1. Resolve userId from existing payment record (most reliable)
    if (!userId && sessionId) {
      const { data: payRow } = await admin.from("payments").select("user_id").eq("provider_order_id", sessionId).maybeSingle();
      if (payRow?.user_id) userId = payRow.user_id;
    }

    // 2. Resolve by email in profiles
    if (!userId && customerEmail) {
      const { data: profRow } = await admin.from("profiles").select("id").ilike("email", customerEmail).maybeSingle();
      if (profRow?.id) userId = profRow.id;
    }

    // 3. Fallback: search auth.users directly
    if (!userId && customerEmail) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u: any) => u.email?.toLowerCase() === customerEmail);
        if (found) userId = found.id;
      } catch (e) {
        console.warn("[dodo-webhook] listUsers error:", e);
      }
    }

    let processResult: any = null;

    // ── Event routing ──────────────────────────────────────────────────────────
    switch (eventType) {

      // ── Payment success / subscription activation ──────────────────────────
      case "payment.succeeded":
      case "checkout.completed":
      case "subscription.active":
      case "subscription.renewed":
      case "subscription.unpaused":
      case "subscription.plan_changed": {
        if (!userId) {
          console.warn(`[dodo-webhook] ${eventType}: no userId resolved for email=${customerEmail}`);
          processResult = { received: true, event: eventType, status: "no_user" };
          break;
        }

        // Fetch current subscription to compute carry-over
        const { data: existingSub } = await admin
          .from("subscriptions")
          .select("current_period_end, plan_id, status")
          .eq("user_id", userId)
          .maybeSingle();

        const currentEndMs = existingSub?.current_period_end
          ? new Date(existingSub.current_period_end).getTime()
          : 0;

        let durationDays = period === "year" ? 365 : 30;
        let carriedOver = 0;
        let baseTime = Date.now();

        if (existingSub?.plan_id === plan && existingSub?.status === "active" && currentEndMs > Date.now()) {
          // Same plan renewal — stack
          baseTime = currentEndMs;
        } else if (existingSub?.plan_id === "pro" && plan === "ultimate" && existingSub?.status === "active" && currentEndMs > Date.now()) {
          // Pro → Ultimate upgrade — credit 70% of remaining Pro days
          const proDaysRemaining = (currentEndMs - Date.now()) / 86400000;
          carriedOver = Math.round(proDaysRemaining * 0.70 * 10) / 10;
          durationDays += Math.round(carriedOver);
        }

        const periodEnd = new Date(baseTime + durationDays * 86400000).toISOString();

        // Find or create the payment row for this session
        let targetOrderId: string | null = null;
        let isExistingRow = false;

        if (sessionId) {
          const { data: existingPay } = await admin
            .from("payments")
            .select("id")
            .eq("provider_order_id", sessionId)
            .maybeSingle();
          if (existingPay?.id) { targetOrderId = existingPay.id; isExistingRow = true; }
        }

        if (!targetOrderId && paymentId) {
          const { data: existingPay } = await admin
            .from("payments")
            .select("id")
            .eq("provider_payment_id", paymentId)
            .eq("user_id", userId)
            .maybeSingle();
          if (existingPay?.id) { targetOrderId = existingPay.id; isExistingRow = true; }
        }

        const noteText = carriedOver > 0
          ? `${userNote || "User"} | Upgrade: ${carriedOver} days carried over from Pro`
          : userNote;

        const resolvedPaymentMethod =
          String(data?.payment_method_type || data?.payment_method || data?.payment?.payment_method_type || data?.payment?.payment_method || data?.payment_type || "dodo").toLowerCase();

        if (isExistingRow && targetOrderId) {
          // Update existing draft → paid
          await admin.from("payments").update({
            status: "paid",
            paid_at: new Date().toISOString(),
            plan_id: plan,
            amount: amount || undefined,
            currency: currency || undefined,
            provider_payment_id: paymentId || undefined,
            payment_method: resolvedPaymentMethod,
            note: noteText,
            period_start: new Date().toISOString(),
            period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }).eq("id", targetOrderId);
        } else {
          // New payment row
          const newOrderId = `oa_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
          await admin.from("payments").insert({
            id: newOrderId,
            user_id: userId,
            plan_id: plan,
            period,
            months: period === "year" ? 12 : 1,
            currency: currency || "USD",
            amount: amount || 0,
            provider: "dodopayments",
            environment: "production",
            status: "paid",
            paid_at: new Date().toISOString(),
            provider_order_id: sessionId || null,
            provider_payment_id: paymentId || null,
            payment_method: resolvedPaymentMethod,
            note: noteText,
            period_start: new Date().toISOString(),
            period_end: periodEnd,
          }).catch((e: any) => console.error("[dodo-webhook] payment insert error:", e));
        }

        // Activate / extend subscription
        // NOTE: status must be 'active' (subscriptions constraint uses 'active', 'canceled' with ONE L)
        const { error: subErr } = await admin.from("subscriptions").upsert({
          user_id: userId,
          plan_id: plan,
          status: "active",
          current_period_end: periodEnd,
          provider: "dodopayments",
          provider_reference: targetOrderId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (subErr) {
          console.error("[dodo-webhook] Subscription upsert error:", subErr);
        } else {
          console.log(`[dodo-webhook] ✅ Activated ${plan}/${period} for user=${userId} until ${periodEnd} (carried=${carriedOver}d)`);
        }

        // Sync contact info to profile
        const customerPhone = String(data?.customer?.phone_number || data?.customer?.phone || metadata?.phone || "").trim();
        if (customerPhone || customerName) {
          try {
            await admin.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...(customerPhone ? { phone: customerPhone } : {}),
                ...(customerName  ? { full_name: customerName } : {}),
              },
            });
          } catch (e) { console.error("[dodo-webhook] Auth metadata sync error:", e); }
          await admin.from("profiles").upsert({
            id: userId,
            email: customerEmail || undefined,
            ...(customerName  ? { full_name: customerName  } : {}),
            ...(customerPhone ? { phone: customerPhone } : {}),
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" }).catch((e: any) => console.error("[dodo-webhook] Profile sync error:", e));
        }

        processResult = { success: true, event: eventType, user: userId, plan, periodEnd };
        break;
      }

      // ── Payment failure ────────────────────────────────────────────────────
      case "payment.failed":
      case "payment.cancelled": {
        if (userId && (sessionId || paymentId)) {
          const query = sessionId
            ? admin.from("payments").select("id").eq("provider_order_id", sessionId).maybeSingle()
            : admin.from("payments").select("id").eq("provider_payment_id", paymentId).eq("user_id", userId).maybeSingle();

          const { data: existingPay } = await query;

          if (existingPay?.id) {
            await admin.from("payments").update({
              status: "failed",
              ...(amount > 0 ? { amount } : {}),
              last_event: eventType,
              provider_payment_id: paymentId || undefined,
              updated_at: new Date().toISOString(),
            }).eq("id", existingPay.id);
          } else {
            const failOrderId = `oa_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
            await admin.from("payments").insert({
              id: failOrderId,
              user_id: userId,
              plan_id: plan,
              period,
              months: period === "year" ? 12 : 1,
              currency: currency || "USD",
              amount: amount || 0.01,
              provider: "dodopayments",
              environment: "production",
              status: "failed",
              provider_order_id: sessionId || null,
              provider_payment_id: paymentId || null,
              note: userNote,
              last_event: eventType,
            }).catch((e: any) => console.error("[dodo-webhook] failure insert error:", e));
          }
        }
        console.log(`[dodo-webhook] ❌ ${eventType} for user=${userId || "unknown"}`);
        processResult = { success: true, event: eventType };
        break;
      }

      // ── Subscription expiry / cancellation / pause ─────────────────────────
      case "subscription.cancelled":
      case "subscription.expired":
      case "subscription.paused":
      case "subscription.past_due": {
        if (userId) {
          const statusMap: Record<string, string> = {
            "subscription.cancelled": "canceled",   // ONE L — per DB constraint
            "subscription.expired":   "expired",
            "subscription.paused":    "past_due",
            "subscription.past_due":  "past_due",
          };
          const newStatus = statusMap[eventType] || "past_due";

          await admin.from("subscriptions")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("user_id", userId);

          console.log(`[dodo-webhook] Subscription → ${newStatus} for user=${userId}`);
        }
        processResult = { success: true, event: eventType };
        break;
      }

      // ── Refunds & disputes ─────────────────────────────────────────────────
      case "refund.succeeded":
      case "dispute.opened":
      case "dispute.lost": {
        if (userId && paymentId) {
          await admin.from("payments")
            .update({ status: "refunded", last_event: eventType, updated_at: new Date().toISOString() })
            .eq("provider_payment_id", paymentId)
            .eq("user_id", userId);

          if (eventType === "refund.succeeded" || eventType === "dispute.lost") {
            await admin.from("subscriptions")
              .update({ status: "canceled", updated_at: new Date().toISOString() })
              .eq("user_id", userId);
            console.log(`[dodo-webhook] Subscription revoked (${eventType}) for user=${userId}`);
          }
        }
        processResult = { success: true, event: eventType };
        break;
      }

      // ── Unknown events — log and acknowledge ──────────────────────────────
      default:
        console.log(`[dodo-webhook] Unhandled event: ${eventType}`);
        processResult = { received: true, event: eventType, status: "unhandled" };
        break;
    }

    // Record in processed_webhooks for idempotency tracking
    if (webhookId) {
      try {
        await admin.from("processed_webhooks").insert({
          webhook_id: webhookId,
          event_type: eventType,
          provider: "dodopayments",
          payload: event,
          processed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[dodo-webhook] Failed to insert processed webhook id:", e);
      }
    }

    return reply(200, processResult);
  } catch (err: any) {
    console.error("[dodo-webhook] Unexpected error:", err);
    return reply(500, { error: "Internal error", details: err?.message || String(err) });
  }
});
