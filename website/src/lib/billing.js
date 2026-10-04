import { website } from './supabase.js';

// The website's side of paying for a plan. Prices and the order itself are
// decided by the billing Edge Function from the database; the browser only
// says which plan, period and currency the person picked.

async function call(body) {
  const { data, error } = await website().functions.invoke('billing', { body });
  if (error) {
    let payload = null;
    try { payload = await error.context?.json?.(); } catch { payload = null; }
    const failure = new Error(payload?.error?.message || error.message || 'The payment service could not be reached. Check your connection and try again.');
    failure.code = payload?.error?.code || 'network';
    failure.status = error.context?.status;
    throw failure;
  }
  return data;
}

export const billing = {
  config: () => call({ action: 'config' }),
  create: input => call({ action: 'create', ...input }),
  verify: orderId => call({ action: 'verify', orderId }),
  // Test payments only: settles a test order as success, failed or cancelled.
  simulate: (orderId, result, method) => call({ action: 'simulate', orderId, result, method }),
};

// Ask until the order is settled, or give up after a while and let the page
// say so. The webhook applies the payment even if nobody is watching.
//
// Strategy: poll 15 times with 2 s gaps (= 30 s total). The first few polls
// happen quickly so the happy path (webhook already fired) resolves fast;
// subsequent polls give the webhook time to land.
export async function waitForPayment(orderId, { tries = 15, gap = 2000, onTick, isCancelled } = {}) {
  let last = null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (isCancelled?.()) return null;
    try {
      last = await billing.verify(orderId);
      if (isCancelled?.()) return null;
      onTick?.(last, attempt);
      if (
        last?.status === 'paid' ||
        last?.status === 'expired' ||
        last?.status === 'failed' ||
        last?.status === 'cancelled'
      ) return last;
      if (last?.lastAttempt === 'FAILED' || last?.lastAttempt === 'USER_DROPPED') return last;
    } catch {
      // ignore transient network or edge function errors while polling
    }
    if (isCancelled?.()) return null;
    await new Promise(resolve => setTimeout(resolve, gap));
  }
  return isCancelled?.() ? null : last;
}
