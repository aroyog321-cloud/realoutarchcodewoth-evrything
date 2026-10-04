import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AndroidLogo, ArrowRight, CaretDown, Code, DeviceMobile, DownloadSimple, QrCode, ShieldCheck, WindowsLogo,
} from '@phosphor-icons/react';
import { PlanCards, PricingControls } from '../components/Pricing.jsx';
import { Button, EASE, Reveal, SectionTitle, useSpotlight } from '../components/ui.jsx';
import { Wordmark } from '../components/Brand.jsx';
import { formatBytes, microsoftStoreLinks, useCatalog, VS_CODE_MARKETPLACE_URL } from '../lib/catalog.js';
import { useCurrency } from '../lib/currency.js';
import { Link } from '../lib/router.jsx';

// ------------------------------------------------------------------ pricing

export function PricingSection() {
  const catalog = useCatalog();
  const [currency, setCurrency] = useCurrency();
  const [period, setPeriod] = useState('month');
  return <section id="pricing" className="relative z-[1] mx-auto max-w-page scroll-mt-24 px-5 py-24 md:px-8">
    <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[420px] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(155,123,255,0.14),transparent)]" aria-hidden="true"/>
    <SectionTitle align="center" kicker="Pricing" title="Start free. Upgrade when your stack grows." lede="Pay for a month or a year. Your plan switches on as soon as the payment clears, and nothing renews automatically."/>
    <Reveal delay={0.1} className="mt-10"><PricingControls period={period} setPeriod={setPeriod} currency={currency} setCurrency={setCurrency}/></Reveal>
    <div className="mt-10"><PlanCards plans={catalog.plans} prices={catalog.prices} period={period} currency={currency}/></div>
    <p className="mt-6 text-center text-[13.5px] text-fg-dim">*Unlimited Mission AI has a fair-use limit of 2,000 messages a day. No hidden fees, though your bank may charge for currency conversion. <Link to="/pricing#compare" className="link-underline text-fg-muted hover:text-fg">Compare every limit</Link></p>
  </section>;
}

// ------------------------------------------------------------------ download

