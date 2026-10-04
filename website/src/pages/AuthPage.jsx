import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, CircleNotch, Desktop, Envelope, Eye, EyeSlash, Crown, ShieldCheck, WifiSlash, Key } from '@phosphor-icons/react';
import { BrandIcon, Wordmark } from '../components/Brand.jsx';
import { EASE } from '../components/ui.jsx';
import { clientFor, isDesktopFlow, website } from '../lib/supabase.js';
import { desktopCallback, desktopState, takeRedirectTokensOnce } from '../lib/desktopHandoff.js';
import { useRouter } from '../lib/router.jsx';

// Sign in, create an account, or reset password, with email and password or Google.
//
// Opened by the OUTARCH desktop app (/auth?client=desktop&state=...), the page
// hands the session back to the app when the operator is done. Opened on its
// own, it signs the operator into the website and goes on to `next` or their
// Account.

function friendly(message = '') {
  const text = String(message);
  if (/invalid login credentials/i.test(text)) return "That email and password don't match an OUTARCH account.";
  if (/email not confirmed/i.test(text)) return 'Confirm your email address first. We sent you a link when you signed up.';
  if (/user already registered|already been registered/i.test(text)) return 'An account already uses this email. Sign in instead.';
  if (/password should be at least|weak password/i.test(text)) return 'Use a password of at least 8 characters.';
  if (/passwords do not match/i.test(text)) return 'Passwords do not match. Please re-enter both passwords.';
  if (/same as the old password|should be different/i.test(text)) return 'New password should be different from your old password.';
  if (/token has expired|otp expired|session expired|invalid token/i.test(text)) return 'This reset link has expired. Please request a new one.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a minute and try again.';
  if (/provider is not enabled|unsupported provider/i.test(text)) return 'Google sign-in is not switched on for OUTARCH yet. Use your email and password for now.';
  if (/failed to fetch|network/i.test(text)) return 'OUTARCH could not reach its account service. Check your connection and try again.';
  return text || 'Something went wrong. Try again.';
}

// Only a path on this site may be the page we go to afterwards.
function safeNext(value) {
  return typeof value === 'string' && /^\/[A-Za-z0-9/_?=&.%-]*$/.test(value) && !value.startsWith('//') ? value : null;
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>;
}

function Field({ label, hint, children, action }) {
  return <label className="flex flex-col gap-2">
    <span className="flex items-center justify-between text-[14px] font-medium text-fg-soft">{label}{action}</span>
    {children}
    {hint ? <small className="text-[13px] text-fg-dim">{hint}</small> : null}
  </label>;
}

function Message({ tone, children }) {
  if (!children) return null;
  const styles = tone === 'error'
    ? 'bg-brand-red/10 text-[#ffb3b3] shadow-[inset_0_0_0_1px_rgba(255,95,95,0.4)]'
    : 'bg-brand-mint/10 text-[#b5f0e2] shadow-[inset_0_0_0_1px_rgba(63,208,181,0.4)]';
  return <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role={tone === 'error' ? 'alert' : 'status'} className={`rounded-field px-4 py-3 text-[14px] leading-relaxed ${styles}`}>{children}</motion.p>;
}

