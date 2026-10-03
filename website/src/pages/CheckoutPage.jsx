import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowSquareOut, CalendarCheck, Check, CircleNotch, Crown, CreditCard, Flask, Info, Lock, ShieldCheck, WarningCircle,
} from '@phosphor-icons/react';
import { Segmented } from '../components/Pricing.jsx';
import TestGateway from '../components/TestGateway.jsx';
import { EASE } from '../components/ui.jsx';
import { billing, waitForPayment } from '../lib/billing.js';
import { priceOf, useCatalog } from '../lib/catalog.js';
import { COUNTRIES } from '../lib/countries.js';
import { formatMoney, useCurrency } from '../lib/currency.js';
import { Link, useRouter } from '../lib/router.jsx';
import { website } from '../lib/supabase.js';

// Buying Pro or Ultimate. The page shows what the purchase will do (from
// checkout_quote, the same rule the database applies), opens Dodo Payments
// checkout session, then confirms with the billing function until the order is
// settled. The plan is switched on by the server: by return confirmation or
// by Dodo's verified webhook, whichever comes first.

const PLAN_POINTS = {
  pro: ['8 terminals at once', 'Unlimited projects', 'Unlimited Mission AI*', '3 recipes', '1 key of your own', 'Mobile companion', 'MCP gateway, read-only tools'],
  ultimate: ['Unlimited terminals', 'Unlimited projects', 'Unlimited Mission AI*', 'Unlimited recipes', 'Unlimited AI keys of your own', 'Mobile companion', 'Full MCP gateway', 'VS Code bridge'],
};