export function DownloadSection() {
  const { release, androidApkUrl, microsoftStoreId, loading } = useCatalog();
  // Once the app is listed, Windows installs come from the Microsoft Store.
  const store = microsoftStoreLinks(microsoftStoreId);
  const spotlight = useSpotlight();
  const published = release ? new Date(release.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return <section id="download" className="relative z-[1] mx-auto max-w-page scroll-mt-24 px-5 py-24 md:px-8">
    <SectionTitle title="Get OUTARCH." lede="Everything runs in the desktop app. The mobile companion and the VS Code bridge connect to it."/>
    <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Reveal className="h-full">
        <article onPointerMove={spotlight} className="card spotlight relative flex h-full flex-col overflow-hidden p-7 sm:p-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(47,123,255,0.35),transparent)]"/>
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand-blue/15 text-brand-sky shadow-[inset_0_0_0_1px_rgba(47,123,255,0.4)]"><WindowsLogo size={24} weight="fill"/></span>
            <div>
              <h3 className="text-[22px] font-semibold">OUTARCH for Windows</h3>
              <p className="text-[14px] text-fg-muted">{store ? 'Windows 10 and 11 · Microsoft Store · Free plan included' : release ? `Version ${release.version} · ${formatBytes(release.size_bytes)} · ${published}` : loading ? 'Checking for the latest version…' : 'Windows 11 · Free plan included'}</p>
            </div>
          </div>
          <ol className="relative mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(store ? STORE_STEPS : [
              ['Download and extract the ZIP', 'Any folder works, for example D:\\Apps\\OUTARCH.'],
              ['Run OPEN_OUTARCH_WINDOWS.cmd', 'The first run installs what OUTARCH needs, which takes a few minutes. It requires Node.js 22.12 or newer (22 LTS).'],
              ['Sign in when OUTARCH opens', 'The app opens this website so you can create a free account or sign in, then your browser sends you back.'],
              ['Open your project', 'Add your terminals and agents. New versions are offered inside the app, signed and verified.'],
            ]).map(([title, body], index) => <li key={title} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[12.5px] text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">{index + 1}</span>
              <div className="min-w-0"><p className="text-[15px] font-medium [overflow-wrap:anywhere]">{title}</p><p className="mt-0.5 text-[13.5px] leading-relaxed text-fg-muted">{body}</p></div>
            </li>)}
          </ol>
          <div className="relative mt-auto pt-9">
            {store
              ? <div className="flex flex-wrap items-center gap-3">
                <Button href={store.install} size="lg" cursor="Get it"><DownloadSimple size={19} weight="bold"/>Download for Windows</Button>
                <a href={store.listing} target="_blank" rel="noreferrer" className="link-underline text-[14px] text-fg-muted hover:text-fg">View in the Microsoft Store</a>
              </div>
              : release
              ? <div className="flex flex-wrap items-center gap-3">
                <Button href={release.download_url} size="lg" cursor="Download" download><DownloadSimple size={19} weight="bold"/>Download for Windows</Button>
                <a href={NODE_22_URL} target="_blank" rel="noreferrer" className="link-underline text-[14px] text-fg-muted hover:text-fg">Get Node.js 22 LTS</a>
              </div>
              : <div className="rounded-field bg-white/[0.04] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                <p className="text-[15px] font-medium">{loading ? 'Looking up the latest build…' : 'The Windows download is almost ready.'}</p>
                {!loading ? <p className="mt-1 text-[14px] text-fg-muted">It appears here as soon as it is published. You do not need an account to download: the app asks you to sign in the first time it opens.</p> : null}
                {!loading ? <div className="mt-4"><Button to="/#demo" variant="glass" size="sm">Try the live demo meanwhile<ArrowRight size={15}/></Button></div> : null}
              </div>}
            <p className="mt-4 text-[13px] leading-relaxed text-fg-dim">By downloading and using OUTARCH you agree to the <Link to="/terms" className="link-underline text-fg-muted hover:text-fg">Terms of service</Link> and the <Link to="/eula" className="link-underline text-fg-muted hover:text-fg">licence</Link>. The app asks you to confirm when it first starts. See the <Link to="/privacy" className="link-underline text-fg-muted hover:text-fg">privacy policy</Link> for what it sends and when.</p>
            {!store && release?.sha256 ? <p className="mt-4 flex items-center gap-2 font-mono text-[11.5px] text-fg-dim"><ShieldCheck size={14} className="text-brand-mint"/>SHA-256 {release.sha256.slice(0, 16)}…{release.sha256.slice(-8)}</p> : null}
          </div>
        </article>
      </Reveal>
      <div className="grid grid-cols-1 gap-5">
        <Reveal delay={0.06}>
          <article id="mobile-app" onPointerMove={spotlight} className="card spotlight relative scroll-mt-28 overflow-hidden p-7" style={{ '--spot': '63,208,181' }}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-brand-mint/10 text-brand-mint shadow-[inset_0_0_0_1px_rgba(63,208,181,0.35)]"><DeviceMobile size={22} weight="duotone"/></span>
              <div><h3 className="text-[18px] font-semibold">Mobile companion</h3><p className="text-[13.5px] text-fg-muted">Pro and Ultimate</p></div>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-fg-muted">It installs from your phone's browser, so there is no app store step.</p>
            <ol className="mt-4 flex flex-col gap-2 text-[14px] text-fg-soft">
              {['In OUTARCH, open Integrations, then Mobile Companion.', 'Scan the QR code with your phone on the same network.', 'Check the 6-digit code matches, tap Pair this phone, then add it to your home screen.'].map((step, index) => <li key={step} className="flex gap-2.5"><span className="font-mono text-[12.5px] text-brand-mint">{index + 1}</span>{step}</li>)}
            </ol>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button to="/mobile" variant="mint" size="sm" magnetic={false}><DeviceMobile size={16} weight="bold"/>Install the mobile app</Button>
              {androidApkUrl
                ? <Button href={androidApkUrl} variant="glass" size="sm" magnetic={false} download><AndroidLogo size={16} weight="fill"/>Android APK</Button>
                : <span className="chip"><QrCode size={14}/>Pairs by QR code</span>}
            </div>
            <p className="mt-4 text-[13px] text-fg-dim"><Link to="/mobile-privacy" className="link-underline text-fg-muted hover:text-fg">Mobile privacy and permissions</Link></p>
          </article>
        </Reveal>
        <Reveal delay={0.12}>
          <article onPointerMove={spotlight} className="card spotlight relative overflow-hidden p-7" style={{ '--spot': '155,123,255' }}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-brand-violet/10 text-brand-violet shadow-[inset_0_0_0_1px_rgba(155,123,255,0.35)]"><Code size={22} weight="duotone"/></span>
              <div><h3 className="text-[18px] font-semibold">VS Code bridge</h3><p className="text-[13.5px] text-fg-muted">Ultimate</p></div>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-fg-muted">Install the extension from the official Visual Studio Marketplace in one click, then connect it in OUTARCH under <span className="text-fg-soft">Integrations, VS Code Bridge</span>.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button href={VS_CODE_MARKETPLACE_URL} target="_blank" rel="noreferrer" variant="primary" size="sm" magnetic={false}><Code size={16} weight="bold"/>Install for VS Code</Button>
            </div>
            <p className="mt-4 text-[13px] text-fg-dim">It shares file paths, diagnostics, Git state and VS Code terminal activity with the app on this computer, never file contents. <Link to="/ai-data#vs-code-bridge" className="link-underline text-fg-muted hover:text-fg">What it shares</Link></p>
          </article>
        </Reveal>
      </div>
    </div>
  </section>;
}

