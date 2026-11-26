'use client';
import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
type Mode = 'sign-in' | 'recover' | 'reset' | 'register';
export default function AuthForm({ mode, configured }: { mode: Mode; configured: boolean }) {
  const passwordHint = useId();
  const newPassword = mode === 'reset' || mode === 'register';
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [complete, setComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const payload =
        mode === 'reset'
          ? { password: data.get('password') }
          : mode === 'recover'
            ? { email: data.get('email') }
            : {
                login: data.get('login'),
                password: data.get('password'),
                ...(mode === 'register'
                  ? {
                      displayName: data.get('displayName'),
                      contactPhone: String(data.get('contactPhone') ?? '').trim(),
                    }
                  : {}),
              };
      if (mode === 'register' && data.get('password') !== data.get('passwordConfirmation')) {
        setMessage('The passwords must match.');
        return;
      }
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error?.message ?? 'This request could not be completed.');
        return;
      }
      if (mode === 'sign-in') {
        window.location.assign(
          result.data.redirect === '/login?notice=access-pending'
            ? result.data.redirect
            : '/workspace',
        );
        return;
      }
      setComplete(true);
      setMessage(result.data.message);
    } catch {
      setMessage('Connection interrupted. Your entries are preserved. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className={mode === 'register' ? 'auth-form staff-register-form' : 'auth-form'}
    >
      {mode === 'register' && (
        <label className="staff-register-field">
          Full name
          <UserRound className="staff-signin-field-icon" size={17} aria-hidden="true" />
          <input
            name="displayName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={160}
            placeholder="Guna"
            disabled={complete}
          />
        </label>
      )}
      {mode === 'register' && (
        <label className="staff-register-field">
          Contact phone
          <Phone className="staff-signin-field-icon" size={17} aria-hidden="true" />
          <input
            name="contactPhone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            placeholder="9502828981"
            disabled={complete}
          />
        </label>
      )}
      {mode !== 'reset' && (
        <label
          className={
            mode === 'sign-in'
              ? 'staff-signin-field staff-signin-user'
              : mode === 'register'
                ? 'staff-register-field staff-register-wide'
                : undefined
          }
        >
          {mode === 'recover' ? 'Work email' : 'Username or email'}
          {mode === 'sign-in' && (
            <UserRound className="staff-signin-field-icon" size={17} aria-hidden="true" />
          )}
          {mode === 'register' && (
            <Mail className="staff-signin-field-icon" size={17} aria-hidden="true" />
          )}
          <input
            name={mode === 'recover' ? 'email' : 'login'}
            type={mode === 'recover' ? 'email' : 'text'}
            autoComplete={mode === 'recover' ? 'email' : 'username'}
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            placeholder={
              mode === 'register'
                ? 'guna@shreesudhalaundry.com'
                : mode === 'recover'
                  ? 'you@your-company.com'
                  : 'Username or email'
            }
            disabled={complete}
          />
        </label>
      )}
      {mode !== 'recover' && (
        <div
          className={
            mode === 'sign-in'
              ? 'staff-signin-password'
              : mode === 'register'
                ? 'staff-register-password'
                : undefined
          }
        >
          <label
            className={
              mode === 'sign-in'
                ? 'staff-signin-field'
                : mode === 'register'
                  ? 'staff-register-field'
                  : undefined
            }
          >
            {mode === 'reset' ? 'New password' : 'Password'}
            {(mode === 'sign-in' || mode === 'register') && (
              <LockKeyhole className="staff-signin-field-icon" size={17} aria-hidden="true" />
            )}
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={newPassword ? 'new-password' : 'current-password'}
              minLength={newPassword ? 12 : 1}
              maxLength={256}
              placeholder={mode === 'register' ? 'At least 12 characters' : undefined}
              aria-describedby={newPassword ? passwordHint : undefined}
              onChange={mode === 'register' ? (e) => setPasswordValue(e.target.value) : undefined}
              required
              disabled={complete}
            />
          </label>
          {mode === 'reset' && <small id={passwordHint}>At least 12 characters.</small>}
          {(mode === 'sign-in' || mode === 'register') && (
            <>
              <button
                type="button"
                className="staff-signin-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Eye size={17} aria-hidden="true" />
                )}
              </button>
            </>
          )}
        </div>
      )}
      {mode === 'sign-in' && (
        <Link className="staff-signin-recovery" href="/forgot-password">
          Forgot your password?
        </Link>
      )}
      {mode === 'register' && (
        <div className="staff-register-password">
          <label className="staff-register-field">
            Confirm password
            <LockKeyhole className="staff-signin-field-icon" size={17} aria-hidden="true" />
            <input
              name="passwordConfirmation"
              type={showConfirmation ? 'text' : 'password'}
              aria-describedby={passwordHint}
              autoComplete="new-password"
              placeholder="Re-enter password"
              onChange={(e) => setConfirmValue(e.target.value)}
              required
              minLength={12}
              maxLength={256}
              disabled={complete}
            />
          </label>
          <button
            type="button"
            className="staff-signin-toggle"
            aria-label={
              showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'
            }
            onClick={() => setShowConfirmation((visible) => !visible)}
          >
            {showConfirmation ? (
              <EyeOff size={17} aria-hidden="true" />
            ) : (
              <Eye size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
      {mode === 'register' && (
        <small
          className={`staff-register-wide staff-register-hint${
            passwordValue.length >= 12 && confirmValue === passwordValue
              ? ' is-ready'
              : confirmValue && confirmValue !== passwordValue
                ? ' is-mismatch'
                : ''
          }`}
          id={passwordHint}
        >
          {!passwordValue && !confirmValue
            ? 'Use at least 12 characters for your password.'
            : `${passwordValue.length >= 12 ? '12+ characters ✓' : `${passwordValue.length}/12 characters`}${
                confirmValue
                  ? confirmValue === passwordValue
                    ? ' · Passwords match ✓'
                    : ' · Passwords do not match'
                  : ''
              }`}
        </small>
      )}
      <p role="status" className={complete ? 'notice success' : 'form-error'} hidden={!message}>
        {message}
      </p>
      <button className="button" disabled={busy || !configured || complete} type="submit">
        {busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{' '}
        {mode === 'sign-in'
          ? 'Sign in securely'
          : mode === 'recover'
            ? 'Send recovery email'
            : mode === 'register'
              ? 'Submit for approval'
              : 'Save new password'}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