function BrandPanel({ desktopFlow, mode }) {
  const points = desktopFlow
    ? [[Desktop, 'Signs in the app on this computer', 'The browser hands your session to OUTARCH, which keeps it encrypted.'], [WifiSlash, 'Keeps working offline', 'Up to 72 hours on the last plan it confirmed.'], [ShieldCheck, 'Only your account service', 'Your password goes to OUTARCH\'s account service and nowhere else.']]
    : mode === 'reset-set' || mode === 'reset-request'
    ? [[Key, 'Secure recovery', 'Change your password safely to restore access to your account.'], [Crown, 'Plan preserved', 'All your subscriptions, tokens, and data stay intact.'], [ShieldCheck, 'End-to-end encrypted', 'Your credentials are handled directly by your account service.']]
    : [[Crown, 'One plan, every install', 'Sign in on any computer and your plan comes with you.'], [Desktop, 'Hands off to the app', 'The desktop app signs in through this page, once.'], [ShieldCheck, 'Free to start', 'New accounts start on the Free plan. No card needed.']];
  
  const title = desktopFlow
    ? 'Almost there. Sign in to open OUTARCH.'
    : mode === 'reset-set'
    ? 'Set a new password for your account.'
    : mode === 'reset-request'
    ? 'Recover access to your account.'
    : 'Your command center, one sign-in away.';

  return <div className="relative hidden overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,rgba(47,123,255,0.28),rgba(155,123,255,0.14)_50%,rgba(63,208,181,0.18))] p-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] lg:flex lg:flex-col">
    <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.18),transparent)]"/>
    <motion.div initial={{ rotate: -8, scale: 0.9, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 1, ease: EASE }}><BrandIcon size={72}/></motion.div>
    <h2 className="display mt-10 text-[34px]">{title}</h2>
    <div className="mt-10 flex flex-col gap-6">
      {points.map(([Icon, pointTitle, body], index) => <motion.div key={pointTitle} className="flex gap-4" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.1, duration: 0.6, ease: EASE }}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"><Icon size={19} weight="duotone"/></span>
        <div><p className="font-medium">{pointTitle}</p><p className="mt-0.5 text-[14px] text-fg-soft/80">{body}</p></div>
      </motion.div>)}
    </div>
    <Wordmark auto className="mt-auto h-auto w-[78%] max-w-[380px] pt-12 opacity-90"/>
  </div>;
}