// ------------------------------------------------------------------ faq

const NODE_22_URL = 'https://nodejs.org/dist/latest-v22.x/';

const STORE_STEPS = [
  ['Download for Windows', 'Your browser saves a small installer from Microsoft. Open it.'],
  ['The Microsoft Store installs OUTARCH', 'Signed and delivered by Microsoft. Nothing else to set up, and no Node.js needed.'],
  ['Sign in when OUTARCH opens', 'The app opens this website so you can create a free account or sign in, then your browser sends you back.'],
  ['Open your project', 'Add your terminals and agents. The Store keeps OUTARCH up to date.'],
];

const FAQ = [
  ['What is OUTARCH?', 'A command center for your development work on Windows. It runs your terminals, dev servers, tests and AI coding agents in one window, watches them, and tells you when one needs a decision.'],
  ['Is it for vibe coding with AI agents?', 'Yes. Run Claude Code, Codex, Gemini CLI or any CLI agent, several at once, and OUTARCH tells you when one needs an answer. It runs everything else that lives in a terminal too: dev servers, test watchers, databases and plain shells.'],
  ['What platforms does it support?', 'Windows 11. The first run needs Node.js 22 (22.12 or newer) to install what OUTARCH uses. macOS and Linux are not supported yet.'],
  ['Does my code leave my computer?', 'Not unless you use Mission AI. Your terminals, files and the engine run on your computer. When you ask Mission AI something, the context it needs, including any project files it reads to answer you, goes to the AI model you chose. It skips files that hold secrets, and terminal output is included only if you allow it.'],
  ['Which agents work with it?', 'Any agent with a command line runs in an OUTARCH terminal. Permission alerts recognize Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, OpenCode, Goose and Aider. Claude Code, Codex, Gemini CLI and OpenCode also have one-click setup.'],
  ['What happens when an agent needs permission?', 'OUTARCH plays a sound and shows a notice, plus a Windows notification if the app is in the background. One click opens that agent\'s terminal, where you answer as usual. The notice clears as soon as you do.'],
  ['What happens when a worker crashes?', 'It is marked as failed, you get a notice, and it appears in Needs You with what it printed last. Restart it from there, or ask Mission AI what went wrong.'],
  ['What is Mission AI?', 'An assistant built into OUTARCH. It answers from your live workers, errors and history, and it asks for your approval before it runs a command or changes anything. Free includes 3 messages a day.'],
  ['What is project memory?', 'An arch_memory.md that OUTARCH keeps in your project, once you agree to it: what the project is for, how it runs, and every change, error and fix with who made it and why. AI agents such as Claude Code and Codex read it before they work and add a short entry when they finish. When you close OUTARCH after working by hand, Mission AI records what changed. Entries are only ever added, and secrets are removed.'],
  ['What is the mobile companion?', 'A web app for your phone that pairs with OUTARCH over your own network. Use it to see what is running, start or restart terminals and run recipes while you are away from your desk. It installs from the phone\'s browser, with no app store step, and comes with Pro and Ultimate.'],
  ['Do I need an account?', 'Not to download. The first time OUTARCH opens, it sends you to this website to create a free account or sign in, then brings you back. Your plan is tied to that account, and the app keeps working offline for up to 72 hours on the last plan it confirmed.'],
  ['How does pricing work?', 'Plans are prepaid for a month or a year and paid on this website through Dodo Payments, with UPI, cards, netbanking or digital wallets. The app picks up a new plan within five minutes, and nothing renews automatically. When a plan ends, your account returns to Free and your projects and settings stay as they are.'],
  ['Can I move from Pro to Ultimate?', 'Yes. Buy Ultimate and the Pro time you have left carries over, converted at the two monthly prices, so you never pay twice for the same days.'],
  ['Can I get a refund?', 'The refund and cancellation policy explains when you can and how to ask.'],
];