function formatDate(value) {
  if (!value) return '';
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function cleanDigits(val) {
  return String(val || '').replace(/[^\d]/g, '');
}

function formatPhoneDisplay(iso, rawVal) {
  if (iso === 'IN') {
    let digits = cleanDigits(rawVal);
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length > 10 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return digits;
  }
  if (iso === 'US' || iso === 'CA') {
    let digits = cleanDigits(rawVal);
    if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (digits.length > 6) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return digits;
  }
  if (iso === 'OTHER') {
    const str = String(rawVal || '').trim();
    return str.startsWith('+') ? str : (str ? `+${str.replace(/[^\d]/g, '')}` : '');
  }
  const digits = cleanDigits(rawVal).slice(0, 14);
  if (digits.length > 7) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return digits;
}

function validatePhoneNumber(iso, number) {
  const digits = cleanDigits(number);
  if (iso === 'IN') {
    let d = digits;
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d);
  }
  if (iso === 'US' || iso === 'CA') {
    let d = digits;
    if (d.length > 10 && d.startsWith('1')) d = d.slice(1);
    return /^\d{10}$/.test(d);
  }
  if (iso === 'GB') {
    return /^\d{9,11}$/.test(digits);
  }
  if (iso === 'OTHER') {
    const full = String(number || '').startsWith('+') ? number : `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(full.replace(/\s+/g, ''));
  }
  return digits.length >= 7 && digits.length <= 15;
}

function toE164(iso, code, number) {
  const digits = cleanDigits(number);
  if (iso === 'IN') {
    let d = digits;
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return d ? `+91${d}` : '';
  }
  if (iso === 'US' || iso === 'CA') {
    let d = digits;
    if (d.length > 10 && d.startsWith('1')) d = d.slice(1);
    const cleanCode = code.startsWith('+') ? code : `+${code}`;
    return d ? `${cleanCode}${d}` : '';
  }
  if (iso === 'OTHER') {
    const raw = String(number || '').replace(/[^\d+]/g, '');
    return raw.startsWith('+') ? raw : (raw ? `+${raw}` : '');
  }
  const cleanCode = code.startsWith('+') ? code : `+${code}`;
  return digits ? `${cleanCode}${digits}` : '';
}

// ------------------------------------------------------------------ result screens

function Burst() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const colors = ['#2f7bff', '#3fd0b5', '#9b7bff', '#f5b942', '#6aa6ff'];
  return <div className="pointer-events-none absolute left-1/2 top-[70px]" aria-hidden="true">
    {Array.from({ length: 22 }, (_, index) => {
      const angle = (index / 22) * Math.PI * 2;
      const distance = 90 + (index % 4) * 22;
      return <motion.span key={index} className="absolute h-2 w-2 rounded-[2px]" style={{ background: colors[index % colors.length] }}
        initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
        animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, rotate: 200, scale: 0.6 }}
        transition={{ duration: 1.1, ease: [0.2, 0.7, 0.3, 1], delay: 0.25 }}/>;
    })}
  </div>;
}

function Success({ planName, periodEnd }) {
  return <motion.div className="card relative mx-auto max-w-[560px] overflow-hidden p-10 text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(63,208,181,0.2),transparent)]"/>
    <Burst/>
    <svg viewBox="0 0 80 80" className="relative mx-auto h-20 w-20" aria-hidden="true">
      <motion.circle cx="40" cy="40" r="36" fill="none" stroke="#3fd0b5" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }}/>
      <motion.path d="M25 41 L36 52 L56 30" fill="none" stroke="#3fd0b5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease: EASE }}/>
    </svg>
    <h1 className="display relative mt-6 text-[32px]">{planName} is on.</h1>
    <p className="relative mt-3 text-[16px] text-fg-muted">{periodEnd ? `Your plan runs until ${formatDate(periodEnd)}.` : 'Your plan is active.'} A receipt is in your account.</p>
    <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <a href="outarch://account/refresh" className="btn btn--primary"><ArrowSquareOut size={17}/>Open OUTARCH</a>
      <Link to="/account" className="btn btn--glass">Go to your account</Link>
    </div>
    <p className="relative mt-6 text-[13px] text-fg-dim">Signed in to OUTARCH with this account? Open OUTARCH makes the app read your new plan straight away; otherwise it picks it up within five minutes. Not signed in yet? The app asks you to sign in when it starts.</p>
  </motion.div>;
}

function Waiting({ title, body, children }) {
  return <div className="card mx-auto max-w-[560px] p-10 text-center">
    <CircleNotch size={44} className="mx-auto animate-spin text-brand-sky"/>
    <h1 className="display mt-6 text-[28px]">{title}</h1>
    <p className="mt-3 text-[15.5px] text-fg-muted">{body}</p>
    {children}
  </div>;
}

function extractReturnReference(query) {
  if (!query) return '';
  const searchKeys = [
    'payment_id', 'paymentId',
    'session_id', 'sessionId',
    'checkout_session_id', 'checkout_id',
    'subscription_id', 'subscriptionId',
    'order_id', 'orderId',
    'dodo_payment_id',
    'reference', 'ref',
    'id',
  ];
  for (const k of searchKeys) {
    const val = query.get(k);
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  if (typeof window !== 'undefined' && window.location.hash) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
      for (const k of searchKeys) {
        const val = hashParams.get(k);
        if (val && typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return '';
}

// ------------------------------------------------------------------ page

export default function CheckoutPage() {
  const { path, query, navigate } = useRouter();
  const catalog = useCatalog();
  const [preferred] = useCurrency();
  const returning = path === '/checkout/return';
  const returnOrder = useMemo(() => extractReturnReference(query), [query]);

  const initialPlan = (query?.get('plan') || '').toLowerCase() === 'ultimate' ? 'ultimate' : 'pro';
  const [plan, setPlan] = useState(initialPlan);
  const [period, setPeriod] = useState(query?.get('period') === 'year' ? 'year' : 'month');
  const [currency, setCurrency] = useState(['INR', 'USD'].includes(query?.get('currency')) ? query.get('currency') : (preferred || 'USD'));

  useEffect(() => {
    const p = (query?.get('plan') || '').toLowerCase();
    if (p === 'ultimate' || p === 'pro') setPlan(p);
    const per = query?.get('period');
    if (per === 'month' || per === 'year') setPeriod(per);
    const cur = query?.get('currency');
    if (cur === 'INR' || cur === 'USD') setCurrency(cur);
  }, [query]);
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState(null);
  const [quote, setQuote] = useState(null);
  const [name, setName] = useState('');
  const [countryIso, setCountryIso] = useState(currency === 'INR' ? 'IN' : 'US');
  const [number, setNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState(returning ? 'verifying' : 'loading');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // A test order open in the simulated payment window.
  const [testOrder, setTestOrder] = useState(null);

  const planKey = (String(plan || '').toLowerCase() === 'ultimate') ? 'ultimate' : 'pro';
  const planPoints = PLAN_POINTS[planKey] || PLAN_POINTS.pro;
  const planName = planKey === 'ultimate' ? 'Ultimate' : 'Pro';

  const currentCountry = useMemo(() => {
    return COUNTRIES.find(c => c.iso === countryIso) || COUNTRIES[0] || { iso: 'US', country: 'United States', code: '+1', flag: '🇺🇸', placeholder: '(555) 000-0000', hint: '' };
  }, [countryIso]);

  const phoneOk = useMemo(() => {
    return validatePhoneNumber(countryIso, number);
  }, [countryIso, number]);

  // Signed in? Otherwise sign up first and come back to exactly this checkout.
  useEffect(() => {
    let alive = true;
    website().auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data?.session) {
        const back = `${window.location.pathname}${window.location.search}`;
        navigate(`/auth?mode=signup&next=${encodeURIComponent(back)}`, { replace: true });
        return;
      }
      setSession(data.session);
      setName(data.session.user?.user_metadata?.full_name || data.session.user?.user_metadata?.name || '');
      const userPhone = data.session.user?.user_metadata?.phone || data.session.user?.phone || '';
      if (userPhone) {
        const sortedCountries = COUNTRIES.filter(c => c.code !== 'other' && userPhone.startsWith(c.code)).sort((a, b) => b.code.length - a.code.length);
        const match = sortedCountries[0];
        if (match) {
          setCountryIso(match.iso);
          setNumber(formatPhoneDisplay(match.iso, userPhone.slice(match.code.length)));
          if (match.iso === 'IN') setCurrency('INR');
          else setCurrency(c => (c === 'INR' ? 'USD' : c));
        } else if (/^[6-9]\d{9}$/.test(userPhone)) {
          setCountryIso('IN');
          setNumber(formatPhoneDisplay('IN', userPhone));
          setCurrency('INR');
        } else if (userPhone.startsWith('+')) {
          setCountryIso('OTHER');
          setNumber(userPhone);
        }
      }
    });
    return () => { alive = false; };
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    billing.config()
      .then(cfg => {
        if (cfg) setConfig(cfg);
        else setConfig({ enabled: true, mode: 'simulated', currencies: ['USD', 'INR'] });
      })
      .catch(() => setConfig({ enabled: true, mode: 'simulated', currencies: ['USD', 'INR'] }));
  }, [session]);

  // Loaded on the return page too, so a payment that did not go through can
  // be tried again from the same screen.
  useEffect(() => {
    if (!session) return undefined;
    let alive = true;
    setQuote(null);
    website().rpc('checkout_quote', { p_plan: planKey, p_period: period })
      .then(async ({ data, error: quoteError }) => {
        if (!alive) return;
        // A stored session the server no longer accepts: sign in again, then come back here.
        if (quoteError && (quoteError.code === 'PGRST301' || /jwt|token/i.test(quoteError.message || ''))) {
          await website().auth.signOut({ scope: 'local' });
          navigate(`/auth?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`, { replace: true });
          return;
        }
        setQuote(quoteError ? { blocked: false, planId: planKey, kind: 'new', endsAt: null } : (data || { blocked: false, planId: planKey, kind: 'new', endsAt: null }));
        setPhase(value => (value === 'loading' ? 'ready' : value));
      })
      .catch(() => {
        if (!alive) return;
        setQuote({ blocked: false, planId: planKey, kind: 'new', endsAt: null });
        setPhase(value => (value === 'loading' ? 'ready' : value));
      });
    return () => { alive = false; };
  }, [session, planKey, period, navigate]);

  // Keep the address in step with the choices, so a refresh keeps them.
  useEffect(() => {
    if (returning) return;
    const url = `/checkout?plan=${planKey}&period=${period}&currency=${currency}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, '', url);
  }, [planKey, period, currency, returning]);

  const runRef = useRef(0);
  useEffect(() => () => { runRef.current += 1; }, []);

  // Reset phase if restored from browser bfcache
  useEffect(() => {
    const onShow = e => {
      if (e.persisted) setPhase(p => (p === 'paying' || p === 'creating' ? 'ready' : p));
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const settle = useCallback(async orderId => {
    const run = ++runRef.current;
    setPhase('verifying');
    setError('');
    try {
      const outcome = await waitForPayment(orderId, {
        isCancelled: () => run !== runRef.current,
      });
      if (run !== runRef.current) return;
      if (outcome?.status === 'paid') {
        setResult(outcome);
        setPhase('paid');
        return;
      }
      if (outcome?.status === 'expired') {
        setError('This payment window expired before it was paid. Nothing was charged. Start again.');
        setPhase('ready');
        return;
      }
      if (outcome?.status === 'failed' || outcome?.lastAttempt === 'FAILED') {
        setError('The payment did not go through. Nothing was charged. Try again or use another method.');
        setPhase('ready');
        return;
      }
      if (outcome?.status === 'cancelled' || outcome?.lastAttempt === 'USER_DROPPED') {
        setError('The payment was not finished. Nothing was charged.');
        setPhase('ready');
        return;
      }
      // Payment not confirmed yet — show pending state and auto-redirect to account
      // so the user can see their plan once the webhook fires in the background.
      const retryId = orderId || 'latest';
      setResult({ orderId: retryId === 'latest' ? 'Your active account' : retryId, retryId });
      setPhase('pending');
    } catch (reason) {
      if (run !== runRef.current) return;
      const retryId = orderId || 'latest';
      setResult({ orderId: retryId === 'latest' ? 'Your active account' : retryId, retryId });
      setPhase('pending');
    }
  }, []);

  useEffect(() => {
    if (!returning || !session) return;
    const rawStatus = (query?.get('status') || query?.get('payment_status') || '').toLowerCase();
    if (['failed', 'declined', 'error'].includes(rawStatus)) {
      setPhase('ready');
      setError('The payment did not go through. Nothing was charged. Try again or use another method.');
      return;
    }
    if (['cancelled', 'canceled', 'user_dropped'].includes(rawStatus)) {
      setPhase('ready');
      setError('The payment was cancelled. Nothing was charged.');
      return;
    }
    const targetRef = (returnOrder || '').trim();
    void settle(targetRef || 'latest');
  }, [returning, session, query, returnOrder, settle]);

  const enabledCurrencies = config?.currencies || ['USD', 'INR'];
  const safeCurrency = (typeof currency === 'string' && ['INR', 'USD'].includes(currency)) ? currency : 'USD';
  const chargeCurrency = enabledCurrencies.includes(safeCurrency) ? safeCurrency : 'USD';
  const shown = priceOf(catalog?.prices, planKey, period, safeCurrency);
  const charged = priceOf(catalog?.prices, planKey, period, chargeCurrency) || shown;
  const monthlyEquivalent = priceOf(catalog?.prices, planKey, 'month', safeCurrency);

  const whatHappens = useMemo(() => {
    if (!quote) return null;
    if (quote.blocked) return { tone: 'warn', text: quote.reason || 'This purchase is currently blocked.' };
    const end = formatDate(quote.endsAt);
    if (quote.kind === 'extend') return { tone: 'ok', text: `Adds ${period === 'year' ? '12 months' : 'a month'} to your current ${planName}.${end ? ` It will run until ${end}.` : ''}` };
    if (quote.kind === 'upgrade') return { tone: 'ok', text: `${planName} starts as soon as you pay${quote.carriedOver ? `, with ${quote.carriedOver} days carried over from Pro` : ''}.${end ? ` It will run until ${end}.` : ''}` };
    return { tone: 'ok', text: `${planName} starts as soon as you pay${end ? ` and runs until ${end}.` : '.'}` };
  }, [quote, period, planName]);

  const [upgradeAccepted, setUpgradeAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [requested, setRequested] = useState(false);

  const needsUpgradeAcceptance = Boolean(quote?.kind === 'upgrade' && quote?.carriedOver > 0 && !upgradeAccepted);

  const pay = async () => {
    if (phase === 'creating' || phase === 'paying') return;
    setTouched(true);
    if (!phoneOk) {
      if (countryIso === 'IN') {
        setError('Enter a valid 10-digit Indian mobile number (e.g. 98765 43210).');
      } else {
        setError(`Enter a valid phone number for ${currentCountry.country}.`);
      }
      return;
    }
    if (needsUpgradeAcceptance) {
      setError('Please accept the pro-rated plan conversion terms to continue.');
      return;
    }
    if (!policyAccepted) {
      setError('Please agree to the Terms of Service, Refund Policy, and Dodo Payments terms to continue.');
      return;
    }
    setError('');
    setPhase('creating');
    try {
      const formattedPhone = toE164(countryIso, currentCountry.code, number);
      const selectedCountry = countryIso === 'OTHER' ? 'US' : countryIso;
      const termsAcceptedAt = new Date().toISOString();
      const order = await billing.create({
        plan: planKey,
        period,
        currency: chargeCurrency,
        country: selectedCountry,
        phone: formattedPhone,
        name: name.trim(),
        termsAccepted: true,
        termsAcceptedAt,
        returnUrl: `${window.location.origin}/checkout/return`,
        upgradeAccepted,
        carriedOverDays: quote?.carriedOver || 0,
      });
      setPhase('paying');
      if (order?.checkoutUrl) {
        window.location.href = order.checkoutUrl;
        return;
      }
      if (order?.mode === 'simulated') {
        setTestOrder(order);
        return;
      }
      throw new Error('Payment gateway checkout URL not received. Please try again.');
    } catch (reason) {
      setPhase('ready');
      setError(reason?.message || 'The payment could not be started. Try again.');
    }
  };

  // The test payment window reports how the order ended.
  const testSettled = outcome => {
    setTestOrder(null);
    if (outcome?.status === 'paid') { setResult(outcome); setPhase('paid'); return; }
    setPhase('ready');
    if (outcome?.status === 'expired') setError('This payment window expired before it was paid. Nothing was charged. Start again.');
    else if (outcome?.lastAttempt === 'FAILED') setError('The payment was declined. Nothing was charged. Try again or use another method.');
    else setError('The payment was cancelled. Nothing was charged.');
  };

  const requestByHand = async () => {
    setError('');
    const { error: insertError } = await website().from('upgrade_requests').insert({ plan_id: planKey, message: `Checkout request: ${period}, ${currency}` });
    if (insertError) setError('Your request could not be sent. Try again in a moment.');
    else setRequested(true);
  };

  if (!session || phase === 'loading') {
    return <div className="grid min-h-[80dvh] place-items-center pt-24" role="status" aria-label="Preparing checkout"><CircleNotch size={36} className="animate-spin text-brand-sky"/></div>;
  }

  return <section className="mx-auto max-w-page px-5 pb-24 pt-32 md:px-8">
    <AnimatePresence mode="wait">
      {phase === 'paid' ? <motion.div key="paid"><Success planName={(result?.plan || result?.planId || planKey) === 'ultimate' ? 'Ultimate' : 'Pro'} periodEnd={result?.periodEnd}/></motion.div> : null}
      {phase === 'verifying' ? <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Waiting title="Confirming your payment" body="Checking payment confirmation. This usually takes a few seconds; please keep this page open."/></motion.div> : null}
      {phase === 'pending' ? <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Waiting title="Waiting for confirmation" body="Payment has not been confirmed yet. You can close this page: your plan switches on automatically when the payment clears, and your account shows it.">
          <p className="mt-4 font-mono text-[12.5px] text-fg-dim">Order {result?.orderId}</p>
          <div className="mt-6 flex justify-center gap-3"><button type="button" className="btn btn--glass btn--sm" onClick={() => settle(result?.retryId || 'latest')}>Check again</button><Link to="/account" className="btn btn--glass btn--sm">Your account</Link></div>
        </Waiting>
      </motion.div> : null}
      {['ready', 'creating', 'paying'].includes(phase) ? <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <Link to="/pricing" className="inline-flex items-center gap-1.5 text-[14px] text-fg-muted hover:text-fg"><ArrowLeft size={15}/>All plans</Link>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,3rem)]">Checkout</h1>
        {config?.mode === 'simulated' ? <p className="mt-3 inline-flex items-start gap-2 rounded-[14px] bg-brand-amber/10 px-3 py-1.5 text-[13px] text-brand-amber shadow-[inset_0_0_0_1px_rgba(245,185,66,0.35)]"><Flask size={15} className="mt-0.5 shrink-0"/>Test mode: payments are simulated until the live payment provider is connected. No money moves, and your plan switches on as it would after a real payment.</p> : null}
        {config?.mode === 'sandbox' || config?.mode === 'test_mode' ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-3 py-1.5 text-[13px] text-brand-amber shadow-[inset_0_0_0_1px_rgba(245,185,66,0.35)]"><Info size={15}/>Test mode: test cards or UPI are enabled; no real money moves.</p> : null}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card relative overflow-hidden p-7 sm:p-9" style={{ background: planKey === 'ultimate' ? 'linear-gradient(145deg, rgba(155,123,255,0.18), rgba(255,255,255,0.02) 60%)' : 'linear-gradient(145deg, rgba(47,123,255,0.18), rgba(255,255,255,0.02) 60%)' }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Segmented label="Plan" value={planKey} onChange={setPlan} options={[{ value: 'pro', label: 'Pro' }, { value: 'ultimate', label: 'Ultimate' }]}/>
              <Segmented label="Checkout period" value={period} onChange={setPeriod} options={[{ value: 'month', label: '1 month' }, { value: 'year', label: '12 months', note: '2 free' }]}/>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Crown size={26} weight="fill" className={planKey === 'ultimate' ? 'text-brand-violet' : 'text-brand-sky'}/>
              <h2 className="text-[26px] font-semibold">{planName}</h2>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <motion.span key={`${planKey}${period}${currency}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[52px] font-semibold leading-none tracking-[-0.03em]">{shown ? formatMoney(shown.amount, currency) : '-'}</motion.span>
              <span className="pb-1.5 text-[15px] text-fg-muted">for {period === 'year' ? '12 months' : '1 month'} <span className="text-[12.5px] text-fg-dim">(+ taxes)</span></span>
              <span className="ml-auto pb-1"><Segmented label="Checkout currency" value={currency} onChange={value => { setCurrency(value); if (value === 'INR') { setCountryIso('IN'); if (number) setNumber(formatPhoneDisplay('IN', number)); } else if (countryIso === 'IN') { setCountryIso('US'); if (number) setNumber(formatPhoneDisplay('US', number)); } }} options={[{ value: 'INR', label: '₹' }, { value: 'USD', label: '$' }]}/></span>
            </div>
            {period === 'year' && monthlyEquivalent ? <p className="mt-2 text-[14px] text-brand-mint">You save {formatMoney(monthlyEquivalent.amount * 12 - (shown?.amount || 0), currency)} compared with paying monthly.</p> : null}
            
            <p className="mt-3 flex items-start gap-2 rounded-field bg-white/[0.04] p-3 text-[13px] text-fg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <Info size={16} className="mt-0.5 shrink-0 text-brand-sky" />
              <span>For payments in a foreign currency or international cards, standard conversion charges may apply according to your bank.</span>
            </p>

            {currency !== chargeCurrency && charged ? <p className="mt-3 flex items-start gap-2 rounded-field bg-white/[0.04] p-3 text-[13.5px] text-fg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"><Info size={16} className="mt-0.5 shrink-0"/>You will be charged in Indian rupees: {formatMoney(charged.amount, chargeCurrency)} (+ applicable taxes). Your bank converts it at its own rate.</p> : null}
            <ul className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {planPoints.map(point => <li key={point} className="flex gap-2 text-[14.5px] text-fg-soft"><Check size={17} weight="bold" className="mt-0.5 shrink-0 text-brand-mint"/>{point}</li>)}
            </ul>
            <div className="mt-7 flex items-start gap-3 rounded-field bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              {whatHappens?.tone === 'warn' ? <WarningCircle size={20} className="mt-0.5 shrink-0 text-brand-amber"/> : <CalendarCheck size={20} className="mt-0.5 shrink-0 text-brand-mint"/>}
              <p className="text-[14.5px] leading-relaxed text-fg-soft">{whatHappens ? whatHappens.text : 'Checking your current plan…'}</p>
            </div>
            <p className="mt-4 text-[12.5px] text-fg-dim">*Fair-use ceiling of 2,000 Mission AI messages a day. Prepaid + applicable taxes: nothing renews automatically.</p>
          </div>

          <div className="card p-7 sm:p-9">
            <h2 className="flex items-center gap-2 text-[19px] font-semibold"><CreditCard size={20} className="text-brand-sky"/>Payment details</h2>
            {config && !config.enabled
              ? <div className="mt-6">
                <p className="rounded-field bg-brand-amber/10 p-4 text-[14.5px] leading-relaxed text-[#fde2a8] shadow-[inset_0_0_0_1px_rgba(245,185,66,0.35)]">{config.unreachable ? 'The payment service could not be reached.' : 'Online payment is being switched on.'} Leave a request and we will activate {planName} for you by hand once payment is arranged.</p>
                {requested
                  ? <p className="mt-5 flex items-center gap-2 text-[15px] text-brand-mint" role="status"><Check size={18} weight="bold"/>Request sent. We will contact you at {session?.user?.email}.</p>
                  : <button type="button" className="btn btn--primary btn--lg mt-5 w-full" onClick={requestByHand}>Request {planName}</button>}
              </div>
              : <form className="mt-6 flex flex-col gap-5" onSubmit={event => { event.preventDefault(); void pay(); }} noValidate>
                <label className="flex flex-col gap-2"><span className="text-[14px] font-medium text-fg-soft">Account</span><input className="field opacity-80" value={session?.user?.email || ''} readOnly aria-readonly="true"/></label>
                <label className="flex flex-col gap-2"><span className="text-[14px] font-medium text-fg-soft">Name on the receipt</span><input className="field" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100}/></label>
                
                <div className="flex flex-col gap-2">
                  <label htmlFor="checkout-country" className="flex items-center justify-between text-[14px] font-medium text-fg-soft">
                    <span>Country / Region</span>
                    {currentCountry.iso === 'IN' ? (
                      <span className="text-[12px] font-medium text-brand-mint">India • 18% GST</span>
                    ) : (
                      <span className="text-[12px] font-medium text-brand-sky">{currentCountry.iso === 'OTHER' ? 'Global' : currentCountry.iso} • {currency}</span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      id="checkout-country"
                      aria-label="Country or region"
                      className="field w-full cursor-pointer appearance-none pr-10"
                      value={countryIso}
                      onChange={e => {
                        const nextIso = e.target.value;
                        setCountryIso(nextIso);
                        if (nextIso === 'IN') {
                          setCurrency('INR');
                        } else if (currency === 'INR') {
                          setCurrency('USD');
                        }
                        if (number) {
                          setNumber(formatPhoneDisplay(nextIso, number));
                        }
                      }}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.iso} value={c.iso} className="bg-[#12141a] text-fg">
                          {c.flag} {c.country} ({c.code === 'other' ? 'Global' : c.code})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-fg-muted">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="checkout-phone" className="flex items-center justify-between text-[14px] font-medium text-fg-soft">
                    <span>Mobile number</span>
                    {currentCountry.iso === 'IN' ? (
                      <span className="font-mono text-[11.5px] text-fg-dim">10 digits</span>
                    ) : null}
                  </label>
                  <div className="flex gap-2">
                    <div className="field flex w-[100px] shrink-0 select-none items-center justify-center gap-1.5 rounded-field border border-white/10 bg-white/[0.02] px-2.5 text-[14px] text-fg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                      <span className="text-[16px]">{currentCountry.flag}</span>
                      <span className="font-mono font-medium text-fg">{currentCountry.code === 'other' ? '+' : currentCountry.code}</span>
                    </div>
                    <input
                      id="checkout-phone"
                      className="field flex-1"
                      inputMode={currentCountry.iso === 'IN' ? 'numeric' : 'tel'}
                      autoComplete="tel-national"
                      placeholder={currentCountry.placeholder}
                      maxLength={currentCountry.iso === 'IN' ? 11 : 22}
                      value={number}
                      onChange={e => {
                        const formatted = formatPhoneDisplay(countryIso, e.target.value);
                        setNumber(formatted);
                      }}
                      onBlur={() => setTouched(true)}
                      aria-invalid={touched && !phoneOk}
                      aria-describedby="checkout-phone-help"
                    />
                  </div>
                  <small id="checkout-phone-help" className={`text-[13px] transition-colors ${touched && !phoneOk ? 'font-medium text-[#ffb3b3]' : 'text-fg-dim'}`}>
                    {touched && !phoneOk
                      ? (currentCountry.iso === 'IN'
                          ? 'Enter a valid 10-digit Indian mobile number (e.g. 98765 43210).'
                          : `Enter a valid mobile or phone number for ${currentCountry.country}.`)
                      : (currentCountry.iso === 'IN'
                          ? '10-digit mobile number for order receipt and account sync.'
                          : currentCountry.hint || 'The payment provider requires it to process checkout.')}
                  </small>
                </div>
                {quote?.kind === 'upgrade' && quote?.carriedOver > 0 ? (
                  <div className="rounded-field bg-brand-violet/10 p-4 shadow-[inset_0_0_0_1px_rgba(155,123,255,0.35)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#d6ccff]">
                        <Crown size={18} weight="fill" className="text-brand-violet"/>
                        Pro-rated Plan Upgrade Conversion
                      </p>
                      <Link to="/upgrades" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-sky hover:underline" target="_blank" rel="noreferrer">
                        Learn how it works <ArrowSquareOut size={13}/>
                      </Link>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-fg-soft">
                      Your unused Pro plan value is automatically converted into <strong>{quote.carriedOver} days of Ultimate</strong> and added to this <strong>{period === 'year' ? '12 months' : '1 month'}</strong> purchase, giving you total Ultimate access until <strong>{formatDate(quote.endsAt)}</strong>.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-brand-violet accent-brand-violet focus:ring-brand-violet"
                        checked={upgradeAccepted}
                        onChange={e => setUpgradeAccepted(e.target.checked)}
                      />
                      <span className="text-[13px] leading-snug text-fg">
                        I accept the conversion of my remaining Pro time into {quote.carriedOver} days of Ultimate for this purchase.
                      </span>
                    </label>
                  </div>
                ) : null}

                <div className="rounded-field border border-white/10 bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  <label className="flex cursor-pointer items-start gap-3 select-none">
                    <input
                      id="checkout-policy-accept"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-brand-sky accent-brand-sky focus:ring-brand-sky cursor-pointer"
                      checked={policyAccepted}
                      onChange={e => {
                        setPolicyAccepted(e.target.checked);
                        if (error && /terms|policy|policies/i.test(error)) setError('');
                      }}
                    />
                    <span className="text-[13px] leading-relaxed text-fg-soft">
                      I have read and agree to the{' '}
                      <Link to="/terms" className="text-brand-sky underline hover:text-white" target="_blank" rel="noreferrer">
                        Terms of Service
                      </Link>
                      ,{' '}
                      <Link to="/refunds" className="text-brand-sky underline hover:text-white" target="_blank" rel="noreferrer">
                        Refund &amp; Cancellation Policy
                      </Link>
                      , and{' '}
                      <Link to="/privacy" className="text-brand-sky underline hover:text-white" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </Link>
                      , and acknowledge that payment processing is securely fulfilled by <strong>Dodo Payments</strong> as Merchant of Record.
                    </span>
                  </label>
                </div>

                <AnimatePresence>{error ? <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-field bg-brand-red/10 px-4 py-3 text-[14px] text-[#ffb3b3] shadow-[inset_0_0_0_1px_rgba(255,95,95,0.4)]">{error}</motion.p> : null}</AnimatePresence>
                <button type="submit" className="btn btn--primary btn--lg w-full" disabled={!config || !quote || quote.blocked || !charged || phase !== 'ready' || needsUpgradeAcceptance || !policyAccepted}>
                  {phase === 'creating' || phase === 'paying' ? <CircleNotch size={18} className="animate-spin"/> : <Lock size={17} weight="bold"/>}
                  {phase === 'creating' ? 'Starting secure checkout…' : phase === 'paying' ? 'Complete the payment in the window' : charged ? `Pay ${formatMoney(charged.amount, chargeCurrency, { exact: false })} + taxes` : 'Pay'}
                </button>
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-fg-dim"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-mint"/>{config?.mode === 'simulated' ? 'Test mode: the payment window is simulated and nothing you type in it is sent anywhere.' : 'Payments are processed securely by Dodo Payments, which acts as OUTARCH\'s Merchant of Record and payment provider. OUTARCH never sees or stores your card, banking credentials, or UPI PINs.'}</p>
              </form>}
          </div>
        </div>
      </motion.div> : null}
    </AnimatePresence>
    <AnimatePresence>
      {testOrder ? <TestGateway
        key={testOrder.orderId}
        order={testOrder}
        planName={testOrder.planName || planName}
        periodLabel={period === 'year' ? '12 months' : '1 month'}
        email={session?.user?.email || ''}
        onSettled={testSettled}
        onClose={() => { setTestOrder(null); setPhase('ready'); setError('The payment was cancelled. Nothing was charged.'); }}
      /> : null}
    </AnimatePresence>
  </section>;
}