export default function AuthPage() {
  const { navigate, query } = useRouter();
  const desktopFlow = useMemo(() => isDesktopFlow(), []);
  const state = useMemo(() => (desktopFlow ? desktopState() : null), [desktopFlow]);
  const next = safeNext(query.get('next'));
  const client = clientFor(desktopFlow);

  const initialMode = () => {
    const m = query.get('mode');
    const t = query.get('type');
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const isRecovery = t === 'recovery' || hash.includes('type=recovery');
    if (m === 'reset-set' || m === 'new-password' || isRecovery) return 'reset-set';
    if (m === 'reset-request' || m === 'reset' || m === 'forgot') return 'reset-request';
    if (m === 'signup') return 'signup';
    return 'signin';
  };

  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(desktopFlow && !state ? 'This sign-in page was opened without its link to the OUTARCH app. Start signing in from OUTARCH again.' : '');
  const [notice, setNotice] = useState('');
  const [handoff, setHandoff] = useState(null);
  const finished = useRef(false);

  // Where a redirect (Google, an email link) should come back to: this page,
  // with the same app link, so the session still reaches the right place.
  const returnUrl = () => {
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('mode');
    return url.toString();
  };

  async function finish(session) {
    // A session is handed on once, however many times this is reached.
    if (finished.current) return;
    finished.current = true;

    // Ensure policy acceptance timestamp is recorded in Supabase user metadata
    if (session?.user) {
      try {
        const meta = session.user.user_metadata || {};
        if (!meta.terms_accepted) {
          await client.auth.updateUser({
            data: {
              terms_accepted: true,
              terms_accepted_at: new Date().toISOString(),
              terms_version: '2026-10-01',
            },
          });
        }
      } catch (metaErr) {
        console.warn('Metadata recording notice:', metaErr);
      }
    }

    if (desktopFlow) {
      const link = desktopCallback(session, state);
      if (!link) {
        finished.current = false;
        setError('This sign-in link has expired. Start signing in from OUTARCH again.');
        return;
      }
      setHandoff(link);
      setMode('handoff');
      window.location.href = link;
      return;
    }
    const { error: sessionError } = await website().auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (sessionError) { finished.current = false; setError(friendly(sessionError.message)); return; }
    navigate(next || '/account', { replace: true });
  }

  // Listen to Supabase PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset-set');
        setError('');
      }
    });
    return () => {
      subscription?.unsubscribe?.();
    };
  }, [client]);

  // A session a redirect brought back: Google, a confirmed email, a reset link.
  useEffect(() => {
    const taken = takeRedirectTokensOnce();
    if (!taken) return;
    if (taken.error) { setError(friendly(taken.error)); return; }
    if (taken.type === 'recovery' || taken.tokenHash) {
      if (taken.tokenHash) {
        client.auth.verifyOtp({ token_hash: taken.tokenHash, type: 'recovery' })
          .then(({ error: otpError }) => {
            if (otpError) setError(friendly(otpError.message));
            else setMode('reset-set');
          });
        return;
      }
      if (taken.session) {
        client.auth.setSession({ access_token: taken.session.access_token, refresh_token: taken.session.refresh_token })
          .then(({ error: recoveryError }) => {
            if (recoveryError) setError(friendly(recoveryError.message));
            else setMode('reset-set');
          });
        return;
      }
      if (taken.code) {
        client.auth.exchangeCodeForSession(taken.code)
          .then(({ error: codeError }) => {
            if (codeError) setError(friendly(codeError.message));
            else setMode('reset-set');
          });
        return;
      }
      setMode('reset-set');
      return;
    }
    if (taken.session) {
      void finish(taken.session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already signed in on the website: go straight on (never in the app flow,
  // which must always hand over a fresh session, and never when resetting a password).
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const isRecovery = query.get('type') === 'recovery' || hash.includes('type=recovery') || query.get('mode') === 'reset-set' || query.get('mode') === 'reset-request' || query.get('mode') === 'new-password' || query.get('mode') === 'reset' || query.get('mode') === 'forgot';
    if (desktopFlow || isRecovery || mode === 'reset-set' || mode === 'reset-request' || takeRedirectTokensOnce()) return;
    website().auth.getSession().then(({ data }) => {
      if (data?.session && !finished.current) {
        navigate(next || '/account', { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function run(task) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await task(); }
    catch (reason) { setError(friendly(reason?.message)); }
    finally { setBusy(false); }
  }

  const switchMode = value => {
    setMode(value);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const google = () => run(async () => {
    const { error: oauthError } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: returnUrl(), queryParams: { prompt: 'select_account' } },
    });
    if (oauthError) throw oauthError;
  });

  const submit = event => {
    event.preventDefault();
    if (mode === 'signin') {
      return run(async () => {
        const { data, error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        await finish(data.session);
      });
    }
    if (mode === 'signup') {
      return run(async () => {
        if (!agreePolicy) throw new Error('Please accept the required terms and policies to create an account.');
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        const acceptedAt = new Date().toISOString();
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim() || undefined,
              terms_accepted: true,
              terms_accepted_at: acceptedAt,
              terms_version: '2026-10-01',
            },
            emailRedirectTo: returnUrl(),
          },
        });
        if (signUpError) throw signUpError;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('User already registered');
        if (data.session) await finish(data.session);
        else setMode('confirm');
      });
    }
    if (mode === 'reset-request') {
      return run(async () => {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: returnUrl() });
        if (resetError) throw resetError;
        setNotice(`If ${email.trim()} has an OUTARCH account, a reset link is on its way.`);
      });
    }
    if (mode === 'reset-set') {
      return run(async () => {
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match. Please re-enter both passwords.');
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice('Your password has been updated successfully!');
        const { data } = await client.auth.getSession();
        if (data?.session) {
          if (desktopFlow) {
            await finish(data.session);
          } else {
            setTimeout(() => {
              navigate(next || '/account', { replace: true });
            }, 900);
          }
        } else {
          setMode('signin');
          setNotice('Your password is changed. Sign in with your new password.');
        }
      });
    }
    return undefined;
  };

  const resend = () => run(async () => {
    const { error: resendError } = await client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: returnUrl() } });
    if (resendError) throw resendError;
    setNotice('We sent the confirmation link again.');
  });

  const title = {
    signin: 'Sign in to OUTARCH',
    signup: 'Create your account',
    'reset-request': 'Reset your password',
    'reset-set': 'Choose a new password',
  }[mode] || 'Sign in to OUTARCH';

  const lead = {
    signin: 'Welcome back. Pick up where your terminals left off.',
    signup: 'New accounts start on the Free plan. Upgrade whenever you need more.',
    'reset-request': "Enter the email you signed up with and we'll send you a link to choose a new password.",
    'reset-set': 'Choose a strong password with at least 8 characters for your account.',
  }[mode] || '';

  const passwordMode = mode === 'signin' || mode === 'signup';
  const emailMode = mode !== 'reset-set';
  const blocked = desktopFlow && !state;

  let body;
  if (mode === 'handoff') {
    body = <div className="text-center" aria-live="polite">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-mint/15 text-brand-mint shadow-[inset_0_0_0_1px_rgba(63,208,181,0.45)]"><CheckCircle size={34} weight="fill"/></motion.span>
      <h1 className="display mt-6 text-[30px]">You're signed in</h1>
      <p className="mt-3 text-[15.5px] text-fg-muted">OUTARCH is opening. You can close this tab once it does.</p>
      <a className="btn btn--primary mt-8 w-full" href={handoff}>Open OUTARCH</a>
      <p className="mt-5 text-[13.5px] leading-relaxed text-fg-dim">Nothing happened? Make sure OUTARCH is still open, then select Open OUTARCH. If your browser asks, allow it to open OUTARCH.</p>
    </div>;
  } else if (mode === 'confirm') {
    body = <div className="text-center" aria-live="polite">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-blue/15 text-brand-sky shadow-[inset_0_0_0_1px_rgba(47,123,255,0.45)]"><Envelope size={30} weight="duotone"/></span>
      <h1 className="display mt-6 text-[30px]">Check your inbox</h1>
      <p className="mt-3 text-[15.5px] text-fg-muted">We sent a confirmation link to <b className="text-fg">{email.trim()}</b>. Open it on this computer{desktopFlow ? ' and OUTARCH signs you in automatically' : ' to finish creating your account'}.</p>
      <div className="mt-6 flex flex-col gap-3"><Message tone="notice">{notice}</Message><Message tone="error">{error}</Message></div>
      <button type="button" className="btn btn--glass mt-6 w-full" disabled={busy} onClick={resend}>{busy ? 'Sending…' : 'Send the link again'}</button>
      <button type="button" className="mt-4 text-[14px] text-fg-muted hover:text-fg" onClick={() => switchMode('signin')}>Back to sign in</button>
    </div>;
  } else {
    body = <>
      {desktopFlow ? <span className="chip mb-5"><Desktop size={14}/>Signing in to the OUTARCH app</span> : null}
      <h1 className="display text-[clamp(1.9rem,3vw,2.4rem)]">{title}</h1>
      <p className="mt-2.5 text-[15.5px] text-fg-muted">{lead}</p>
      {mode === 'signin' || mode === 'signup' ? <>
        <button type="button" className="btn btn--glass mt-8 w-full" disabled={busy || blocked} onClick={google}><GoogleMark/>Continue with Google</button>
        <div className="my-6 flex items-center gap-3 text-[13px] text-fg-dim" role="separator"><span className="h-px flex-1 bg-white/10"/>or use your email<span className="h-px flex-1 bg-white/10"/></div>
      </> : <div className="h-6"/>}
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        {mode === 'signup' ? <Field label={<span>Name <span className="font-normal text-fg-dim">optional</span></span>}><input className="field" type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80}/></Field> : null}
        {emailMode ? <Field label="Email"><input className="field" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" aria-invalid={Boolean(error) && /email/i.test(error)}/></Field> : null}
        
        {passwordMode ? <Field
          label="Password"
          hint={mode === 'signup' ? 'At least 8 characters.' : null}
          action={mode === 'signin' ? <button type="button" className="text-[13.5px] font-normal text-brand-sky hover:text-fg" onClick={() => switchMode('reset-request')}>Forgot password?</button> : null}
        >
          <span className="relative">
            <input className="field pr-12" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? undefined : 8} value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(error) && /password/i.test(error)}/>
            <button type="button" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-white/[0.07] hover:text-fg" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeSlash size={18}/> : <Eye size={18}/>}</button>
          </span>
        </Field> : null}

        {mode === 'reset-set' ? <>
          <Field label="New password" hint="At least 8 characters.">
            <span className="relative">
              <input
                className="field pr-12"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Enter new password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                aria-invalid={Boolean(error) && /password/i.test(error)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-white/[0.07] hover:text-fg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeSlash size={18}/> : <Eye size={18}/>}
              </button>
            </span>
          </Field>
          <Field
            label="Confirm new password"
            hint={confirmPassword && password !== confirmPassword ? <span className="text-brand-red">Passwords do not match</span> : null}
          >
            <span className="relative">
              <input
                className="field pr-12"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                aria-invalid={Boolean(error) && /match|password/i.test(error)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-white/[0.07] hover:text-fg"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword(value => !value)}
              >
                {showConfirmPassword ? <EyeSlash size={18}/> : <Eye size={18}/>}
              </button>
            </span>
          </Field>
        </> : null}

        {mode === 'signup' ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-field border border-white/10 bg-white/[0.02] p-3 text-[13px] leading-snug text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] select-none">
            <input
              id="auth-policy-agree"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-brand-sky accent-brand-sky focus:ring-brand-sky cursor-pointer"
              checked={agreePolicy}
              onChange={e => {
                setAgreePolicy(e.target.checked);
                if (error && /terms|policy|policies/i.test(error)) setError('');
              }}
            />
            <span>
              I agree to the <a className="text-brand-sky underline hover:text-white" href="/terms" target="_blank" rel="noopener">Terms of service</a>, <a className="text-brand-sky underline hover:text-white" href="/eula" target="_blank" rel="noopener">EULA</a>, <a className="text-brand-sky underline hover:text-white" href="/privacy" target="_blank" rel="noopener">Privacy policy</a>, <a className="text-brand-sky underline hover:text-white" href="/acceptable-use" target="_blank" rel="noopener">Acceptable use</a>, and <a className="text-brand-sky underline hover:text-white" href="/refunds" target="_blank" rel="noopener">Refund policy</a>, and confirm I am 18 or older.
            </span>
          </label>
        ) : null}

        <AnimatePresence>{notice ? <Message tone="notice">{notice}</Message> : null}</AnimatePresence>
        <AnimatePresence>{error ? <Message tone="error">{error}</Message> : null}</AnimatePresence>
        <button
          type="submit"
          className="btn btn--primary btn--lg w-full"
          disabled={
            busy ||
            blocked ||
            (mode === 'signin' && (!email.trim() || !password)) ||
            (mode === 'signup' && (!email.trim() || !password || !agreePolicy)) ||
            (mode === 'reset-request' && !email.trim()) ||
            (mode === 'reset-set' && (!password || !confirmPassword || password.length < 8))
          }
        >
          {busy ? <CircleNotch size={18} className="animate-spin"/> : null}
          {{ signin: 'Sign in', signup: 'Create account', 'reset-request': 'Send reset link', 'reset-set': 'Save password' }[mode]}
        </button>
      </form>
      <p className="mt-7 text-center text-[14.5px] text-fg-muted">
        {mode === 'signin' ? <>New to OUTARCH? <button type="button" className="font-medium text-brand-sky hover:text-fg" onClick={() => switchMode('signup')}>Create an account</button></> : null}
        {mode === 'signup' ? <>Already have an account? <button type="button" className="font-medium text-brand-sky hover:text-fg" onClick={() => switchMode('signin')}>Sign in</button></> : null}
        {mode === 'reset-request' ? <button type="button" className="inline-flex items-center gap-1.5 font-medium text-brand-sky hover:text-fg" onClick={() => switchMode('signin')}><ArrowLeft size={14}/>Back to sign in</button> : null}
        {mode === 'reset-set' ? <button type="button" className="inline-flex items-center gap-1.5 font-medium text-brand-sky hover:text-fg" onClick={() => switchMode('signin')}><ArrowLeft size={14}/>Back to sign in</button> : null}
      </p>
      {mode === 'signup'
        ? <p className="mt-5 text-center text-[12.5px] leading-relaxed text-fg-dim">By creating an account you agree to the <a className="underline hover:text-fg" href="/terms" target="_blank" rel="noopener">Terms of service</a>, <a className="underline hover:text-fg" href="/eula" target="_blank" rel="noopener">licence</a> and <a className="underline hover:text-fg" href="/acceptable-use" target="_blank" rel="noopener">acceptable use policy</a>. The <a className="underline hover:text-fg" href="/privacy" target="_blank" rel="noopener">privacy policy</a> explains how we handle your data. You must be 18 or older.</p>
        : mode === 'signin' ? <p className="mt-5 text-center text-[12.5px] text-fg-dim"><a className="underline hover:text-fg" href="/terms" target="_blank" rel="noopener">Terms</a> · <a className="underline hover:text-fg" href="/privacy" target="_blank" rel="noopener">Privacy</a> · <a className="underline hover:text-fg" href="/legal" target="_blank" rel="noopener">All policies</a></p> : null}
    </>;
  }

  return <section className={`mx-auto grid max-w-page items-stretch gap-8 px-5 pb-20 md:px-8 lg:grid-cols-2 ${desktopFlow ? 'pt-4' : 'pt-32'}`}>
    <BrandPanel desktopFlow={desktopFlow} mode={mode}/>
    <div className="flex items-center justify-center">
      <motion.div key={mode} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="card w-full max-w-[460px] p-7 sm:p-10">
        {body}
      </motion.div>
    </div>
  </section>;
}