function FaqItem({ question, answer, open, onToggle, index }) {
  return <div className="border-b border-line-soft">
    <h3>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`faq-${index}`} className="flex w-full items-center justify-between gap-6 py-5 text-left text-[16.5px] font-medium text-fg transition-colors hover:text-brand-sky">
        {question}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"><CaretDown size={15}/></motion.span>
      </button>
    </h3>
    <AnimatePresence initial={false}>
      {open ? <motion.div id={`faq-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden">
        <p className="max-w-[70ch] pb-6 text-[15px] leading-relaxed text-fg-muted">{answer}{index === FAQ.length - 1 ? <> <Link to="/refunds" className="link-underline text-fg-soft">Read the refund policy</Link>.</> : null}</p>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

export function FaqSection() {
  const [open, setOpen] = useState(0);
  return <section id="faq" className="relative z-[1] mx-auto grid grid-cols-1 max-w-page scroll-mt-24 gap-12 px-5 py-24 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
    <div>
      <Reveal><h2 className="display text-[clamp(2rem,4.4vw,3.2rem)]">Questions, answered.</h2></Reveal>
      <Reveal delay={0.08}><p className="lede mt-5 text-[16.5px]">Anything else? Write to us from the <Link to="/contact" className="link-underline text-fg-soft">contact page</Link>.</p></Reveal>
    </div>
    <Reveal delay={0.1}>
      <div className="border-t border-line-soft">
        {FAQ.map(([question, answer], index) => <FaqItem key={question} index={index} question={question} answer={answer} open={open === index} onToggle={() => setOpen(open === index ? -1 : index)}/>)}
      </div>
    </Reveal>
  </section>;
}

// ------------------------------------------------------------------ final call to action

export function FinalCta() {
  return <section className="relative z-[1] overflow-hidden px-5 pb-16 pt-24 md:px-8">
    <div className="relative mx-auto max-w-page overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,rgba(47,123,255,0.22),rgba(155,123,255,0.14)_45%,rgba(63,208,181,0.16))] px-6 py-20 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] sm:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" aria-hidden="true"/>
      <Reveal><Wordmark auto className="mx-auto h-auto w-[min(560px,80vw)] cursor-pointer"/></Reveal>
      <Reveal delay={0.08}><p className="mx-auto mt-8 max-w-[46ch] text-[clamp(1.1rem,2vw,1.35rem)] text-fg-soft">Run everything in one place. Step in only when it matters.</p></Reveal>
      <Reveal delay={0.14} className="mt-9 flex flex-wrap justify-center gap-3">
        <Button to="/#download" size="lg" cursor="Get it"><DownloadSimple size={19} weight="bold"/>Download for Windows</Button>
        <Button to="/pricing" size="lg" variant="glass">View pricing</Button>
      </Reveal>
    </div>
  </section>;
}
