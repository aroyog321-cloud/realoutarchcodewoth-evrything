import React, { useEffect, useState } from 'react';
import { Crown, Info } from '@phosphor-icons/react';
import { CompareTable, PlanCards, PricingControls } from '../components/Pricing.jsx';
import { Reveal } from '../components/ui.jsx';
import { useCatalog } from '../lib/catalog.js';
import { useCurrency } from '../lib/currency.js';
import { Link, useRouter } from '../lib/router.jsx';
import { useSession } from '../lib/session.js';
import { website } from '../lib/supabase.js';
import { FaqSection } from '../sections/Closing.jsx';

// The desktop app opens this page as /pricing?plan=pro&feature=mcp when a
// locked feature is clicked, so the feature is named at the top.
const FEATURE_NAMES = {
  terminals: 'more terminals', projectSwitching: 'switching projects', mcp: 'the Secure MCP gateway', mcpActions: 'MCP actions',
  mobileCompanion: 'the mobile companion', vscodeBridge: 'the VS Code bridge', recipes: 'more recipes', recipeTrial: 'workspace recipes',
  byokKeys: 'your own AI keys', missionAiMessages: 'unlimited Mission AI',
};

export default function PricingPage() {
  const { query } = useRouter();
  const catalog = useCatalog();
  const { session } = useSession();
  const [currency, setCurrency] = useCurrency();
  const [period, setPeriod] = useState(query.get('period') === 'year' ? 'year' : 'month');
  const [current, setCurrent] = useState(null);
  const feature = FEATURE_NAMES[query.get('feature')] || null;
  const wanted = catalog.plans.find(plan => plan.id === query.get('plan'));

  useEffect(() => {
    if (!session) { setCurrent(null); return; }
    let alive = true;
    website().rpc('get_entitlements').then(({ data, error }) => { if (alive && !error) setCurrent(data?.plan?.id || 'free'); });
    return () => { alive = false; };
  }, [session]);

  return <>
    <section className="mx-auto max-w-page px-5 pb-12 pt-36 text-center md:px-8">
      {feature ? <Reveal><p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-brand-violet/10 px-4 py-2 text-[14px] text-[#d6ccff] shadow-[inset_0_0_0_1px_rgba(155,123,255,0.35)]"><Crown size={15} weight="fill"/>You were looking for {feature}{wanted ? `, which comes with ${wanted.name}` : ''}.</p></Reveal> : null}
      <Reveal><h1 className="display mx-auto max-w-[16ch] text-[clamp(2.6rem,6vw,4.6rem)]">Plans that grow with your stack.</h1></Reveal>
      <Reveal delay={0.08}><p className="lede mx-auto mt-5 text-[17px]">OUTARCH runs on your computer on every plan. Plans set how much you can run at once. Pay for a month or a year; nothing renews automatically.</p></Reveal>
      <Reveal delay={0.14} className="mt-10"><PricingControls period={period} setPeriod={setPeriod} currency={currency} setCurrency={setCurrency}/></Reveal>
    </section>
    <section className="mx-auto max-w-page px-5 md:px-8">
      <PlanCards plans={catalog.plans} prices={catalog.prices} period={period} currency={currency} current={current}/>
      <p className="mt-6 flex items-start justify-center gap-2 text-center text-[13.5px] text-fg-dim"><Info size={16} className="mt-0.5 shrink-0"/>*Unlimited Mission AI has a fair-use limit of 2,000 messages a day. Moving from Pro to Ultimate carries over the Pro time you have left. Plans are covered by the <Link to="/terms" className="link-underline text-fg-muted hover:text-fg">Terms of service</Link> and the <Link to="/privacy" className="link-underline text-fg-muted hover:text-fg">privacy policy</Link>.</p>
    </section>
    <section id="compare" className="mx-auto max-w-page scroll-mt-28 px-5 pt-24 md:px-8">
      <Reveal><h2 className="display text-[clamp(1.8rem,3.6vw,2.8rem)]">Compare every limit.</h2></Reveal>
      <Reveal delay={0.06}><p className="lede mt-3 text-[16px]">These are the same limits the app enforces, so this table is exactly what you get.</p></Reveal>
      <Reveal delay={0.1} className="mt-8"><CompareTable plans={catalog.plans}/></Reveal>
    </section>
    <FaqSection/>
  </>;
}
