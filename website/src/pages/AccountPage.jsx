import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowClockwise, ArrowSquareOut, CalendarBlank, Check, Code, Crown, DeviceMobile, DownloadSimple, Key, Lock, Receipt, ShieldCheck, SignOut, Sparkle, WindowsLogo,
} from '@phosphor-icons/react';
import { Button, EASE, Reveal } from '../components/ui.jsx';
import { billing } from '../lib/billing.js';
import { priceOf, useCatalog, VS_CODE_MARKETPLACE_URL } from '../lib/catalog.js';
import { formatMoney, useCurrency } from '../lib/currency.js';
import { Link, useRouter } from '../lib/router.jsx';
import { website } from '../lib/supabase.js';

// Who is signed in on the website, the plan the OUTARCH app honours, how much
// of it is used, and every payment. The app reads the same record, so what
// this page says is exactly what the app allows.

function formatDate(value) {
  const at = Date.parse(value || '');
  return Number.isFinite(at) ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

function limitRows(entitlements) {
  const limits = entitlements?.limits || {};
  const unlimited = value => value === null || value === undefined;
  const trial = entitlements?.recipeTrial;
  const trialEnded = trial?.endsAt && Date.parse(trial.endsAt) < Date.now();
  return [
    ['Terminals at once', unlimited(limits.terminals) ? 'Unlimited' : String(limits.terminals)],
    ['Projects', limits.projectSwitching ? 'All projects' : 'One project'],
    ['Your own AI keys', limits.byokKeys === 0 ? 'Not included' : unlimited(limits.byokKeys) ? 'Unlimited' : `${limits.byokKeys} key${limits.byokKeys === 1 ? '' : 's'}`],
    ['Recipes', trial ? (trialEnded ? 'Trial ended' : `${limits.recipes} · trial ends ${formatDate(trial.endsAt)}`) : unlimited(limits.recipes) ? 'Unlimited' : String(limits.recipes)],
    ['Secure MCP', limits.mcp === 'full' ? 'Full access' : limits.mcp === 'read' ? 'Read-only tools' : 'Not included'],
    ['Mobile companion', limits.mobileCompanion ? 'Included' : 'Not included'],
    ['VS Code bridge', limits.vscodeBridge ? 'Included' : 'Not included'],
  ];
}

const STATUS = {
  paid: ['Paid', 'text-brand-green bg-brand-green/10 shadow-[inset_0_0_0_1px_rgba(50,213,131,0.35)]'],
  active: ['Paid', 'text-brand-green bg-brand-green/10 shadow-[inset_0_0_0_1px_rgba(50,213,131,0.35)]'],
  completed: ['Paid', 'text-brand-green bg-brand-green/10 shadow-[inset_0_0_0_1px_rgba(50,213,131,0.35)]'],
  created: ['Not completed', 'text-fg-muted bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'],
  pending: ['Pending', 'text-brand-amber bg-brand-amber/10 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]'],
  failed: ['Failed', 'text-[#ffb3b3] bg-brand-red/10 shadow-[inset_0_0_0_1px_rgba(255,95,95,0.35)]'],
  expired: ['Expired', 'text-fg-dim bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'],
  refunded: ['Refunded', 'text-brand-sky bg-brand-blue/10 shadow-[inset_0_0_0_1px_rgba(47,123,255,0.35)]'],
  canceled: ['Cancelled', 'text-fg-dim bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'],
  cancelled: ['Cancelled', 'text-fg-dim bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'],
};

// Everything the account service holds about the signed-in person, read with
// their own session (row level security lets each account read only its own
// rows), as one JSON file. Nothing here needs a server change; a table that
// cannot be read is noted in the file instead of failing the whole export.
const EXPORT_TABLES = [
  ['profile', 'profiles', 'id'],
  ['subscription', 'subscriptions', 'user_id'],
  ['usageCounters', 'usage_counters', 'user_id'],
  ['planRequests', 'upgrade_requests', 'user_id'],
  ['payments', 'payments', 'user_id'],
];

async function exportAccountData(userId, entitlements) {
  const client = website();
  const out = {
    exportedAt: new Date().toISOString(),
    note: 'Your OUTARCH account data as held by the account service. Projects, code, terminal output and keys stay on your computer and are not included.',
    account: entitlements?.user || null,
    plan: entitlements?.plan || null,
    limits: entitlements?.limits || null,
  };
  for (const [name, table, column] of EXPORT_TABLES) {
    const { data, error } = await client.from(table).select('*').eq(column, userId);
    out[name] = error ? { error: 'Could not be read. Ask us for it and we will send it.' } : data;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `outarch-account-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AccountSecurity({ email, provider }) {
  const [resetState, setResetState] = useState('idle');
  const [resetMessage, setResetMessage] = useState('');

  const triggerReset = async () => {
    if (!email) return;
    setResetState('working');
    setResetMessage('');
    try {
      const returnUrl = new URL(window.location.origin + '/auth');
      returnUrl.searchParams.set('mode', 'reset-set');
      const { error } = await website().auth.resetPasswordForEmail(email, {
        redirectTo: returnUrl.toString(),
      });
      if (error) throw error;
      setResetState('sent');
      setResetMessage(`Password reset link sent to ${email}. Check your inbox.`);
    } catch (err) {
      setResetState('failed');
      setResetMessage(err?.message || 'Could not send reset link. Try again later.');
    }
  };

  if (provider === 'google') return null;

  return <div className="card mt-6 p-7 sm:p-9">
    <h2 className="flex items-center gap-2 text-[19px] font-semibold"><Key size={20} className="text-brand-sky"/>Security & Password</h2>
    <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-fg-muted">Manage your password and sign-in credentials. A recovery link will let you choose a new password.</p>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-field bg-white/[0.03] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">Change password</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">We will email you a secure link to choose a new password.</p>
        {resetMessage ? <p className={`mt-1 min-h-[18px] text-[12.5px] ${resetState === 'sent' ? 'text-brand-mint' : 'text-[#ffb3b3]'}`} role="status">{resetMessage}</p> : null}
      </div>
      <button type="button" onClick={triggerReset} disabled={resetState === 'working'} className="btn btn--glass btn--sm"><Key size={15}/>{resetState === 'working' ? 'Sending…' : resetState === 'sent' ? 'Send link again' : 'Send password reset link'}</button>
    </div>
  </div>;
}

function YourData({ entitlements }) {
  const [state, setState] = useState('idle');
  const download = async () => {
    setState('working');
    try {
      const { data } = await website().auth.getUser();
      if (!data?.user) throw new Error('signed out');
      await exportAccountData(data.user.id, entitlements);
      setState('done');
    } catch { setState('failed'); }
  };
  return <div className="card mt-6 p-7 sm:p-9">
    <h2 className="flex items-center gap-2 text-[19px] font-semibold"><ShieldCheck size={20} className="text-brand-mint"/>Your data</h2>
    <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-fg-muted">We hold your email, plan, usage counts and any plan requests or payments. Your projects, code and keys stay on your computer. <Link to="/privacy" className="link-underline text-fg">Privacy policy</Link> · <Link to="/data-retention" className="link-underline text-fg">Retention and deletion</Link></p>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-field bg-white/[0.03] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">Download a copy</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">Everything the account service holds about you, as a JSON file.</p>
        <p className="mt-1 min-h-[18px] text-[12.5px] text-fg-dim" role="status">{state === 'done' ? 'Downloaded.' : state === 'failed' ? 'The download failed. Sign in again and retry.' : ''}</p>
      </div>
      <button type="button" onClick={() => void download()} disabled={state === 'working'} className="btn btn--glass btn--sm"><DownloadSimple size={15}/>{state === 'working' ? 'Preparing…' : 'Download my data'}</button>
    </div>
  </div>;
}

function daysLeft(value) {
  const at = Date.parse(value || '');
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - Date.now()) / 86400000)) : null;
}

// Four numbers at the top of the dashboard.
function Summary({ plan, paid, ends, usedText, paymentsCount, totalPaymentsCount, onScrollToBilling }) {
  const days = daysLeft(ends);
  const paymentsSubtitle = totalPaymentsCount && totalPaymentsCount > paymentsCount
    ? `${paymentsCount} paid · ${totalPaymentsCount} total`
    : paymentsCount ? 'View billing history' : 'None yet';
  const tiles = [
    { icon: Crown, label: 'Plan', value: plan.name, note: paid ? 'Prepaid' : 'Free forever' },
    { icon: CalendarBlank, label: 'Time left', value: paid ? (days == null ? 'No end date' : `${days} day${days === 1 ? '' : 's'}`) : 'Forever', note: paid && ends ? `Until ${formatDate(ends)}` : 'Never ends' },
    { icon: Sparkle, label: 'Mission AI today', value: usedText, note: 'Resets every day' },
    { icon: Receipt, label: 'Payments', value: String(paymentsCount), note: paymentsSubtitle, clickable: true, onClick: onScrollToBilling },
  ];
  return <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
    {tiles.map(({ icon: Icon, label, value, note, clickable, onClick }) => {
      if (clickable) {
        return <button
          key={label}
          type="button"
          onClick={onClick}
          className="card group cursor-pointer p-5 text-left transition-all hover:border-brand-sky/40 hover:bg-white/[0.04]"
          title="Jump to Billing history"
        >
          <p className="flex items-center justify-between text-[13px] text-fg-muted group-hover:text-brand-sky">
            <span className="flex items-center gap-2"><Icon size={15}/>{label}</span>
            <span className="text-[11.5px] font-medium text-brand-sky/80 opacity-80 transition-opacity group-hover:opacity-100">View ↓</span>
          </p>
          <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.02em]">{value}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-fg-dim group-hover:text-fg-soft">{note}</p>
        </button>;
      }
      return <div key={label} className="card p-5">
        <p className="flex items-center gap-2 text-[13px] text-fg-muted"><Icon size={15}/>{label}</p>
        <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.02em]">{value}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-fg-dim">{note}</p>
      </div>;
    })}
  </div>;
}

const UPGRADE_POINTS = {
  pro: ['8 terminals at once', 'Unlimited projects', 'Unlimited Mission AI*', 'Mobile companion'],
  ultimate: ['Unlimited terminals', 'Unlimited recipes and AI keys', 'Full MCP gateway', 'VS Code bridge and mobile companion'],
};

// Shown to a Free account: the two paid plans, straight to checkout.
function Subscribe() {
  const catalog = useCatalog();
  const [currency] = useCurrency();
  return <div className="card relative mt-6 overflow-hidden p-7 sm:p-9" style={{ background: 'linear-gradient(135deg, rgba(155,123,255,0.14), rgba(47,123,255,0.08) 45%, rgba(255,255,255,0.02))' }}>
    <h2 className="flex items-center gap-2 text-[19px] font-semibold"><Crown size={20} weight="fill" className="text-brand-violet"/>Subscribe to unlock more</h2>
    <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-fg-muted">Pay for a month or a year. Your plan switches on as soon as the payment clears, the app picks it up on its own, and nothing renews automatically.</p>
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      {['pro', 'ultimate'].map(id => {
        const price = priceOf(catalog.prices, id, 'month', currency);
        const featured = id === 'ultimate';
        return <div key={id} className="flex flex-col rounded-[18px] bg-black/25 p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[18px] font-semibold"><Crown size={17} weight="fill" className={featured ? 'text-brand-violet' : 'text-brand-sky'}/>{featured ? 'Ultimate' : 'Pro'}</p>
            <div className="text-right">
              <p><span className="text-[22px] font-semibold tracking-[-0.02em]">{price ? formatMoney(price.amount, currency) : '-'}</span><span className="text-[13px] text-fg-muted"> / month</span></p>
              <p className="text-[11px] text-fg-dim">+ taxes</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-1 flex-col gap-2">
            {UPGRADE_POINTS[id].map(point => <li key={point} className="flex gap-2 text-[14px] text-fg-soft"><Check size={16} weight="bold" className="mt-0.5 shrink-0 text-brand-mint"/>{point}</li>)}
          </ul>
          <Button to={`/checkout?plan=${id}&period=month&currency=${currency}`} variant={featured ? 'primary' : 'mint'} className="mt-6 w-full" magnetic={false}>Get {featured ? 'Ultimate' : 'Pro'}</Button>
        </div>;
      })}
    </div>
    <p className="mt-4 text-[12.5px] text-fg-dim">*Fair-use limit of 2,000 Mission AI messages a day. <Link to="/pricing#compare" className="link-underline text-fg-muted hover:text-fg">Compare every limit</Link></p>
  </div>;
}

// The apps this account can use, and what each one needs.
function Apps({ limits, planId }) {
  const mobile = Boolean(limits?.mobileCompanion);
  const vscode = Boolean(limits?.vscodeBridge);
  const row = (Icon, tone, title, body, action) => <div className="flex flex-wrap items-center gap-4 rounded-field bg-white/[0.03] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]" style={{ background: `rgba(${tone},0.12)`, color: `rgb(${tone})`, boxShadow: `inset 0 0 0 1px rgba(${tone},0.35)` }}><Icon size={21} weight="duotone"/></span>
    <div className="mr-auto min-w-0 flex-1"><p className="text-[15.5px] font-medium">{title}</p><p className="mt-0.5 text-[13.5px] leading-relaxed text-fg-muted">{body}</p></div>
    <div className="flex flex-wrap gap-2">{action}</div>
  </div>;
  return <div className="card mt-6 p-7 sm:p-9">
    <h2 className="flex items-center gap-2 text-[19px] font-semibold"><DeviceMobile size={20} className="text-brand-mint"/>Your apps</h2>
    <p className="mt-2 text-[14.5px] text-fg-muted">Sign in to each one with this account and it follows your plan.</p>
    <div className="mt-6 flex flex-col gap-3">
      {row(WindowsLogo, '47,123,255', 'OUTARCH for Windows', 'Sign in from the app: it opens this website and comes back signed in.', <>
        <a href="outarch://account/refresh" className="btn btn--glass btn--sm"><ArrowSquareOut size={15}/>Open OUTARCH</a>
        <Link to="/#download" className="btn btn--glass btn--sm"><DownloadSimple size={15}/>Download</Link>
      </>)}
      {row(DeviceMobile, '63,208,181', 'Mobile companion', mobile ? 'Included in your plan. Pair your phone from OUTARCH, then add it to your home screen.' : 'Comes with Pro and Ultimate.', mobile
        ? <Link to="/mobile" className="btn btn--mint btn--sm"><DeviceMobile size={15}/>Install on your phone</Link>
        : <Link to="/checkout?plan=pro&period=month" className="btn btn--glass btn--sm"><Lock size={15}/>Upgrade to Pro</Link>)}
      {row(Code, '155,123,255', 'VS Code bridge', vscode ? 'Included in your plan. Install from the Visual Studio Marketplace.' : 'Comes with Ultimate. Install from the Visual Studio Marketplace.', vscode
        ? <a href={VS_CODE_MARKETPLACE_URL} target="_blank" rel="noreferrer" className="btn btn--primary btn--sm"><Code size={15}/>Install for VS Code</a>
        : <Link to={`/checkout?plan=ultimate&period=month`} className="btn btn--glass btn--sm"><Lock size={15}/>{planId === 'pro' ? 'Upgrade to Ultimate' : 'Get Ultimate'}</Link>)}
    </div>
  </div>;
}

function Skeleton() {
  return <div className="mx-auto max-w-[980px] px-5 pb-24 pt-36 md:px-8" role="status" aria-label="Loading your account">
    <div className="card h-40 animate-pulse"/>
    <div className="card mt-5 h-72 animate-pulse"/>
  </div>;
}

export default function AccountPage() {
  const { navigate, query } = useRouter();
  const [entitlements, setEntitlements] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paidCount, setPaidCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentsError, setPaymentsError] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setPaymentsError(false);
    try {
      const { data: sessionData } = await website().auth.getSession();
      if (!sessionData?.session) { navigate('/auth?next=/account', { replace: true }); return; }

      const incomingSession = query.get('session_id') || query.get('sessionId') || (query.get('payment') === 'success' ? query.get('order_id') : null);
      if (incomingSession) {
        try {
          const verifyRes = await billing.verify(incomingSession);
          if (verifyRes?.status === 'paid') {
            setPaymentNotice('Payment verified. Your plan is active!');
          }
        } catch {
          // Fallback silently if already verified by webhook
        }
      }

      const userId = sessionData.session.user?.id;

      const [entitlementsResult, paymentsResult, countResult] = await Promise.allSettled([
        website().rpc('get_entitlements'),
        website().from('payments').select('id,plan_id,period,currency,amount,status,provider,payment_method,period_end,created_at,paid_at').order('created_at', { ascending: false }).limit(200),
        website().from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
      ]);

      if (entitlementsResult.status === 'fulfilled') {
        const { data, error: rpcError } = entitlementsResult.value;
        if (rpcError) {
          // A session the server no longer accepts (revoked, or from another
          // project): end it here and sign in again rather than show a broken page.
          if (rpcError.code === 'PGRST301' || /jwt|token/i.test(rpcError.message || '')) {
            await website().auth.signOut({ scope: 'local' });
            navigate('/auth?next=/account', { replace: true });
            return;
          }
          setError('Your plan could not be loaded. Check your connection and try again.');
        } else {
          setEntitlements(data);
        }
      } else {
        setError('Your plan could not be loaded. Check your connection and try again.');
      }

      if (paymentsResult.status === 'fulfilled') {
        const { data: rows, error: pError } = paymentsResult.value;
        if (pError) {
          console.warn('Could not load payments directly, trying fallback query:', pError);
          if (userId) {
            const { data: fallbackRows, error: fallbackErr } = await website()
              .from('payments')
              .select('id,plan_id,period,currency,amount,status,provider,payment_method,period_end,created_at,paid_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(200);
            if (!fallbackErr && fallbackRows) {
              setPayments(fallbackRows);
              const paidRows = fallbackRows.filter(r => r.status === 'paid' || r.status === 'active' || r.status === 'completed');
              setPaidCount(paidRows.length);
            } else {
              setPaymentsError(true);
            }
          } else {
            setPaymentsError(true);
          }
        } else {
          const validRows = rows || [];
          setPayments(validRows);
          if (countResult.status === 'fulfilled' && typeof countResult.value?.count === 'number') {
            setPaidCount(countResult.value.count);
          } else {
            setPaidCount(validRows.filter(r => r.status === 'paid' || r.status === 'active' || r.status === 'completed').length);
          }
        }
      } else {
        setPaymentsError(true);
      }
    } catch (err) {
      setError(err?.message || 'Your account could not be loaded. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [navigate, query]);

  useEffect(() => { void load(); }, [load]);

  const scrollToBilling = useCallback(() => {
    const el = document.getElementById('billing-history');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#billing' || window.location.hash === '#billing-history' || window.location.hash === '#payments')) {
      const timer = setTimeout(scrollToBilling, 250);
      return () => clearTimeout(timer);
    }
  }, [scrollToBilling, loading]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const signOut = async () => { await website().auth.signOut({ scope: 'local' }); navigate('/auth'); };

  if (loading && !entitlements) return <Skeleton/>;

  // Without the plan record nothing below would be true, so say so and offer a retry.
  if (!entitlements) {
    return <section className="mx-auto max-w-[640px] px-5 pb-24 pt-36 text-center md:px-8">
      <h1 className="display text-[clamp(1.8rem,3.4vw,2.4rem)]">Your account could not be loaded</h1>
      <p className="lede mx-auto mt-4 text-[16px]">{error}</p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={refresh} className="btn btn--primary"><ArrowClockwise size={16} className={refreshing ? 'animate-spin' : ''}/>Try again</button>
        <button type="button" onClick={signOut} className="btn btn--glass"><SignOut size={16}/>Sign out</button>
      </div>
    </section>;
  }

  const user = entitlements?.user || {};
  const plan = entitlements?.plan || { id: 'free', name: 'Free' };
  const subscription = entitlements?.subscription || {};
  const usage = entitlements?.usage?.missionAiMessages || {};
  const paid = plan.id !== 'free';
  const ends = subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '';
  const limit = entitlements?.limits?.missionAiMessages;
  const used = usage.used || 0;
  const accent = plan.id === 'ultimate' ? '155,123,255' : plan.id === 'pro' ? '47,123,255' : '63,208,181';

  const displayedPayments = filter === 'paid'
    ? payments.filter(r => r.status === 'paid' || r.status === 'active' || r.status === 'completed')
    : payments;

  return <section className="mx-auto max-w-[980px] px-5 pb-24 pt-32 md:px-8">
    <Reveal>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-brand-blue text-[22px] font-semibold">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"/> : (Array.from(String(user.name || user.email || 'O'))[0] || 'O').toUpperCase()}
        </span>
        <div className="mr-auto min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-brand-sky">Dashboard</p>
          <h1 className="display truncate text-[clamp(1.6rem,3vw,2.2rem)]">{user.name || user.email || 'Your account'}</h1>
          <p className="truncate text-[14.5px] text-fg-muted">{user.name && user.email ? `${user.email} · ` : ''}Signed in with {user.provider === 'google' ? 'Google' : 'email and password'}</p>
        </div>
        <button type="button" onClick={signOut} className="btn btn--glass btn--sm"><SignOut size={16}/>Sign out</button>
      </div>
    </Reveal>

    <Reveal delay={0.03}><Summary plan={plan} paid={paid} ends={subscription.currentPeriodEnd} usedText={limit == null ? `${used} used` : `${used} of ${limit}`} paymentsCount={paidCount} totalPaymentsCount={payments.length} onScrollToBilling={scrollToBilling}/></Reveal>

    {paymentNotice ? <p className="mt-6 flex items-center gap-2 rounded-field bg-brand-green/10 px-4 py-3 text-[14px] text-brand-green shadow-[inset_0_0_0_1px_rgba(50,213,131,0.35)]" role="status"><Check size={16} weight="bold"/>{paymentNotice}</p> : null}
    {error ? <p className="mt-6 rounded-field bg-brand-red/10 px-4 py-3 text-[14px] text-[#ffb3b3] shadow-[inset_0_0_0_1px_rgba(255,95,95,0.4)]" role="alert">{error}</p> : null}

    <Reveal delay={0.06}>
      <div className="card relative mt-8 overflow-hidden p-7 sm:p-9" style={{ background: `linear-gradient(135deg, rgba(${accent},0.2), rgba(255,255,255,0.02) 60%)` }}>
        <div className="flex flex-wrap items-center gap-5">
          <motion.span initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ duration: 0.8, ease: EASE }} className="grid h-14 w-14 place-items-center rounded-[16px]" style={{ background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, boxShadow: `inset 0 0 0 1px rgba(${accent},0.45)` }}><Crown size={28} weight="fill"/></motion.span>
          <div className="mr-auto">
            <p className="text-[13px] text-fg-muted">Your plan</p>
            <p className="text-[28px] font-semibold tracking-[-0.02em]">{plan.name}</p>
            <p className="text-[14.5px] text-fg-soft">{paid ? (ends ? `Active until ${ends}` : 'Active, no end date') : 'Free forever. Upgrade when you need more.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refresh} className="btn btn--glass btn--sm" aria-label="Check your plan again"><ArrowClockwise size={15} className={refreshing ? 'animate-spin' : ''}/>Refresh</button>
            <a href="outarch://account/refresh" className="btn btn--glass btn--sm"><ArrowSquareOut size={15}/>Open OUTARCH</a>
            {plan.id !== 'ultimate'
              ? <Button to={`/checkout?plan=${plan.id === 'pro' ? 'ultimate' : 'pro'}&period=month`} size="sm" magnetic={false}><Crown size={15} weight="fill"/>Upgrade</Button>
              : ends ? <Button to="/checkout?plan=ultimate&period=month" size="sm" magnetic={false}>Extend Ultimate</Button> : null}
          </div>
        </div>
        <div className="mt-8 rounded-field bg-black/30 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between text-[14px]"><span className="flex items-center gap-2 text-fg-soft"><Sparkle size={16} weight="fill" className="text-brand-violet"/>Mission AI today</span><span className="font-mono text-fg">{limit == null ? `${used} used · unlimited` : `${used} of ${limit}`}</span></div>
          {limit != null ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-brand-violet" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} transition={{ duration: 0.9, ease: EASE }}/></div> : null}
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {limitRows(entitlements).map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-line-soft pb-3"><dt className="text-[14px] text-fg-muted">{label}</dt><dd className="text-right text-[14.5px] text-fg">{value}</dd></div>)}
        </dl>
        <p className="mt-6 text-[13px] text-fg-dim">The app checks your plan when it starts, when its window gets focus and every five minutes. Open OUTARCH makes it check now.</p>
      </div>
    </Reveal>

    {!paid ? <Reveal delay={0.08}><Subscribe/></Reveal> : null}

    <Reveal delay={0.09}><Apps limits={entitlements?.limits} planId={plan.id}/></Reveal>

    <Reveal delay={0.1}>
      <div id="billing-history" className="card mt-6 scroll-mt-24 p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-[19px] font-semibold"><Receipt size={20} className="text-brand-sky"/>Billing history</h2>
            <p className="mt-1 text-[13.5px] text-fg-muted">
              {paidCount} paid {paidCount === 1 ? 'transaction' : 'transactions'}
              {payments.length > paidCount ? ` · ${payments.length - paidCount} uncompleted or draft ${payments.length - paidCount === 1 ? 'checkout' : 'checkouts'}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {payments.length > 0 ? (
              <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${filter === 'all' ? 'bg-white/15 text-white shadow-sm' : 'text-fg-muted hover:text-fg'}`}
                  onClick={() => setFilter('all')}
                >
                  All ({payments.length})
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${filter === 'paid' ? 'bg-brand-mint/20 text-brand-mint shadow-sm' : 'text-fg-muted hover:text-fg'}`}
                  onClick={() => setFilter('paid')}
                >
                  Paid ({paidCount})
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="btn btn--glass btn--sm"
              title="Refresh billing history"
              aria-label="Refresh billing history"
            >
              <ArrowClockwise size={14} className={refreshing ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>

        {paymentsError ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-field bg-brand-red/10 px-4 py-3 text-[13.5px] text-[#ffb3b3] shadow-[inset_0_0_0_1px_rgba(255,95,95,0.35)]" role="alert">
            <span>Could not load billing history. Check your connection and try again.</span>
            <button type="button" onClick={refresh} className="btn btn--glass btn--sm text-white">Retry</button>
          </div>
        ) : null}

        {payments.length > 0 ? (
          displayedPayments.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[14px]">
                <thead>
                  <tr className="text-[12.5px] text-fg-dim">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Order reference</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPayments.map(row => {
                    const [label, style] = STATUS[row.status] || [
                      (row.status || 'Created').charAt(0).toUpperCase() + (row.status || 'Created').slice(1),
                      'text-fg-muted bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    ];
                    return <tr key={row.id} className="border-t border-line-soft">
                      <td className="py-3 text-fg-soft">{formatDate(row.paid_at || row.created_at)}</td>
                      <td className="py-3 capitalize">{row.plan_id || 'Plan'} · {row.period === 'year' ? '12 months' : '1 month'}</td>
                      <td className="py-3 font-mono">{formatMoney(row.amount, row.currency, { exact: true })}</td>
                      <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${style}`}>{label}</span>{row.provider === 'simulated' ? <span className="ml-2 text-[12px] text-brand-amber">Test</span> : null}</td>
                      <td className="py-3 font-mono text-[12.5px] text-fg-dim">{row.id}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 rounded-field bg-white/[0.02] p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <p className="text-[14px] text-fg-muted">
                {filter === 'paid' ? 'No paid transactions found in this view.' : 'No transactions matching this filter.'}
              </p>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="btn btn--glass btn--sm mt-3"
              >
                Show all {payments.length} checkouts
              </button>
            </div>
          )
        ) : (
          <p className="mt-4 text-[14.5px] text-fg-muted">No payments yet. When you buy a plan, the receipt and its order reference appear here.</p>
        )}
      </div>
    </Reveal>

    <Reveal delay={0.11}>
      <AccountSecurity email={user.email} provider={user.provider}/>
    </Reveal>

    <Reveal delay={0.12}>
      <YourData entitlements={entitlements}/>
    </Reveal>
  </section>;
}
