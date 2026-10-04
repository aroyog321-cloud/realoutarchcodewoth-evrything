// Handing a signed-in session back to the OUTARCH desktop app.
//
// The app opened this page as /auth?client=desktop&state=<random>. When the
// operator has signed in, the page sends the session to
//   outarch://auth/callback?state=<same random>#access_token=…&refresh_token=…
// The app accepts it only for a state it issued in the last fifteen minutes,
// and confirms the token with Supabase before trusting it.

const STATE = /^[A-Za-z0-9_-]{20,200}$/;

export function desktopState(location = window.location) {
  const state = new URLSearchParams(location.search).get('state') || '';
  return STATE.test(state) ? state : null;
}

export function desktopCallback(session, state) {
  if (!session?.access_token || !session?.refresh_token || !state) return null;
  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + (Number(session.expires_in) || 3600);
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in || 3600),
    expires_at: String(expiresAt),
    token_type: 'bearer'
  });
  return `outarch://auth/callback?state=${encodeURIComponent(state)}#${fragment.toString()}`;
}

export function desktopFailure(state, message) {
  if (!state) return null;
  const fragment = new URLSearchParams({ error: 'access_denied', error_description: String(message || 'Sign-in did not finish').slice(0, 200) });
  return `outarch://auth/callback?state=${encodeURIComponent(state)}#${fragment.toString()}`;
}

// Tokens a redirect left in the address (implicit flow, PKCE, or recovery): read once, then
// removed so they are not left in the browser history.
export function takeRedirectTokens(location = window.location) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const error = hash.get('error_description') || hash.get('error') || query.get('error_description') || query.get('error');
  const accessToken = hash.get('access_token') || query.get('access_token');
  const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
  const tokenHash = query.get('token_hash') || hash.get('token_hash');
  const code = query.get('code') || hash.get('code');
  const type = hash.get('type') || query.get('type') || null;

  if (!error && !accessToken && !tokenHash && !code) return null;

  const clean = new URL(location.href);
  clean.hash = '';
  for (const key of ['error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'token_hash', 'code']) {
    clean.searchParams.delete(key);
  }
  if (type === 'recovery') {
    clean.searchParams.delete('type');
    clean.searchParams.set('mode', 'reset-set');
  }
  window.history.replaceState(null, '', clean.toString());

  if (error) return { error: error.replace(/\+/g, ' ') };
  return {
    type,
    tokenHash,
    code,
    session: accessToken ? {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: Number(hash.get('expires_in') || query.get('expires_in')) || 3600,
      expires_at: Number(hash.get('expires_at') || query.get('expires_at')) || null,
      token_type: hash.get('token_type') || query.get('token_type') || 'bearer'
    } : null
  };
}

// The address is read once per page load; a remount (React's development
// double render) gets the same result instead of an address already cleaned.
let takenOnce;
export function takeRedirectTokensOnce() {
  if (takenOnce === undefined) takenOnce = takeRedirectTokens();
  return takenOnce;
}
