import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { AndroidLogo, ArrowClockwise, ArrowUp, BatteryFull, BookOpen, CaretRight, Check, DeviceMobile, DotsThree, Fingerprint, House, Lock, Play, Pulse, QrCode, Sparkle, TerminalWindow, Warning, WifiHigh, X } from '@phosphor-icons/react';
import { BrandIcon } from '../components/Brand.jsx';
import { Button, EASE, Reveal } from '../components/ui.jsx';
import { useCatalog } from '../lib/catalog.js';

// The phone companion as it looks in the phone's browser once paired: the same
// screens, words and palette as the real page the desktop serves
// (src/service/mobileWebCompanion.html), drawn at the device's smaller size.
// Every tap here does what it does on the phone, against made-up terminals.

const C = {
  surface: '#111111',
  surface2: '#171717',
  surface3: '#202020',
  sheet: '#121212',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.16)',
  muted: '#a1a1a1',
  dim: '#8a8a8a',
  accent: '#0070f3',
  accentText: '#52a8ff',
  ok: '#32d583',
  warn: '#f5b942',
  danger: '#ff6b6b',
  ai: '#a78bfa',
};
const TONE = {
  running: [C.ok, 'rgba(50,213,131,0.14)'],
  warning: [C.warn, 'rgba(245,185,66,0.14)'],
  critical: [C.danger, 'rgba(255,95,95,0.14)'],
  idle: [C.dim, 'rgba(255,255,255,0.07)'],
};
const STATE = {
  running: { label: 'Running', tone: 'running', alive: true },
  starting: { label: 'Starting', tone: 'warning', alive: true },
  'needs-you': { label: 'Needs you', tone: 'warning', alive: true },
  failed: { label: 'Failed', tone: 'critical', alive: false },
  stopped: { label: 'Stopped', tone: 'idle', alive: false },
};
const URGENCY = { failed: 0, 'needs-you': 1, starting: 2, running: 3, stopped: 4 };

const START_WORKERS = [
  { id: 'web', name: 'Web dev server', role: 'frontend', state: 'running', headline: 'Running for 42m.', signals: [['Service', 'port 5173 · confirmed', 'running']], output: ['➜  Local:   http://localhost:5173/', '12:04:31 [vite] hmr update /src/routes/dashboard.tsx', 'GET /api/projects 200 in 18 ms'] },
  { id: 'api', name: 'API gateway', role: 'backend', state: 'running', headline: 'Running for 42m.', signals: [['Service', 'port 4000 · confirmed', 'running']], output: ['Listening on http://localhost:4000', 'POST /api/sessions 201 in 31 ms', 'GET /api/health 200 in 2 ms'] },
  { id: 'tests', name: 'Unit tests (watch)', role: 'tests', state: 'needs-you', reason: '1 test failed: src/auth/session.test.ts', headline: 'Waiting for you: 1 test failed in src/auth/session.test.ts.', signals: [['Tests', '84 passed · 1 failed', 'critical']], output: [' FAIL  src/auth/session.test.ts', '  ✕ rejects expired tokens (12 ms)', 'Tests: 1 failed, 84 passed, 85 total'] },
  { id: 'queue', name: 'Queue worker', role: 'terminal', state: 'failed', reason: 'Process exited with code 1', headline: 'Failed with exit code 1. Restart it, or read the last output below.', signals: [], output: ['Error: connect ECONNREFUSED 127.0.0.1:6379', '    at TCPConnectWrap.afterConnect', 'Process exited with code 1'] },
  { id: 'db', name: 'Postgres tunnel', role: 'database', state: 'stopped', headline: 'Not running.', signals: [], output: [] },
];

const RECIPES = [
  { id: 'stack', name: 'Full stack', steps: [['Postgres tunnel', ''], ['API gateway', 'Postgres tunnel'], ['Web dev server', 'API gateway']] },
  { id: 'verify', name: 'Verify release', failed: 'Unit tests (watch): readiness timed out after 10s', steps: [['Build (production)', ''], ['Unit tests (watch)', 'Build (production)']] },
];

