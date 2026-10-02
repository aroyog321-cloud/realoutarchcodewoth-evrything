import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowDown, BellRinging, CheckCircle, DownloadSimple, Play, ShieldCheck, Sparkle, WarningDiamond } from '@phosphor-icons/react';
import { Button, EASE, Reveal } from '../components/ui.jsx';
import DemoApp from '../demo/DemoApp.jsx';

// The kinds of notice OUTARCH raises, as they look on a Windows desktop.
const NOTICES = [
  { id: 'ask', icon: BellRinging, tone: '#f5b942', bg: 'rgba(245,185,66,.14)', title: 'Claude Code is asking for permission', detail: 'npm install zod@3', action: 'Open terminal' },
  { id: 'tests', icon: WarningDiamond, tone: '#ff6b6b', bg: 'rgba(255,95,95,.14)', title: 'Unit tests: 1 failed, 84 passed', detail: 'src/auth/session.test.ts', action: 'Ask Mission AI' },
  { id: 'plan', icon: Sparkle, tone: '#b59dff', bg: 'rgba(155,123,255,.16)', title: 'Mission AI plan is waiting for you', detail: 'Fix the expiry check, re-run tests', action: 'Review' },
  { id: 'recipe', icon: CheckCircle, tone: '#32d583', bg: 'rgba(50,213,131,.14)', title: 'Release check finished', detail: '3 of 3 workers ready', action: null },
  { id: 'update', icon: ShieldCheck, tone: '#6aa6ff', bg: 'rgba(47,123,255,.16)', title: 'OUTARCH update is ready', detail: 'Signature verified', action: 'Restart' },
];

function NoticeStack() {
  const reduce = useReducedMotion();
  const stack = useRef(null);
  // The cards cycle only while they are on screen; off screen the timer would
  // keep re-laying them out under everything else on the page.
  const inView = useInView(stack, { margin: '120px 0px' });
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return undefined;
    const timer = window.setInterval(() => setStart(value => (value + 1) % NOTICES.length), 2600);
    return () => window.clearInterval(timer);
  }, [reduce, inView]);
  const shown = [0, 1, 2].map(offset => NOTICES[(start + offset) % NOTICES.length]);

  return <div ref={stack} className="relative mx-auto w-full max-w-[400px]" aria-hidden="true">
    <div className="absolute -inset-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(47,123,255,0.28),transparent)] blur-2xl"/>
    <div className="relative flex flex-col gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((notice, index) => {
          const Icon = notice.icon;
          return <motion.div
            key={notice.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.94 }}
            animate={{ opacity: 1 - index * 0.22, x: 0, scale: 1 - index * 0.035 }}
            exit={{ opacity: 0, x: -30, scale: 0.9, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="flex items-start gap-3 rounded-[16px] bg-ink-700/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-25px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: notice.bg, color: notice.tone }}>
              <Icon size={19} weight="fill"/>
              {index === 0 ? <span className="absolute inset-0 animate-pulse-ring rounded-[10px]" style={{ boxShadow: `0 0 0 2px ${notice.tone}` }}/> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11.5px] text-fg-dim"><span className="font-semibold text-fg-muted">OUTARCH</span><span>now</span></div>
              <p className="mt-0.5 text-[14px] font-medium text-fg">{notice.title}</p>
              <p className="mt-0.5 truncate font-term text-[12px] text-fg-muted">{notice.detail}</p>
              {notice.action ? <span className="mt-2.5 inline-flex h-7 items-center rounded-full bg-white/[0.07] px-3 text-[12px] font-medium text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">{notice.action}</span> : null}
            </div>
          </motion.div>;
        })}
      </AnimatePresence>
    </div>
  </div>;
}

export function Hero() {
  return <section className="relative z-[1] mx-auto grid grid-cols-1 min-h-[100dvh] max-w-page items-center gap-14 px-5 pb-16 pt-28 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
        <span className="chip">Works with Claude Code, Codex, Gemini CLI, OpenCode and more</span>
      </motion.div>
      <motion.h1
        className="display mt-6 text-[clamp(2.9rem,7vw,5.6rem)]"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.08, ease: EASE }}
      >
        Vibe code with AI agents, <span className="ghost-ink whitespace-nowrap">supervised.</span>
      </motion.h1>
      <motion.p
        className="lede mt-6 text-[clamp(1.05rem,1.6vw,1.25rem)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.18, ease: EASE }}
      >
        Run Claude Code, Codex, Gemini CLI or any CLI agent side by side with your dev servers and tests, in one window. OUTARCH watches every terminal and tells you the moment one needs you.
      </motion.p>
      <motion.div
        className="mt-9 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.28, ease: EASE }}
      >
        <Button to="/#download" size="lg" cursor="Get it"><DownloadSimple size={19} weight="bold"/>Download for Windows</Button>
        <Button to="/#demo" size="lg" variant="glass" cursor="Play"><Play size={17} weight="fill"/>Try the live demo</Button>
      </motion.div>
    </div>
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.25, ease: EASE }} className="hidden lg:block">
      <NoticeStack/>
    </motion.div>
  </section>;
}

export function DemoStage() {
  const reduce = useReducedMotion();
  // The window tilts up into place once, the first time it comes into view.
  // It used to follow every scroll frame, which redrew the whole replica each
  // frame and was the heaviest thing on the page to scroll past.
  return <section id="demo" className="relative z-[1] mx-auto max-w-page scroll-mt-24 px-4 pb-24 md:px-8">
    <div className="mb-10 max-w-3xl">
      <Reveal><h2 className="display text-[clamp(2rem,4.4vw,3.4rem)]">See it running, right here.</h2></Reveal>
      <Reveal delay={0.08}><p className="lede mt-4 text-[17px]">This is a working simulation of the OUTARCH desktop app. The terminals are simulated in your browser; the alerts, decisions and layouts behave as they do in the app.</p></Reveal>
      <Reveal delay={0.14}><p className="mt-5 inline-flex items-center gap-2 text-[14px] text-fg-muted"><ArrowDown size={15}/>Start on Groundstation, open a terminal, or press Ctrl K inside the window.</p></Reveal>
    </div>
    <div style={{ perspective: 1600 }}>
      <motion.div
        initial={reduce ? false : { rotateX: 22, scale: 0.9, y: 60 }}
        whileInView={{ rotateX: 0, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 1.1, ease: EASE }}
        style={{ transformOrigin: '50% 0%' }}
      >
        <DemoApp/>
      </motion.div>
    </div>
    <p className="mt-4 text-center text-[12.5px] text-fg-dim">The live demo is a simulation. The app you download may differ from it in places.</p>
  </section>;
}
