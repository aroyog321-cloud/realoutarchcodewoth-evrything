import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bank, CircleNotch, CreditCard, Flask, Lock, QrCode, Wallet, X } from '@phosphor-icons/react';
import { EASE } from './ui.jsx';
import { formatMoney } from '../lib/currency.js';
import { billing } from '../lib/billing.js';

// The test payment window. It stands in for Dodo Payments checkout until the
// real gateway is set up: it looks and behaves like a payment window, but no
// money moves and nothing typed here is sent anywhere. Paying settles the
// order through the billing function, which switches the plan on exactly as a
// real payment would. The billing function refuses it once live payments are active.

const METHODS = [
  { id: 'upi', label: 'UPI', icon: QrCode },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'netbanking', label: 'Netbanking', icon: Bank },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'];
const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'MobiKwik'];

function digits(value, max) {
  return value.replace(/\D/g, '').slice(0, max);
}

function cardNumber(value) {
  return digits(value, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function expiry(value) {
  const raw = digits(value, 4);
  return raw.length > 2 ? `${raw.slice(0, 2)} / ${raw.slice(2)}` : raw;
}

function validFor(method, fields) {
  if (method === 'upi') return /^[\w.-]{2,}@[A-Za-z]{2,}$/.test(fields.upi.trim());
  if (method === 'card') {
    const [mm, yy] = [Number(fields.expiry.slice(0, 2)), fields.expiry.replace(/\D/g, '').slice(2)];
    return digits(fields.card, 16).length === 16 && mm >= 1 && mm <= 12 && yy.length === 2 && digits(fields.cvv, 4).length >= 3 && fields.holder.trim().length >= 2;
  }
  if (method === 'netbanking') return Boolean(fields.bank);
  return Boolean(fields.wallet);
}

export default function TestGateway({ order, planName, periodLabel, email, onSettled, onClose }) {
  const [method, setMethod] = useState('upi');
  const [fields, setFields] = useState({ upi: '', card: '', expiry: '', cvv: '', holder: '', bank: '', wallet: '' });
  const [busy, setBusy] = useState('');
  const busyRef = useRef('');
  busyRef.current = busy;
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const set = key => event => setFields(value => ({ ...value, [key]: event.target.value }));
  const ok = validFor(method, fields);

  // Escape cancels, as in a real payment window; the page behind stays put.
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape' && !busyRef.current) void settle('cancelled'); };
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    window.__lenis?.stop?.();
    dialog.current?.focus();
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; window.__lenis?.start?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function settle(result) {
    if (busyRef.current) return;
    setBusy(result);
    setError('');
    try {
      // A short pause reads like a bank answering and keeps a double click from sending twice.
      if (result !== 'cancelled') await new Promise(resolve => setTimeout(resolve, 1200));
      const outcome = await billing.simulate(order.orderId, result === 'success' ? 'paid' : result, method);
      onSettled(outcome);
    } catch (reason) {
      setBusy('');
      if (result === 'cancelled') onClose();
      else setError(reason?.message || 'The test payment could not be completed. Try again.');
    }
  }

  const pay = event => {
    event.preventDefault();
    if (!ok || busy) return;
    void settle('success');
  };

  return <motion.div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent="">
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-gateway-title"
      tabIndex={-1}
      className="relative w-full max-w-[460px] overflow-hidden rounded-[22px] bg-ink-800 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_40px_120px_-30px_rgba(0,0,0,0.95)] outline-none"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex items-center gap-2 bg-brand-amber/10 px-5 py-2.5 text-[12.5px] font-medium text-brand-amber shadow-[inset_0_-1px_0_rgba(245,185,66,0.25)]">
        <Flask size={15} weight="fill"/>Test payment. No money moves and card details are not sent anywhere.
      </div>
      <header className="flex items-start gap-3 px-6 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-fg-dim">Paying OUTARCH</p>
          <h2 id="test-gateway-title" className="mt-0.5 text-[20px] font-semibold">{planName} · {periodLabel}</h2>
          <p className="mt-0.5 truncate text-[13px] text-fg-muted">{email}</p>
        </div>
        <div className="text-right">
          <p className="text-[24px] font-semibold tracking-[-0.02em]">{formatMoney(order.amount, order.currency, { exact: true })}</p>
          <p className="font-mono text-[11px] text-fg-dim">{order.orderId}</p>
        </div>
        <button type="button" onClick={() => void settle('cancelled')} disabled={Boolean(busy)} className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-white/[0.07] hover:text-fg" aria-label="Cancel payment"><X size={18}/></button>
      </header>

      <div className="px-6">
        <div className="grid grid-cols-4 gap-1.5 rounded-[14px] bg-black/30 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" role="tablist" aria-label="Payment method">
          {METHODS.map(item => {
            const Icon = item.icon;
            const active = method === item.id;
            return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => { setMethod(item.id); setError(''); }} disabled={Boolean(busy)} className={`relative flex flex-col items-center gap-1 rounded-[10px] py-2.5 text-[12.5px] font-medium transition-colors ${active ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}>
              {active ? <motion.span layoutId="test-gateway-method" className="absolute inset-0 rounded-[10px] bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }}/> : null}
              <Icon size={19} weight={active ? 'fill' : 'regular'} className="relative"/><span className="relative">{item.label}</span>
            </button>;
          })}
        </div>
      </div>

      <form className="px-6 pb-6 pt-5" onSubmit={pay} noValidate>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={method} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22, ease: EASE }} className="flex min-h-[176px] flex-col gap-4">
            {method === 'upi' ? <>
              <label className="flex flex-col gap-2"><span className="text-[13.5px] font-medium text-fg-soft">UPI ID</span><input className="field" value={fields.upi} onChange={set('upi')} placeholder="yourname@okbank" autoComplete="off" spellCheck={false} disabled={Boolean(busy)}/></label>
              <p className="text-[13px] leading-relaxed text-fg-dim">In a real payment your UPI app would ask you to approve it. Here, any ID in the form name@bank works.</p>
            </> : null}
            {method === 'card' ? <>
              <label className="flex flex-col gap-2"><span className="text-[13.5px] font-medium text-fg-soft">Card number</span><input className="field font-mono" inputMode="numeric" value={fields.card} onChange={event => setFields(value => ({ ...value, card: cardNumber(event.target.value) }))} placeholder="4111 1111 1111 1111" autoComplete="off" disabled={Boolean(busy)}/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2"><span className="text-[13.5px] font-medium text-fg-soft">Expiry</span><input className="field font-mono" inputMode="numeric" value={fields.expiry} onChange={event => setFields(value => ({ ...value, expiry: expiry(event.target.value) }))} placeholder="MM / YY" autoComplete="off" disabled={Boolean(busy)}/></label>
                <label className="flex flex-col gap-2"><span className="text-[13.5px] font-medium text-fg-soft">CVV</span><input className="field font-mono" inputMode="numeric" type="password" value={fields.cvv} onChange={event => setFields(value => ({ ...value, cvv: digits(event.target.value, 4) }))} placeholder="123" autoComplete="off" disabled={Boolean(busy)}/></label>
              </div>
              <label className="flex flex-col gap-2"><span className="text-[13.5px] font-medium text-fg-soft">Name on card</span><input className="field" value={fields.holder} onChange={set('holder')} autoComplete="off" disabled={Boolean(busy)}/></label>
            </> : null}
            {method === 'netbanking' ? <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Bank">
              {BANKS.map(bank => <button key={bank} type="button" role="radio" aria-checked={fields.bank === bank} onClick={() => setFields(value => ({ ...value, bank }))} disabled={Boolean(busy)} className={`rounded-field px-4 py-2.5 text-left text-[14px] transition-colors ${fields.bank === bank ? 'bg-brand-blue/15 text-fg shadow-[inset_0_0_0_1px_rgba(47,123,255,0.6)]' : 'bg-white/[0.03] text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.06]'}`}>{bank}</button>)}
            </div> : null}
            {method === 'wallet' ? <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Wallet">
              {WALLETS.map(wallet => <button key={wallet} type="button" role="radio" aria-checked={fields.wallet === wallet} onClick={() => setFields(value => ({ ...value, wallet }))} disabled={Boolean(busy)} className={`rounded-field px-4 py-3 text-[14px] transition-colors ${fields.wallet === wallet ? 'bg-brand-blue/15 text-fg shadow-[inset_0_0_0_1px_rgba(47,123,255,0.6)]' : 'bg-white/[0.03] text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.06]'}`}>{wallet}</button>)}
            </div> : null}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>{error ? <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-4 rounded-field bg-brand-red/10 px-4 py-3 text-[13.5px] text-[#ffb3b3] shadow-[inset_0_0_0_1px_rgba(255,95,95,0.4)]">{error}</motion.p> : null}</AnimatePresence>

        <button type="submit" className="btn btn--primary btn--lg mt-5 w-full" disabled={!ok || Boolean(busy)}>
          {busy === 'success' ? <CircleNotch size={18} className="animate-spin"/> : <Lock size={17} weight="bold"/>}
          {busy === 'success' ? 'Processing…' : `Pay ${formatMoney(order.amount, order.currency, { exact: true })}`}
        </button>
        <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
          <button type="button" className="text-fg-muted hover:text-fg disabled:opacity-50" onClick={() => void settle('failed')} disabled={Boolean(busy)}>{busy === 'failed' ? 'Declining…' : 'Test a declined payment'}</button>
          <button type="button" className="text-fg-muted hover:text-fg disabled:opacity-50" onClick={() => void settle('cancelled')} disabled={Boolean(busy)}>Cancel</button>
        </div>
      </form>
    </motion.div>
  </motion.div>;
}