const ANSWER = 'One test fails in src/auth/session.test.ts: it rejects expired tokens. The queue worker exited because Redis on port 6379 is not running. Everything else is up.';

function Dot({ tone }) {
  const [color, soft] = TONE[tone];
  return <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color, boxShadow: tone === 'idle' ? 'none' : `0 0 0 2.5px ${soft}` }}/>;
}

function Phone() {
  const [tab, setTab] = useState('home');
  const [view, setView] = useState('terminals');
  const [workers, setWorkers] = useState(START_WORKERS);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [asked, setAsked] = useState(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(id => window.clearTimeout(id)), []);
  const later = (fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); };

  const byId = id => workers.find(w => w.id === id);
  const update = (id, patch) => setWorkers(list => list.map(w => w.id === id ? { ...w, ...patch } : w));
  const say = (text, tone = 'ok') => { setToast({ text, tone, key: Date.now() }); later(() => setToast(null), 2600); };
  const attention = workers.filter(w => w.state === 'needs-you' || w.state === 'failed');
  const running = workers.filter(w => STATE[w.state].alive).length;

  // What each button does, in the same order of events as the phone.
  const act = (id, action) => {
    const w = byId(id);
    if (!w) return;
    if (action === 'restart' || action === 'stop') { setSheet({ kind: 'confirm', id, action }); return; }
    setSheet(null);
    if (action === 'acknowledge') { update(id, { state: w.state === 'failed' ? 'stopped' : 'running', reason: '', headline: 'Running for 12m.' }); say(`${w.name} acknowledged`); return; }
    update(id, { state: 'starting', headline: 'Starting up.' });
    later(() => { update(id, { state: 'running', reason: '', headline: 'Running for 0s.' }); say(`${w.name} started`); }, 900);
  };
  const confirm = (id, action) => {
    const w = byId(id);
    setSheet(null);
    if (action === 'stop') { say(`Sent to your desktop. Approve “stop ${w.name}” there.`, 'warn'); return; }
    update(id, { state: 'starting', headline: 'Starting up.' });
    later(() => { update(id, { state: 'running', reason: '', headline: 'Running for 0s.', signals: w.id === 'tests' ? [['Tests', '85 passed', 'running']] : w.signals }); say(`${w.name} restarted`); }, 900);
  };
  const ask = () => { if (asked) return; setAsked(1); later(() => setAsked(2), 1300); };

  const tabs = [['home', 'Home', House], ['terminals', 'Terminals', TerminalWindow], ['needs', 'Needs you', Warning], ['ask', 'Ask', Sparkle], ['more', 'More', DotsThree]];
  const hero = attention.length
    ? { tone: 'warning', Icon: Warning, title: attention.length === 1 ? '1 thing needs you' : `${attention.length} things need you`, sub: `${attention.map(w => w.name).slice(0, 2).join(' and ')} ${attention.length === 1 ? 'is' : 'are'} waiting.` }
    : running === workers.length
      ? { tone: 'running', Icon: Check, title: 'Everything is running', sub: `${workers.length} terminals, all reported healthy.` }
      : { tone: 'running', Icon: Pulse, title: `${running} of ${workers.length} running`, sub: 'The rest are stopped.' };

  const row = w => {
    const s = STATE[w.state];
    const quick = s.alive ? 'restart' : 'start';
    const detail = w.state === 'needs-you' ? `Needs you · ${w.reason}` : w.state === 'failed' ? 'Failed · exit 1' : s.label;
    return <div key={w.id} className="relative flex items-center [&+&]:before:absolute [&+&]:before:left-[29px] [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-white/[0.09]">
      <button type="button" onClick={() => setSheet({ kind: 'detail', id: w.id })} aria-label={`Summary of ${w.name}`} className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 text-left active:bg-white/[0.05]">
        <Dot tone={s.tone}/>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] font-semibold">{w.name}</span>
          <span className="truncate text-[10.5px]" style={{ color: C.muted }}>{w.role !== 'terminal' ? `${w.role} · ` : ''}<b className="font-semibold" style={{ color: TONE[s.tone][0] }}>{detail}</b></span>
        </span>
      </button>
      <button type="button" onClick={() => act(w.id, quick)} aria-label={`${quick === 'restart' ? 'Restart' : 'Start'} ${w.name}`} className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[#d6d6d6] active:scale-90 active:bg-white/[0.06]">
        {w.state === 'starting' ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#52a8ff] border-r-transparent"/> : quick === 'restart' ? <ArrowClockwise size={16}/> : <Play size={15}/>}
      </button>
    </div>;
  };

  const attnCard = (w, compact) => {
    const failed = w.state === 'failed';
    const [color, soft] = failed ? TONE.critical : TONE.warning;
    const btn = 'h-8 min-w-0 flex-auto whitespace-nowrap rounded-[10px] px-1.5 text-[10.5px] font-semibold active:scale-[0.97]';
    const plain = { background: C.surface3, boxShadow: `inset 0 0 0 1px ${C.lineStrong}` };
    const summary = <button key="s" type="button" onClick={() => setSheet({ kind: 'detail', id: w.id })} className={btn} style={failed ? plain : { background: C.accent }}>Summary</button>;
    const acknowledge = <button key="a" type="button" onClick={() => act(w.id, 'acknowledge')} className={btn} style={plain}>Acknowledge</button>;
    const restart = <button key="r" type="button" onClick={() => act(w.id, 'restart')} className={btn} style={failed ? { background: C.accent } : plain}>Restart</button>;
    return <div key={w.id} className="rounded-[14px] p-2.5 [&+&]:mt-2" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]" style={{ color, background: soft }}><Warning size={14} weight="bold"/></span>
        <div className="min-w-0"><p className="truncate text-[12.5px] font-semibold">{w.name}</p><p className="text-[10px]" style={{ color: C.muted }}>{failed ? 'Failed' : 'Waiting for you'} · {w.role}</p></div>
      </div>
      <p className={`mt-2 text-[11.5px] leading-snug text-[#d6d6d6] ${compact ? 'line-clamp-2' : ''}`}>{w.reason}</p>
      <div className="mt-2.5 flex gap-1.5">{failed ? [restart, acknowledge, summary] : [summary, acknowledge, restart]}</div>
    </div>;
  };

  const screens = {
    home: <div className="flex flex-col">
      <div className="flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: `radial-gradient(130% 120% at 0% 0%, ${TONE[hero.tone][1]}, transparent 62%), ${C.surface}`, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" style={{ color: TONE[hero.tone][0], background: TONE[hero.tone][1] }}><hero.Icon size={18} weight="bold"/></span>
        <div className="min-w-0"><p className="text-[15.5px] font-bold leading-tight tracking-[-0.02em]">{hero.title}</p><p className="mt-0.5 text-[11px] leading-snug" style={{ color: C.muted }}>{hero.sub}</p></div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[[running, `/${workers.length}`, 'Running', C.ok, () => setTab('terminals')], [attention.length, '', 'Needs you', attention.length ? C.warn : '#fafafa', () => setTab('needs')], [RECIPES.length, '', 'Recipes', '#fafafa', () => { setView('recipes'); setTab('terminals'); }]].map(([n, of, label, color, go]) => <button key={label} type="button" onClick={go} className="rounded-[12px] px-2.5 py-2 text-left active:scale-[0.97]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
          <p className="text-[18px] font-bold leading-none" style={{ color }}>{n}<span className="text-[11px]" style={{ color: C.dim }}>{of}</span></p>
          <p className="mt-1 text-[10px] font-medium" style={{ color: C.muted }}>{label}</p>
        </button>)}
      </div>
      {attention.length ? <><p className="mb-1.5 ml-1 mt-4 text-[12.5px] font-semibold">Needs you</p>{attention.slice(0, 1).map(w => attnCard(w, true))}</> : null}
      <p className="mb-1.5 ml-1 mt-4 text-[12.5px] font-semibold">Terminals</p>
      <div className="overflow-hidden rounded-[14px]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>{[...workers].sort((a, b) => URGENCY[a.state] - URGENCY[b.state]).map(row)}</div>
      <p className="mt-2 text-center text-[10px]" style={{ color: C.dim }}>Tap a terminal for its summary.</p>
    </div>,
    terminals: <div>
      <p className="ml-0.5 text-[21px] font-bold tracking-[-0.025em]">{view === 'recipes' ? 'Recipes' : 'Terminals'}</p>
      <div className="mt-2 grid grid-cols-2 gap-0.5 rounded-[11px] p-0.5" style={{ background: C.surface2, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        {[['terminals', 'Terminals', workers.length], ['recipes', 'Recipes', RECIPES.length]].map(([id, label, n]) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className="flex h-8 items-center justify-center gap-1.5 rounded-[9px] text-[12px] font-semibold transition-colors" style={view === id ? { background: C.surface3, boxShadow: `inset 0 0 0 1px ${C.line}` } : { color: C.muted }}>{label}<b className="rounded-full bg-white/[0.08] px-1.5 text-[10px]">{n}</b></button>)}
      </div>
      {view === 'terminals'
        ? <div className="mt-2.5 overflow-hidden rounded-[14px]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>{[...workers].sort((a, b) => URGENCY[a.state] - URGENCY[b.state]).map(row)}</div>
        : <div className="mt-2.5 flex flex-col gap-2">
          {RECIPES.map(r => <div key={r.id} className="rounded-[14px] p-3" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
            <div className="flex items-start justify-between"><div><p className="text-[13px] font-semibold">{r.name}</p><p className="text-[10.5px]" style={{ color: C.muted }}>{r.steps.length} terminals</p></div><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={r.failed ? { background: TONE.critical[1], color: C.danger } : { background: C.surface3, color: C.muted }}>{r.failed ? 'Failed' : 'Ready'}</span></div>
            <ol className="mt-2.5 flex flex-col gap-1.5">{r.steps.map(([name, after], index) => <li key={name} className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}><span className="h-[7px] w-[7px] shrink-0 rounded-full" style={r.failed ? { background: index === 0 ? C.ok : C.danger } : { boxShadow: `inset 0 0 0 1.5px ${C.dim}` }}/><span className="min-w-0 truncate"><b className="font-semibold text-[#fafafa]">{name}</b>{after ? ` after ${after}` : ''}</span></li>)}</ol>
            {r.failed ? <p className="mt-2 rounded-[9px] px-2.5 py-1.5 text-[10.5px] text-[#ffc4c4]" style={{ background: TONE.critical[1] }}>{r.failed}</p> : null}
            <button type="button" onClick={() => say(`${r.name} is starting`)} className="mt-3 h-8 w-full rounded-[10px] text-[11.5px] font-semibold text-white active:scale-[0.98]" style={{ background: C.accent }}>{r.failed ? 'Run again' : 'Run recipe'}</button>
          </div>)}
        </div>}
    </div>,
    needs: <div>
      <p className="ml-0.5 text-[21px] font-bold tracking-[-0.025em]">Needs you{attention.length ? <span className="ml-1.5" style={{ color: C.dim }}>{attention.length}</span> : null}</p>
      <p className="mb-2.5 ml-0.5 text-[11px]" style={{ color: C.muted }}>Decisions your terminals are waiting on.</p>
      {attention.length ? attention.map(w => attnCard(w, false)) : <div className="grid place-items-center rounded-[14px] px-4 py-8 text-center" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <span className="mb-2 grid h-10 w-10 place-items-center rounded-[13px]" style={{ color: C.ok, background: TONE.running[1] }}><Check size={20} weight="bold"/></span>
        <p className="text-[13.5px] font-semibold">All clear</p>
        <p className="mt-1 text-[11px]" style={{ color: C.muted }}>Nothing is waiting on you. It ran at once; your desktop was not asked.</p>
      </div>}
    </div>,
    ask: <div className="flex min-h-full flex-col">
      {!asked ? <div className="flex flex-col items-center pt-2 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-[15px] text-white shadow-[0_12px_30px_rgba(124,92,255,0.3)]" style={{ background: 'linear-gradient(145deg,#7c5cff,#3291ff)' }}><Sparkle size={20} weight="fill"/></span>
        <p className="mt-3 text-[15px] font-bold">Ask about this project</p>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: C.muted }}>Mission AI reads what your terminals printed and answers here. It only looks.</p>
        {['What is failing right now?', 'Is the dev server up?'].map(q => <button key={q} type="button" onClick={ask} className="mt-2 flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left text-[12px] font-medium first-of-type:mt-4 active:bg-[#171717]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>{q}<CaretRight size={12} style={{ color: C.dim }}/></button>)}
      </div> : <div className="flex flex-col gap-2 pt-1">
        <p className="self-end rounded-[16px] rounded-br-[6px] px-3 py-2 text-[12px] text-white" style={{ background: C.accent }}>What is failing right now?</p>
        {asked === 1
          ? <p className="flex items-center gap-2 self-start rounded-[16px] rounded-bl-[6px] px-3 py-2 text-[11.5px]" style={{ background: C.surface2, color: C.muted }}><span className="flex gap-1">{[0, 1, 2].map(i => <i key={i} className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: C.ai, animationDelay: `${i * 150}ms` }}/>)}</span>Looking at the project…</p>
          : <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] self-start rounded-[16px] rounded-bl-[6px] px-3 py-2 text-[12px] leading-relaxed" style={{ background: C.surface2, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
            <p className="mb-0.5 text-[10px] font-bold" style={{ color: C.ai }}>Mission AI</p>{ANSWER}
          </motion.div>}
      </div>}
      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <span className="flex h-9 flex-1 items-center rounded-full px-3 text-[11.5px]" style={{ background: C.surface2, boxShadow: `inset 0 0 0 1px ${C.lineStrong}`, color: C.dim }}>Ask about this project…</span>
        <button type="button" onClick={ask} aria-label="Send" className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: C.accent }}><ArrowUp size={15} weight="bold"/></button>
      </div>
    </div>,
    more: <div>
      <p className="ml-0.5 text-[21px] font-bold tracking-[-0.025em]">More</p>
      <div className="mt-2 flex items-center gap-2.5 rounded-[16px] p-3" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        <span className="grid h-9 w-9 place-items-center rounded-[11px]" style={{ color: C.accentText, background: 'rgba(0,112,243,0.16)' }}><DeviceMobile size={18}/></span>
        <div><p className="text-[13px] font-semibold">Pixel 9</p><p className="text-[10.5px]" style={{ color: C.muted }}>Paired with acme-console</p></div>
      </div>
      <p className="mb-1.5 ml-1 mt-3.5 text-[10.5px] font-semibold" style={{ color: C.muted }}>This phone can</p>
      <div className="overflow-hidden rounded-[14px]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        {[['See terminals and what needs you', true], ['Start, restart and run recipes', true], ['Read terminal output', true], ['Ask Mission AI', true]].map(([label]) => <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-white/[0.09]">
          <span className="grid h-6 w-6 place-items-center rounded-[7px]" style={{ color: C.ok, background: TONE.running[1] }}><Check size={12} weight="bold"/></span>
          <span className="text-[11.5px] font-medium">{label}</span>
        </div>)}
      </div>
      <div className="mt-3 overflow-hidden rounded-[14px]" style={{ background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
        {[[Pulse, 'Activity'], [BookOpen, 'Project memory']].map(([Icon, label]) => <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-white/[0.09]"><Icon size={15} className="text-[#d6d6d6]"/><span className="flex-1 text-[11.5px] font-medium">{label}</span><CaretRight size={11} style={{ color: C.dim }}/></div>)}
      </div>
      <p className="mt-3 rounded-[12px] py-2.5 text-center text-[12px] font-semibold" style={{ color: C.danger, background: TONE.critical[1] }}>Unpair this phone</p>
    </div>,
  };

  const detail = sheet && byId(sheet.id);
  const s = detail && STATE[detail.state];
  return <div className="relative mx-auto w-[300px] rounded-[46px] bg-[#0b0d12] p-3 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.14),0_50px_100px_-30px_rgba(0,0,0,0.95),0_0_90px_-20px_rgba(63,208,181,0.35)]">
    <div className="relative h-[600px] overflow-hidden rounded-[36px] bg-black text-[#fafafa]">
      <div className="absolute left-1/2 top-2.5 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"/>
      <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold"><span>9:41</span><span className="flex items-center gap-1"><WifiHigh size={13} weight="bold"/><BatteryFull size={15} weight="fill"/></span></div>
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <BrandIcon size={28}/>
        <div className="min-w-0 flex-1"><p className="text-[8.5px] font-bold tracking-[0.16em]" style={{ color: C.muted }}>OUTARCH</p><p className="truncate text-[13px] font-semibold leading-tight">acme-console</p></div>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold" style={{ color: C.ok, background: TONE.running[1] }}><i className="h-1.5 w-1.5 rounded-full bg-current"/>Live</span>
      </div>
      <div className="absolute inset-x-0 bottom-[58px] top-[76px] overflow-y-auto overscroll-contain px-2.5 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} className="min-h-full" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>{screens[tab]}</motion.div>
        </AnimatePresence>
      </div>
      <nav className="absolute inset-x-0 bottom-0 z-10 grid h-[58px] grid-cols-5 border-t border-white/[0.09] bg-[#0a0a0a]/95 px-1 pb-1.5 pt-1 backdrop-blur" aria-label="Mobile companion tabs">
        {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => { setTab(id); if (id === 'terminals' && tab !== 'terminals') setView('terminals'); }} aria-pressed={tab === id} className="flex flex-col items-center justify-center gap-0.5 text-[8.5px] font-semibold" style={{ color: tab === id ? '#fafafa' : C.dim }}>
          <span className="relative grid h-[24px] w-[42px] place-items-center rounded-full">
            {tab === id ? <motion.span layoutId="phone-tab" className="absolute inset-0 rounded-full bg-white/[0.11]" transition={{ type: 'spring', stiffness: 420, damping: 34 }}/> : null}
            <Icon size={17} className="relative"/>
            {id === 'needs' && attention.length ? <span className="absolute -top-1 right-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-[#e5484d] px-1 text-[8.5px] font-bold text-white shadow-[0_0_0_1.5px_#0a0a0a]">{attention.length}</span> : null}
          </span>
          {label}
        </button>)}
      </nav>

      <AnimatePresence>
        {toast ? <motion.div key={toast.key} initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }} className="absolute inset-x-3 top-[80px] z-40 flex items-center gap-2 rounded-[13px] px-3 py-2.5 text-[11.5px] font-medium shadow-[0_12px_30px_rgba(0,0,0,0.55)]" style={{ background: 'rgba(30,30,30,0.97)', boxShadow: `inset 0 0 0 1px ${C.lineStrong}` }} role="status">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toast.tone === 'warn' ? C.warn : C.ok }}/>{toast.text}
        </motion.div> : null}
      </AnimatePresence>

      <AnimatePresence>
        {detail ? <>
          <motion.button key="veil" type="button" aria-label="Close" onClick={() => setSheet(null)} className="absolute inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/>
          <motion.div key="sheet" role="dialog" aria-label={sheet.kind === 'confirm' ? 'Confirm' : `${detail.name} summary`} className="absolute inset-x-0 bottom-0 z-50 max-h-[86%] overflow-y-auto rounded-t-[22px] px-3.5 pb-3.5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ background: C.sheet, boxShadow: `0 -1px 0 ${C.lineStrong}` }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
            <span className="mx-auto mb-2 block h-1 w-8 rounded-full bg-white/20"/>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14.5px] font-bold">{sheet.kind === 'confirm' ? `${sheet.action === 'stop' ? 'Stop' : 'Restart'} ${detail.name}?` : detail.name}</p>
              <button type="button" onClick={() => setSheet(null)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.08]" style={{ color: C.muted }}><X size={12} weight="bold"/></button>
            </div>
            {sheet.kind === 'confirm' ? <>
              <p className="mt-2 text-[12px] leading-relaxed text-[#d6d6d6]">{sheet.action === 'stop' ? 'Your desktop will ask you to approve this before anything happens.' : <><b className="text-[#fafafa]">{detail.name}</b> restarts right away. Your desktop is not asked.</>}</p>
              <div className="mt-3.5 flex gap-2">
                <button type="button" onClick={() => setSheet({ kind: 'detail', id: detail.id })} className="h-9 flex-1 rounded-[11px] text-[12px] font-semibold" style={{ background: C.surface3, boxShadow: `inset 0 0 0 1px ${C.lineStrong}` }}>Cancel</button>
                <button type="button" onClick={() => confirm(detail.id, sheet.action)} className="h-9 flex-1 rounded-[11px] text-[12px] font-semibold" style={sheet.action === 'stop' ? { color: C.danger, background: TONE.critical[1] } : { background: C.accent, color: '#fff' }}>{sheet.action === 'stop' ? 'Ask desktop' : 'Restart now'}</button>
              </div>
            </> : <>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold" style={{ color: TONE[s.tone][0], background: TONE[s.tone][1] }}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{s.label}</span>
                <span className="font-mono text-[10px]" style={{ color: C.muted }}>{detail.role}</span>
              </div>
              <p className="mt-2 text-[12.5px] font-semibold leading-snug">{detail.headline}</p>
              {detail.signals.length ? <div className="mt-2 flex flex-wrap gap-1">{detail.signals.map(([label, value, tone]) => <span key={label} className="rounded-[8px] px-2 py-1 text-[10.5px] font-semibold" style={{ background: C.surface2, boxShadow: `inset 0 0 0 1px ${C.line}`, color: TONE[tone][0] }}><small className="mr-1.5 text-[8.5px] font-bold uppercase tracking-[0.07em]" style={{ color: C.muted }}>{label}</small>{value}</span>)}</div> : null}
              <button type="button" onClick={() => { setSheet(null); setTab('ask'); ask(); }} className="mt-2.5 flex h-9 w-full items-center gap-2 rounded-[11px] px-3 text-left text-[11.5px] font-semibold text-[#ddd6fe]" style={{ background: 'rgba(167,139,250,0.16)', boxShadow: 'inset 0 0 0 1px rgba(167,139,250,0.24)' }}><Sparkle size={13} weight="fill" style={{ color: C.ai }}/><span className="flex-1">Explain with Mission AI</span><CaretRight size={11}/></button>
              <p className="mb-1 mt-3 text-[10px] font-semibold" style={{ color: C.muted }}>Last output</p>
              {detail.output.length ? <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-[10px] bg-[#050505] p-2.5 font-term text-[9.5px] leading-relaxed text-[#d4d4d4]" style={{ boxShadow: `inset 0 0 0 1px ${C.line}` }}>{detail.output.join('\n')}</pre> : <p className="rounded-[10px] p-3 text-center text-[10.5px]" style={{ color: C.muted, boxShadow: `inset 0 0 0 1px ${C.lineStrong}` }}>This terminal has not printed anything yet.</p>}
              <div className="mt-3 flex gap-1.5 border-t border-white/[0.09] pt-2.5">
                {detail.state === 'needs-you' ? <button type="button" onClick={() => act(detail.id, 'acknowledge')} className="h-9 min-w-0 flex-auto whitespace-nowrap rounded-[11px] px-2 text-[11px] font-semibold" style={{ color: C.warn, background: TONE.warning[1] }}>Acknowledge</button> : null}
                {s.alive
                  ? <><button type="button" onClick={() => act(detail.id, 'restart')} className="h-9 min-w-0 flex-auto whitespace-nowrap rounded-[11px] px-2 text-[11px] font-semibold" style={{ background: C.surface3, boxShadow: `inset 0 0 0 1px ${C.lineStrong}` }}>Restart</button><button type="button" onClick={() => act(detail.id, 'stop')} className="h-9 min-w-0 flex-auto whitespace-nowrap rounded-[11px] px-2 text-[11px] font-semibold" style={{ color: C.danger, background: TONE.critical[1] }}>Stop</button></>
                  : <button type="button" onClick={() => act(detail.id, 'start')} className="h-9 flex-1 rounded-[11px] text-[11px] font-semibold text-white" style={{ background: C.accent }}>Start</button>}
              </div>
            </>}
          </motion.div>
        </> : null}
      </AnimatePresence>
    </div>
  </div>;
}

