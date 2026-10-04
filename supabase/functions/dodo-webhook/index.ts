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
  // Live USD products
  "pdt_0Nov3J3YiTwFKjr6EsslN": { plan: "pro",      period: "month" },
  "pdt_0Nov3J7j5e01EyiKgomhA": { plan: "pro",      period: "year"  },
  "pdt_0Nov3JCi7Wi4Hd3g6UH37": { plan: "ultimate", period: "month" },
  "pdt_0Nov3JFSpuBh3MPl5TBlJ": { plan: "ultimate", period: "year"  },
  // Live INR products
  "pdt_0Nov6xCmVxAVN95qaQHvJ": { plan: "pro",      period: "month" },
  "pdt_0Nov6xFQR8ygUzTeybAYY": { plan: "pro",      period: "year"  },
  "pdt_0Nov6xGt5LEolOQtQTe4O": { plan: "ultimate", period: "month" },
  "pdt_0Nov6xJ6Zi4tTRi9rEHT4": { plan: "ultimate", period: "year"  },
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
    if (!webhookSecret) {
      console.error("[dodo-webhook] DODO_WEBHOOK_SECRET is not configured. Rejecting request with 503.");
      return reply(503, { error: "Webhook verification unavailable" });
    }

    const raw = await request.text();
    const verification = await verifyDodoWebhookSignature(raw, request.headers, webhookSecret);
    if (!verification.valid) {
      console.warn("[dodo-webhook] Signature verification failed:", verification.reason);
      return reply(401, { error: "Unauthorized", reason: verification.reason });
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

    // ── Identify the customer & payment identifiers ───────────────────────────
    const customerEmail = String(data?.customer?.email || data?.customer_email || data?.email || "").trim().toLowerCase();
    const customerName  = String(data?.customer?.name  || data?.customer_name  || "").trim();
    const metadata      = data?.metadata || {};

    const paymentId = String(data?.payment_id || data?.id || "");
    const sessionId = String(data?.session_id || data?.checkout_session_id || "");

    const userNote = customerEmail ? `${customerEmail}${customerName ? ` (${customerName})` : ""}` : null;

    // ── Resolve existing OUTARCH payment order (authoritative) ────────────────
    let existingPay: any = null;
    if (sessionId) {
      const { data: p } = await admin.from("payments").select("*").eq("provider_order_id", sessionId).maybeSingle();
      if (p) existingPay = p;
    }
    if (!existingPay && paymentId) {
      const { data: p } = await admin.from("payments").select("*").eq("provider_payment_id", paymentId).maybeSingle();
      if (p) existingPay = p;
    }

    let userId: string | null = existingPay?.user_id || metadata?.userId || null;

    if (!userId && customerEmail) {
      const { data: profRow } = await admin.from("profiles").select("id").ilike("email", customerEmail).maybeSingle();
      if (profRow?.id) userId = profRow.id;
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
        if (!existingPay) {
          console.warn(`[dodo-webhook] ${eventType}: No matching OUTARCH payment order found for sessionId=${sessionId}, paymentId=${paymentId}. Holding event without automated entitlement.`);
          processResult = { received: true, event: eventType, status: "held_for_review" };
          break;
        }

        const payUserId = existingPay.user_id;
        const plan = existingPay.plan_id;
        const period = existingPay.period;
        const expectedAmount = Number(existingPay.amount);
        const expectedCurrency = String(existingPay.currency || "USD").toUpperCase();

        // Validate currency against stored payment order
        const receivedCurrency = String(data?.currency || data?.billing_currency || expectedCurrency).toUpperCase();
        if (receivedCurrency !== expectedCurrency) {
          console.error(`[dodo-webhook] Currency mismatch for order ${existingPay.id}: expected ${expectedCurrency}, received ${receivedCurrency}`);
          processResult = { received: true, event: eventType, status: "currency_mismatch" };
          break;
        }

        // Validate amount against stored payment order
        const rawAmount = data?.total_amount ?? data?.amount ?? data?.payment?.total_amount ?? data?.payment?.amount ?? data?.product_cart?.[0]?.amount ?? 0;
        const receivedAmount = Number(rawAmount) / 100;
        if (receivedAmount > 0 && expectedAmount > 0 && receivedAmount < expectedAmount * 0.98) {
          console.error(`[dodo-webhook] Amount underpaid for order ${existingPay.id}: expected ${expectedAmount}, received ${receivedAmount}`);
          processResult = { received: true, event: eventType, status: "amount_underpaid" };
          break;
        }

        const resolvedPaymentMethod =
          String(data?.payment_method_type || data?.payment_method || data?.payment?.payment_method_type || data?.payment?.payment_method || data?.payment_type || "dodopayments").toLowerCase();

        // Delegate exclusively to public.apply_payment(...) in database for lock, validation, purchase_outcome and subscription update
        const { data: applyResult, error: applyErr } = await admin.rpc("apply_payment", {
          p_order: existingPay.id,
          p_payment_id: paymentId || existingPay.provider_payment_id || null,
          p_method: resolvedPaymentMethod,
          p_amount: existingPay.amount,
          p_currency: existingPay.currency,
        });

        if (applyErr) {
          console.error(`[dodo-webhook] apply_payment failed for order ${existingPay.id}:`, applyErr.message);
          return reply(500, { error: "Database failed to apply payment", details: applyErr.message });
        }

        console.log(`[dodo-webhook] ✅ apply_payment succeeded for order=${existingPay.id}:`, applyResult);

        // Sync contact info to profile
        const customerPhone = String(data?.customer?.phone_number || data?.customer?.phone || metadata?.phone || "").trim();
        if (customerPhone || customerName) {
          try {
            await admin.auth.admin.updateUserById(payUserId, {
              user_metadata: {
                ...(customerPhone ? { phone: customerPhone } : {}),
                ...(customerName  ? { full_name: customerName } : {}),
              },
            });
          } catch (e) { console.error("[dodo-webhook] Auth metadata sync error:", e); }

          try {
            await admin.from("profiles").upsert({
              id: payUserId,
              email: customerEmail || undefined,
              ...(customerName  ? { full_name: customerName  } : {}),
              ...(customerPhone ? { phone: customerPhone } : {}),
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" });
          } catch (e) {
            console.error("[dodo-webhook] Profile sync error:", e);
          }
        }

        processResult = {
          success: true,
          event: eventType,
          user: payUserId,
          orderId: existingPay.id,
          plan: applyResult?.planId || existingPay.plan_id,
          periodEnd: applyResult?.periodEnd,
        };
        break;
      }

      // ── Payment failure ────────────────────────────────────────────────────
      case "payment.failed":
      case "payment.cancelled": {
        if (existingPay?.id) {
          const rawAmount = data?.total_amount ?? data?.amount ?? data?.payment?.total_amount ?? data?.payment?.amount ?? 0;
          const failedAmount = Number(rawAmount) / 100;
          await admin.from("payments").update({
            status: "failed",
            ...(failedAmount > 0 ? { amount: failedAmount } : {}),
            last_event: eventType,
            provider_payment_id: paymentId || undefined,
            updated_at: new Date().toISOString(),
          }).eq("id", existingPay.id);
        }
        console.log(`[dodo-webhook] ❌ ${eventType} for order=${existingPay?.id || "unknown"} user=${userId || "unknown"}`);
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
