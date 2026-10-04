import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// A small history router. The site has a handful of pages and no nesting, so
// a path-to-page table is all it needs. Links inside the site go through
// navigate() so the page swaps without a reload; anything else is a normal link.

const RouterContext = createContext(null);

function snapshot() {
  return { path: window.location.pathname.replace(/\/+$/, '') || '/', search: window.location.search, hash: window.location.hash };
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(snapshot);

  useEffect(() => {
    const onPop = () => setLocation(snapshot());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const next = new URL(to, window.location.origin);
    if (next.origin !== window.location.origin) { window.location.assign(next.toString()); return; }
    const samePage = (next.pathname.replace(/\/+$/, '') || '/') === (window.location.pathname.replace(/\/+$/, '') || '/');
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${next.pathname}${next.search}${next.hash}`);
    setLocation(snapshot());
    if (next.hash) {
      requestAnimationFrame(() => scrollToId(next.hash.slice(1)));
    } else if (!samePage) {
      window.scrollTo(0, 0);
    }
  }, []);

  const value = useMemo(() => ({ ...location, query: new URLSearchParams(location.search), navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}

export function scrollToId(id) {
  const element = document.getElementById(id);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - 76;
  if (window.__lenis) window.__lenis.scrollTo(top, { duration: 1.2 });
  else window.scrollTo({ top, behavior: 'smooth' });
}

// An in-site link: plain <a> for the browser (middle click, copy address),
// client-side navigation for a normal click.
export function Link({ to, children, onClick, ...rest }) {
  const router = useRouter();
  return <a
    href={to}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (rest.target === '_blank') return;
      event.preventDefault();
      if (router?.navigate) router.navigate(to);
      else window.location.href = to;
    }}
    {...rest}
  >{children}</a>;
}
