import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AndroidLogo, AppleLogo, Check, Crown, DeviceMobile, DotsThreeVertical, Export, Lock, QrCode, ShieldCheck, WifiHigh, WindowsLogo,
} from '@phosphor-icons/react';
import { Button, EASE, Reveal } from '../components/ui.jsx';
import { Segmented } from '../components/Pricing.jsx';
import { useCatalog } from '../lib/catalog.js';
import { Link } from '../lib/router.jsx';
import { useSession } from '../lib/session.js';
import { website } from '../lib/supabase.js';

// Installing the mobile companion. The companion is a web app that OUTARCH
// serves from your own computer over your Wi-Fi, so it is installed from the
// address the desktop app shows, not from this website: a page on this site
// could not reach your computer, and nothing goes through our servers.
// The desktop app opens this page from Integrations, Mobile Companion.

function guessPlatform() {
  if (typeof navigator === 'undefined') return 'android';
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'android';
}

function onPhone() {
  return typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

const PAIR_STEPS = [
  [WindowsLogo, 'Turn on the phone service', 'In OUTARCH on your computer, open Integrations, then Mobile Companion, and select Turn on. Open a saved project first: a phone pairs with one project.'],
  [QrCode, 'Scan the pairing code', 'Select Create pairing code, then scan the QR code with your phone\'s camera. The phone has to be on the same Wi-Fi as the computer.'],
  [ShieldCheck, 'Pair this phone', 'Check that the 6-digit code on the phone matches the one on the computer, then tap Pair this phone. The code works once.'],
];

const INSTALL = {
  android: {
    label: 'Android',
    steps: [
      [DotsThreeVertical, 'In Chrome, tap the menu', 'The three dots at the top right, while the companion is open after pairing.'],
      [DeviceMobile, 'Tap Add to Home screen', 'Some versions of Chrome call it Install app. Confirm with Add.'],
      [Check, 'Open it from your home screen', 'It opens the companion straight away, and the phone stays paired.'],
    ],
  },
  ios: {
    label: 'iPhone',
    steps: [
      [Export, 'In Safari, tap Share', 'The square with an arrow, at the bottom of the screen, while the companion is open after pairing.'],
      [DeviceMobile, 'Tap Add to Home Screen', 'Scroll down the share sheet if you do not see it, then tap Add.'],
      [Check, 'Open it from your home screen', 'It opens the companion straight away, and the phone stays paired.'],
    ],
  },
};

function StepList({ steps, tone }) {
  return <ol className="flex flex-col gap-5">
    {steps.map(([Icon, title, body], index) => <li key={title} className="flex gap-4">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[13px]" style={{ background: `rgba(${tone},0.12)`, color: `rgb(${tone})`, boxShadow: `inset 0 0 0 1px rgba(${tone},0.35)` }}>
        <Icon size={20} weight="duotone"/>
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink-800 font-mono text-[11px] text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">{index + 1}</span>
      </span>
      <div className="min-w-0"><p className="text-[16px] font-medium">{title}</p><p className="mt-1 text-[14.5px] leading-relaxed text-fg-muted">{body}</p></div>
    </li>)}
  </ol>;
}

// Whether the signed-in account's plan includes the companion.
function usePlanAccess(session) {
  const [access, setAccess] = useState({ loading: Boolean(session), allowed: null, plan: null });
  useEffect(() => {
    if (!session) { setAccess({ loading: false, allowed: null, plan: null }); return undefined; }
    let alive = true;
    website().rpc('get_entitlements').then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) setAccess({ loading: false, allowed: null, plan: null });
      else setAccess({ loading: false, allowed: Boolean(data.limits?.mobileCompanion), plan: data.plan?.name || 'Free' });
    });
    return () => { alive = false; };
  }, [session]);
  return access;
}

function PlanCard({ session, access }) {
  if (session && access.loading) return <div className="card h-[132px] animate-pulse"/>;
  if (session && access.allowed) {
    return <div className="card flex flex-wrap items-center gap-4 p-6" style={{ background: 'linear-gradient(135deg, rgba(63,208,181,0.16), rgba(255,255,255,0.02) 60%)' }}>
      <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand-mint/15 text-brand-mint shadow-[inset_0_0_0_1px_rgba(63,208,181,0.4)]"><Check size={24} weight="bold"/></span>
      <div className="mr-auto"><p className="text-[17px] font-semibold">Included in your {access.plan} plan</p><p className="text-[14.5px] text-fg-muted">Follow the steps below to put it on your phone.</p></div>
    </div>;
  }
  const signedInFree = session && access.allowed === false;
  return <div className="card flex flex-wrap items-center gap-4 p-6" style={{ background: 'linear-gradient(135deg, rgba(155,123,255,0.16), rgba(255,255,255,0.02) 60%)' }}>
    <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand-violet/15 text-brand-violet shadow-[inset_0_0_0_1px_rgba(155,123,255,0.4)]">{signedInFree ? <Lock size={22} weight="bold"/> : <Crown size={22} weight="fill"/>}</span>
    <div className="mr-auto min-w-0">
      <p className="text-[17px] font-semibold">{signedInFree ? `Your ${access.plan} plan does not include the mobile companion` : 'Comes with Pro and Ultimate'}</p>
      <p className="text-[14.5px] text-fg-muted">{signedInFree ? 'Upgrade to Pro or Ultimate and the phone service turns on in OUTARCH by itself.' : 'The phone service in OUTARCH turns on only for a Pro or Ultimate account.'}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button to="/checkout?plan=pro&period=month" size="sm" magnetic={false}><Crown size={15} weight="fill"/>Get Pro</Button>
      <Button to="/pricing" variant="glass" size="sm" magnetic={false}>Compare plans</Button>
    </div>
  </div>;
}

