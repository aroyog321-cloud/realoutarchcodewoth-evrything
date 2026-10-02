import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, Crown, Minus } from '@phosphor-icons/react';
import { EVERY_PLAN, LIMIT_ROWS, priceOf } from '../lib/catalog.js';
import { formatMoney } from '../lib/currency.js';
import { Link } from '../lib/router.jsx';
import { Magnetic, Stagger, staggerItem, useSpotlight } from './ui.jsx';

// The two switches above the plans: billing period and currency.
export function Segmented({ value, onChange, options, label }) {
  return <div className="relative inline-flex rounded-full bg-white/[0.05] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`relative z-[1] h-9 rounded-full px-4 text-[14px] font-medium transition-colors ${value === option.value ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}>
      {value === option.value ? <motion.span layoutId={`seg-${label}`} className="absolute inset-0 -z-[1] rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" transition={{ type: 'spring', stiffness: 400, damping: 34 }}/> : null}
      {option.label}{option.note ? <span className="ml-1.5 rounded-full bg-brand-mint/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-mint">{option.note}</span> : null}
    </button>)}
  </div>;
}

export function PricingControls({ period, setPeriod, currency, setCurrency }) {
  return <div className="flex flex-wrap items-center justify-center gap-3">
    <Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly', note: '2 months free' }]}/>
    <Segmented label="Currency" value={currency} onChange={setCurrency} options={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]}/>
  </div>;
}

const COPY = {
  free: { cta: 'Download free', points: ['3 terminals at once', '1 project', 'Mission AI: 3 messages a day', 'Recipes: 1 recipe, 3-day trial', 'Permission alerts and Needs You'] },
  pro: { cta: 'Get Pro', points: ['8 terminals at once', 'Unlimited projects, switch any time', 'Unlimited Mission AI*', '3 recipes', '1 AI key of your own (BYOK)', 'Mobile companion', 'MCP gateway, read-only tools'] },
  ultimate: { cta: 'Get Ultimate', points: ['Unlimited terminals', 'Unlimited projects', 'Unlimited Mission AI*', 'Unlimited recipes', 'Unlimited AI keys of your own', 'Mobile companion', 'Full MCP gateway', 'VS Code bridge'] },
};

