import Link from 'next/link';
import { ArrowRight, KeyRound, UserRoundPlus } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import BrandLogo from '@/components/BrandLogo';
import { registrationConfigured } from '@/server/config';

export const dynamic = 'force-dynamic';

export default function Register() {
  const ready = registrationConfigured();
  return (
    <main id="content" className="auth-page login-fit staff-auth">
      <section className="auth-story" aria-labelledby="staff-register-brand">
        <Link
          className="staff-signin-logo"
          href="/login"
          aria-label="Shree Sudhya Operations sign-in"
        >
          <BrandLogo />
        </Link>
        <div className="auth-story-copy">
          <p className="eyebrow">SHREE SUDHYA OPERATIONS</p>
          <h2 id="staff-register-brand">
            Join the <em>Operations team.</em>
          </h2>
        </div>
      </section>
      <section className="auth-panel" aria-labelledby="staff-register-title">
        <div className="auth-box">
          <header className="staff-signin-card-header">
            <span className="staff-signin-key" aria-hidden="true">
              <UserRoundPlus size={20} />
            </span>
            <div>
              <h1 id="staff-register-title">Create an account</h1>
              <p>Administrator approval is required.</p>
            </div>
          </header>
          <div className="staff-signin-card-body">
            {!ready && <p className="notice">Registration is currently unavailable.</p>}
            <AuthForm mode="register" configured={ready} />
          </div>
          <Link className="staff-signin-register" href="/login" aria-label="Sign in">
            <KeyRound size={19} aria-hidden="true" />
            <span>
              Already have an approved account?{' '}
              <strong>Sign in</strong>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
