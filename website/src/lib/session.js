import { useEffect, useState } from 'react';
import { SESSION_STORAGE_KEY } from './config.js';

// The website's own sign-in (not the desktop app's): who is signed in on this
// browser, kept current as they sign in and out. The first answer comes from
// the stored session so the navigation is right at once; the Supabase client
// itself loads after the page has painted and takes over from there.

function storedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.access_token ? parsed : null;
  } catch {
    return null;
  }
}

export function useSession() {
  const [state, setState] = useState(() => ({ session: storedSession(), loading: Boolean(storedSession()) }));
  useEffect(() => {
    let alive = true;
    let unsubscribe = null;
    let cancelDeferred = null;

    const initSupabase = () => {
      import('./supabase.js').then(({ website }) => {
        if (!alive) return;
        const client = website();
        client.auth.getSession().then(({ data }) => { if (alive) setState({ session: data?.session || null, loading: false }); });
        const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
          if (alive) setState({ session: session || null, loading: false });
        });
        unsubscribe = () => listener?.subscription?.unsubscribe();
      }).catch(() => { if (alive) setState(value => ({ ...value, loading: false })); });
    };

    if (state.session) {
      initSupabase();
    } else {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(() => initSupabase(), { timeout: 2500 });
        cancelDeferred = () => window.cancelIdleCallback(handle);
      } else if (typeof window !== 'undefined') {
        const handle = window.setTimeout(initSupabase, 1200);
        cancelDeferred = () => window.clearTimeout(handle);
      }
    }

    return () => { alive = false; unsubscribe?.(); cancelDeferred?.(); };
  }, [state.session]);
  return state;
}
