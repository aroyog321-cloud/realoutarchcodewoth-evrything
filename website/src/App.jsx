import React, { Suspense, lazy, useEffect } from 'react';
import Lenis from 'lenis';
import Backdrop from './components/Backdrop.jsx';
import Cursor from './components/Cursor.jsx';
import Footer from './components/Footer.jsx';
import Nav from './components/Nav.jsx';
import { Lockup } from './components/Brand.jsx';
import { Link, scrollToId, useRouter } from './lib/router.jsx';
import { updatePageMetadata } from './lib/seo.js';
import Home from './pages/Home.jsx';

// Pages other than the home page load on demand.
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const MobilePage = lazy(() => import('./pages/MobilePage.jsx'));
const UpgradePolicyPage = lazy(() => import('./pages/UpgradePolicyPage.jsx'));
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

// The Legal & privacy section. The policy paths and titles repeat the ones in
// src/legal/outarchPolicies.js so this file does not pull the policy text into
// the first page load; test/legalPolicies.test.cjs keeps the two in step.
const LEGAL_TITLES = {
  '/legal': 'Legal & privacy',
  '/terms': 'Terms of service',
  '/eula': 'End user licence agreement',
  '/privacy': 'Privacy policy',
  '/ai-data': 'AI & developer data',
  '/ai-terms': 'AI services terms',
  '/acceptable-use': 'Acceptable use policy',
  '/mobile-privacy': 'Mobile companion privacy',
  '/cookies': 'Cookie policy',
  '/data-retention': 'Data retention & deletion',
  '/security': 'Security & responsible disclosure',
  '/subprocessors': 'Third-party services',
  '/licenses': 'Open-source licences',
  '/refunds': 'Refunds and cancellation',
  '/delivery': 'Delivery',
  '/contact': 'Contact',
};
const LEGAL = new Set(Object.keys(LEGAL_TITLES));

function page(path) {
  if (path === '/') return Home;
  if (path === '/pricing') return PricingPage;
  if (path === '/checkout' || path === '/checkout/return') return CheckoutPage;
  if (path === '/auth') return AuthPage;
  if (path === '/account') return AccountPage;
  if (path === '/mobile') return MobilePage;
  if (path === '/upgrades' || path === '/upgrade-policy') return UpgradePolicyPage;
  if (LEGAL.has(path)) return LegalPage;
  return NotFound;
}

const TITLES = {
  '/': 'OUTARCH | One command center for your terminals, tests and AI agents',
  '/pricing': 'Pricing | OUTARCH',
  '/checkout': 'Checkout | OUTARCH',
  '/checkout/return': 'Payment | OUTARCH',
  '/auth': 'Sign in | OUTARCH',
  '/account': 'Dashboard | OUTARCH',
  '/mobile': 'Mobile companion | OUTARCH',
  '/upgrades': 'Plan Upgrade & Credit Conversion | OUTARCH',
  '/upgrade-policy': 'Plan Upgrade & Credit Conversion | OUTARCH',
  ...Object.fromEntries(Object.entries(LEGAL_TITLES).map(([to, title]) => [to, `${title} | OUTARCH`])),
};

// Smooth wheel scrolling. `lerp` eases toward where the wheel points and stays
// close behind it; the old fixed 1.1s glide kept moving long after the wheel
// stopped, which read as lag. Inner scroll areas (a terminal in the live demo,
// for example) scroll themselves while they still can, then hand back to the page.
function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return undefined;
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, allowNestedScroll: true, autoRaf: true });
    window.__lenis = lenis;
    return () => { lenis.destroy(); window.__lenis = null; };
  }, []);
}

function PageFallback() {
  return <div className="grid min-h-[70dvh] place-items-center" role="status" aria-label="Loading">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-sky"/>
  </div>;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page render error:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <section className="mx-auto max-w-[560px] px-5 py-32 text-center">
        <div className="card p-8 sm:p-10">
          <h1 className="display text-[26px]">Could not load this page</h1>
          <p className="mt-3 text-[15px] text-fg-muted">An unexpected error occurred while loading this view. You can reload or return home.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Reload page</button>
            <Link to="/" className="btn btn--glass" onClick={() => this.setState({ hasError: false })}>Back to home</Link>
          </div>
        </div>
      </section>;
    }
    return this.props.children;
  }
}

export default function App() {
  const { path, hash, query } = useRouter();
  const Page = page(path);
  // Signing in for the desktop app is a single-purpose page: no site navigation.
  const focused = path === '/auth' && query.get('client') === 'desktop';

  useSmoothScroll();
  useEffect(() => { updatePageMetadata(path); }, [path]);
  useEffect(() => {
    if (!hash) return undefined;
    const timer = window.setTimeout(() => scrollToId(hash.slice(1)), 120);
    return () => window.clearTimeout(timer);
    // Only on first arrival at a page with a hash; in-page links scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-brand-blue focus:px-4 focus:py-2">Skip to content</a>
    <Backdrop/>
    <div className="grain" aria-hidden="true"/>
    <Cursor/>
    {focused
      ? <header className="relative z-[2] mx-auto flex h-20 max-w-page items-center px-5 md:px-8"><Link to="/" aria-label="OUTARCH home"><Lockup/></Link></header>
      : <Nav/>}
    <main id="main" className="relative z-[1]">
      <ErrorBoundary resetKey={path}>
        <Suspense fallback={<PageFallback/>}>
          <Page/>
        </Suspense>
      </ErrorBoundary>
    </main>
    {focused ? null : <Footer/>}
  </>;
}