function PlanCard({ plan, period, currency, current }) {
  const spotlight = useSpotlight();
  // The recommended plan's ring turns only while the card is on screen.
  const card = useRef(null);
  const inView = useInView(card, { margin: '80px 0px' });
  const featured = plan.id === 'ultimate';
  const price = priceOf(plan.prices, plan.id, period, currency);
  const monthly = priceOf(plan.prices, plan.id, 'month', currency);
  const copy = COPY[plan.id] || { cta: `Get ${plan.name}`, points: [] };
  const isCurrent = current === plan.id;
  const isIncludedInHigher = current === 'ultimate' && plan.id === 'pro';
  const href = plan.id === 'free' ? '/#download' : `/checkout?plan=${plan.id}&period=${period}&currency=${currency}`;
  return <motion.article
    ref={card}
    variants={staggerItem}
    onPointerMove={spotlight}
    className={`card spotlight relative flex flex-col rounded-card p-7 ${featured ? 'bg-[linear-gradient(180deg,rgba(47,123,255,0.12),rgba(155,123,255,0.05)_50%,rgba(255,255,255,0.02))]' : ''}`}
    style={{ '--spot': featured ? '155,123,255' : plan.id === 'pro' ? '47,123,255' : '63,208,181' }}
  >
    {featured ? <span className="ring-border" style={{ animationPlayState: inView ? 'running' : 'paused' }} aria-hidden="true"/> : null}
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-[20px] font-semibold">{plan.id !== 'free' ? <Crown size={18} weight="fill" className={featured ? 'text-brand-violet' : 'text-brand-sky'}/> : null}{plan.name}</h3>
      {isCurrent ? <span className="chip">Your plan</span> : isIncludedInHigher ? <span className="chip opacity-80">Included</span> : featured ? <span className="rounded-full bg-brand-violet/15 px-3 py-1 text-[12px] font-semibold text-[#d6ccff] shadow-[inset_0_0_0_1px_rgba(155,123,255,0.4)]">Everything</span> : null}
    </div>
    <p className="mt-2 min-h-[44px] text-[14.5px] text-fg-muted">{plan.tagline}</p>
    <div className="mt-6 flex items-baseline gap-2">
      {plan.id === 'free'
        ? <><span className="text-[44px] font-semibold tracking-[-0.03em]">{formatMoney(0, currency)}</span><span className="text-[14px] text-fg-muted">forever</span></>
        : price ? <>
          <motion.span key={`${price.amount}${currency}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[44px] font-semibold tracking-[-0.03em]">{formatMoney(price.amount, currency)}</motion.span>
          <span className="text-[14px] text-fg-muted">/ {period === 'year' ? 'year' : 'month'}</span>
          <span className="text-[12px] font-medium text-fg-dim">+ taxes</span>
        </> : <span className="text-[20px] text-fg-muted">Not for sale</span>}
    </div>
    <p className="mt-1 h-5 text-[13px] text-fg-dim">{plan.id !== 'free' && period === 'year' && monthly ? `${formatMoney(monthly.amount * 12, currency)} + taxes if paid monthly` : plan.id !== 'free' ? 'Prepaid + applicable taxes, no auto-renewal' : 'No card needed'}</p>
    <ul className="mt-6 flex flex-1 flex-col gap-3">
      {copy.points.map(point => <li key={point} className="flex gap-2.5 text-[14.5px] text-fg-soft"><Check size={17} weight="bold" className="mt-0.5 shrink-0 text-brand-mint"/>{point}</li>)}
    </ul>
    <div className="mt-8">
      {isCurrent
        ? <span className="btn btn--glass w-full cursor-default">Your current plan</span>
        : isIncludedInHigher
        ? <span className="btn btn--glass w-full cursor-default opacity-70">Included in Ultimate</span>
        : <Magnetic className="w-full"><Link to={href} className={`btn w-full ${featured ? 'btn--primary' : plan.id === 'pro' ? 'btn--mint' : 'btn--glass'}`} data-cursor-label={plan.id === 'free' ? 'Free' : 'Buy'}>{copy.cta}</Link></Magnetic>}
    </div>
  </motion.article>;
}

export function PlanCards({ plans, prices, period, currency, current = null }) {
  return <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-3" gap={0.09}>
    {plans.map(plan => <PlanCard key={plan.id} plan={{ ...plan, prices }} period={period} currency={currency} current={current}/>)}
  </Stagger>;
}

function Cell({ value }) {
  if (value === true) return <Check size={18} weight="bold" className="mx-auto text-brand-mint" aria-label="Included"/>;
  if (value === false) return <Minus size={18} className="mx-auto text-fg-dim" aria-label="Not included"/>;
  return <span>{value}</span>;
}

export function CompareTable({ plans }) {
  return <div className="card overflow-x-auto">
    <table className="w-full min-w-[640px] text-left text-[14.5px]">
      <caption className="sr-only">What each plan includes</caption>
      <thead>
        <tr>
          <th scope="col" className="p-5 text-[13px] font-medium text-fg-muted">Limit</th>
          {plans.map(plan => <th key={plan.id} scope="col" className="p-5 text-center text-[16px] font-semibold">{plan.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {LIMIT_ROWS.map(([label, read]) => <tr key={label} className="border-t border-line-soft transition-colors hover:bg-white/[0.02]">
          <th scope="row" className="p-5 font-normal text-fg-soft">{label}</th>
          {plans.map(plan => <td key={plan.id} className="p-5 text-center text-fg"><Cell value={read(plan.limits || {})}/></td>)}
        </tr>)}
        <tr className="border-t border-line-soft">
          <th scope="row" className="p-5 align-top font-normal text-fg-soft">In every plan</th>
          <td colSpan={plans.length} className="p-5 text-center text-fg-muted">{EVERY_PLAN.map((item, index) => <React.Fragment key={item}>{index ? ' · ' : null}<span className="whitespace-nowrap">{item}</span></React.Fragment>)}</td>
        </tr>
      </tbody>
    </table>
  </div>;
}
