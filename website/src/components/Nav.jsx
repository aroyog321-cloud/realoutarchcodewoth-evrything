import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { DownloadSimple, List, UserCircle, X } from '@phosphor-icons/react';
import { Link, useRouter } from '../lib/router.jsx';
import { useSession } from '../lib/session.js';
import { Wordmark } from './Brand.jsx';
import { Button, EASE } from './ui.jsx';

const LINKS = [
  ['Live demo', '/#demo'],
  ['Features', '/#features'],
  ['How it works', '/#how'],
  ['Memory', '/#memory'],
  ['Mobile', '/#mobile'],
  ['Pricing', '/pricing'],
];

export default function Nav() {
  const { scrollY } = useScroll();
  const [raised, setRaised] = useState(false);
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const { path } = useRouter();
  useMotionValueEvent(scrollY, 'change', value => setRaised(value > 24));
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [open]);

  return <header className="fixed inset-x-0 top-0 z-40">
    <div className={`mt-3 flex h-[60px] items-center justify-between gap-4 rounded-full px-3 pl-4 transition-all duration-500 ${raised ? 'bg-ink-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl' : ''}`} style={{ marginInline: 'max(12px, calc((100vw - 1240px) / 2))' }}>
      {/* The name alone, at a size that reads from across the page; it glitches all the time, with a bigger burst now and then and on hover. */}
      <Link to="/" className="flex h-11 shrink-0 items-center rounded-full px-1.5" aria-label="OUTARCH home"><Wordmark auto live className="block h-[22px] w-auto sm:h-[26px]"/></Link>

      <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
        {LINKS.map(([label, to]) => <Link key={to} to={to} className={`rounded-full px-3.5 py-2 text-[14px] transition-colors hover:bg-white/[0.06] hover:text-fg ${path === to ? 'text-fg' : 'text-fg-muted'}`}>{label}</Link>)}
      </nav>

      <div className="flex items-center gap-2">
        {session
          ? <Link to="/account" className="hidden items-center gap-2 rounded-full px-3 py-2 text-[14px] text-fg-soft transition-colors hover:bg-white/[0.06] hover:text-fg sm:inline-flex"><UserCircle size={18}/>Dashboard</Link>
          : <Link to="/auth" className="hidden rounded-full px-3.5 py-2 text-[14px] text-fg-soft transition-colors hover:bg-white/[0.06] hover:text-fg sm:inline-flex">Sign in</Link>}
        <Button to="/#download" size="sm" className="hidden sm:inline-flex"><DownloadSimple size={16} weight="bold"/>Download</Button>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-fg hover:bg-white/[0.08] lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
          {open ? <X size={20}/> : <List size={20}/>}
        </button>
      </div>
    </div>

    <AnimatePresence>
      {open ? <motion.div
        className="fixed inset-x-3 top-[76px] rounded-card bg-ink-800/95 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden"
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <nav className="flex flex-col" aria-label="Main">
          {LINKS.map(([label, to]) => <Link key={to} to={to} className="rounded-field px-4 py-3.5 text-[16px] text-fg-soft hover:bg-white/[0.06]">{label}</Link>)}
          <Link to={session ? '/account' : '/auth'} className="rounded-field px-4 py-3.5 text-[16px] text-fg-soft hover:bg-white/[0.06]">{session ? 'Dashboard' : 'Sign in'}</Link>
        </nav>
        <div className="mt-2 border-t border-line pt-3">
          <Button to="/#download" className="w-full" magnetic={false}><DownloadSimple size={17} weight="bold"/>Download for Windows</Button>
        </div>
      </motion.div> : null}
    </AnimatePresence>
  </header>;
}