const POINTS = [
  [QrCode, 'Pair in seconds', 'Scan the QR code in OUTARCH, check that the 6-digit code matches, and tap Pair. The code proves the key exchange and never crosses the network.'],
  [Lock, 'Encrypted end to end', 'X25519 key exchange and AES-256-GCM on every message, with replay protection. Each phone has its own key, and you can revoke it from the desktop or unpair it from the phone.'],
  [Fingerprint, 'Control, not a remote shell', 'Starting or restarting a terminal, or running a recipe, happens right away. Stopping a terminal or cancelling a run still waits for you on the desktop. Terminal output stays hidden unless you allow it.'],
];

export function MobileSection() {
  const reduce = useReducedMotion();
  const { androidApkUrl } = useCatalog();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [60, -60]);
  const rotate = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-4, 3]);
  return <section id="mobile" ref={ref} className="relative z-[1] scroll-mt-24 overflow-hidden py-28">
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(63,208,181,0.14),transparent)]" aria-hidden="true"/>
    <div className="relative mx-auto grid grid-cols-1 max-w-page items-center gap-16 px-5 md:px-8 lg:grid-cols-[1fr_auto]">
      <div>
        <Reveal><p className="kicker mb-4 flex items-center gap-2"><DeviceMobile size={15}/>Mobile companion</p></Reveal>
        <Reveal delay={0.05}><h2 className="display text-[clamp(2rem,4.4vw,3.4rem)]">Step away. Your phone still knows.</h2></Reveal>
        <Reveal delay={0.1}><p className="lede mt-5 text-[17px]">See what's running, read a summary of any terminal, and start, restart or run a recipe while you're away from your desk. Your phone connects to OUTARCH over your own network, with no cloud relay in between.</p></Reveal>
        <div className="mt-10 grid gap-6">
          {POINTS.map(([Icon, title, body], index) => <Reveal key={title} delay={0.12 + index * 0.06} className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand-mint/10 text-brand-mint shadow-[inset_0_0_0_1px_rgba(63,208,181,0.3)]"><Icon size={19} weight="duotone"/></span>
            <div><h3 className="text-[16.5px] font-semibold">{title}</h3><p className="mt-1 max-w-[56ch] text-[15px] leading-relaxed text-fg-muted">{body}</p></div>
          </Reveal>)}
        </div>
        <Reveal delay={0.3} className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
          {androidApkUrl
            ? <Button href={androidApkUrl} variant="mint" cursor="Get it" download><AndroidLogo size={18} weight="fill"/>Download for Android</Button>
            : <Button to="/mobile" variant="mint" cursor="Get it"><DeviceMobile size={18} weight="bold"/>Get the mobile app</Button>}
          <p className="text-[13.5px] text-fg-dim">Included with Pro and Ultimate. Opens in your phone's browser. Try the phone on the right.</p>
        </Reveal>
      </div>
      <motion.div style={{ y, rotate }}><Phone/></motion.div>
    </div>
  </section>;
}
