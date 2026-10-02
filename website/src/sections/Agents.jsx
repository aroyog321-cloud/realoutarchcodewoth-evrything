import React from 'react';
import { motion } from 'framer-motion';
import { BellRinging, Brain, Robot, SquaresFour } from '@phosphor-icons/react';
import { SectionTitle, Stagger, staggerItem, useSpotlight } from '../components/ui.jsx';

// OUTARCH is for vibe coding with CLI agents as much as it is for running a
// dev stack. This section says so plainly, right after the live demo.

const AGENTS = ['Claude Code', 'Codex', 'Gemini CLI', 'OpenCode', 'GitHub Copilot', 'Cursor', 'Goose', 'Aider'];

const POINTS = [
  { icon: Robot, color: '155,123,255', title: 'Any CLI agent, in a real terminal', body: 'Claude Code, Codex, Gemini CLI and any other agent with a command line run exactly as they do in your own terminal. Nothing is wrapped or replaced.' },
  { icon: SquaresFour, color: '47,123,255', title: 'Several agents at once', body: 'Let one agent refactor while another reviews and a third writes tests. Watch them side by side with your dev server and test watcher.' },
  { icon: BellRinging, color: '245,185,66', title: 'You hear when one is waiting', body: 'When an agent stops to ask for permission, OUTARCH rings and adds it to Needs You. One click takes you to that terminal to answer.' },
  { icon: Brain, color: '63,208,181', title: 'Agents share what they learn', body: "Project memory gives agents such as Claude Code and Codex the project's purpose and every recent change, so a new session does not start from zero." },
];

function Point({ point }) {
  const spotlight = useSpotlight();
  const Icon = point.icon;
  return <motion.article variants={staggerItem} onPointerMove={spotlight} className="card spotlight relative overflow-hidden p-6 sm:p-7" style={{ '--spot': point.color }}>
    <span className="grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: `rgba(${point.color},0.14)`, color: `rgb(${point.color})`, boxShadow: `inset 0 0 0 1px rgba(${point.color},0.35)` }}>
      <Icon size={20} weight="duotone"/>
    </span>
    <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">{point.title}</h3>
    <p className="mt-2 text-[14.5px] leading-relaxed text-fg-muted">{point.body}</p>
  </motion.article>;
}

export function AgentsSection() {
  return <section id="agents" className="relative z-[1] mx-auto max-w-page scroll-mt-24 px-5 pb-24 md:px-8">
    <SectionTitle
      kicker="Vibe coding with CLI agents"
      title="Vibe code with your AI agents. OUTARCH keeps watch."
      lede="OUTARCH is not only for servers and test runners. Run your AI coding agents from the command line, as many as you like, and step in only when one needs a decision."
    />
    <div className="mt-8 flex flex-wrap gap-2" aria-label="Agents that work in OUTARCH">
      {AGENTS.map(name => <span key={name} className="inline-flex h-9 items-center rounded-full bg-brand-violet/10 px-4 text-[14px] text-[#d6ccff] shadow-[inset_0_0_0_1px_rgba(155,123,255,0.3)]">{name}</span>)}
      <span className="inline-flex h-9 items-center rounded-full bg-white/[0.03] px-4 text-[14px] text-fg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]">and any other CLI agent</span>
    </div>
    <Stagger className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {POINTS.map(point => <Point key={point.title} point={point}/>)}
    </Stagger>
  </section>;
}