export default function MobilePage() {
  const { session } = useSession();
  const access = usePlanAccess(session);
  const { androidApkUrl } = useCatalog();
  const [platform, setPlatform] = useState(guessPlatform);
  const phone = onPhone();

  return <section className="mx-auto max-w-[1040px] px-5 pb-24 pt-32 md:px-8">
    <Reveal>
      <span className="chip"><DeviceMobile size={14}/>Mobile companion</span>
      <h1 className="display mt-5 text-[clamp(2.2rem,5vw,3.6rem)]">Put OUTARCH on your phone.</h1>
      <p className="lede mt-4 text-[17px]">See what is running, read a summary of any terminal, and start, restart or run a recipe while you are away from your desk. The companion is a web app your phone installs from OUTARCH on your computer, over your own Wi-Fi, with no app store and no cloud relay.</p>
    </Reveal>

    {phone ? <Reveal delay={0.05}>
      <p className="mt-6 flex items-start gap-3 rounded-field bg-brand-blue/10 p-4 text-[14.5px] leading-relaxed text-fg-soft shadow-[inset_0_0_0_1px_rgba(47,123,255,0.35)]"><WifiHigh size={20} className="mt-0.5 shrink-0 text-brand-sky"/>You are on your phone. Start on your computer: open OUTARCH there, then scan the pairing code it shows with this phone.</p>
    </Reveal> : null}

    <Reveal delay={0.08} className="mt-8"><PlanCard session={session} access={access}/></Reveal>

    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Reveal delay={0.1} className="h-full">
        <div className="card h-full p-7 sm:p-8">
          <p className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-brand-sky">Step 1 · On your computer</p>
          <h2 className="mt-2 text-[22px] font-semibold">Pair your phone</h2>
          <div className="mt-6"><StepList steps={PAIR_STEPS} tone="47,123,255"/></div>
        </div>
      </Reveal>
      <Reveal delay={0.14} className="h-full">
        <div className="card h-full p-7 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-brand-mint">Step 2 · On your phone</p>
            <Segmented label="Phone" value={platform} onChange={setPlatform} options={[{ value: 'android', label: <span className="inline-flex items-center gap-1.5"><AndroidLogo size={15} weight="fill"/>Android</span> }, { value: 'ios', label: <span className="inline-flex items-center gap-1.5"><AppleLogo size={15} weight="fill"/>iPhone</span> }]}/>
          </div>
          <h2 className="mt-2 text-[22px] font-semibold">Install it</h2>
          <motion.div key={platform} className="mt-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <StepList steps={INSTALL[platform].steps} tone="63,208,181"/>
          </motion.div>
          {androidApkUrl && platform === 'android'
            ? <div className="mt-6 border-t border-line-soft pt-5"><Button href={androidApkUrl} variant="glass" size="sm" magnetic={false} download><AndroidLogo size={15} weight="fill"/>Or download the Android APK</Button></div>
            : null}
        </div>
      </Reveal>
    </div>

    <Reveal delay={0.1}>
      <div className="card mt-6 p-7 sm:p-8">
        <h2 className="text-[19px] font-semibold">Why it installs from your computer, not from this website</h2>
        <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-fg-muted">Your phone talks straight to OUTARCH on your computer, encrypted end to end, and never through our servers. That only works from the address your computer shows, so the pairing code is also the install link.</p>
        <h3 className="mt-7 text-[16px] font-semibold">The phone cannot open the link?</h3>
        <ul className="mt-3 flex max-w-[72ch] flex-col gap-2 text-[14.5px] leading-relaxed text-fg-muted">
          <li className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-brand-mint"/>Put the phone on the same Wi-Fi as the computer. Guest networks and mobile data cannot reach it.</li>
          <li className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-brand-mint"/>Allow OUTARCH through Windows Firewall on Private networks, and mark your Wi-Fi as a Private network.</li>
          <li className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-brand-mint"/>Pause a VPN on the computer, or pick the Wi-Fi address under Network in OUTARCH, then scan again.</li>
        </ul>
        <p className="mt-6 text-[13px] text-fg-dim"><Link to="/mobile-privacy" className="link-underline text-fg-muted hover:text-fg">Mobile privacy and permissions</Link></p>
      </div>
    </Reveal>
  </section>;
}
