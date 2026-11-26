export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, KeyRound, UserRoundPlus } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import AuthForm from '@/components/AuthForm';
import { configured } from '@/server/config';

const notices = new Map([
  ['recovery-expired', 'The recovery link is invalid or expired. Request a new one.'],
  [
    'access-pending',
    'Your request is awaiting Admin approval. You can sign in once your role is assigned and your account is activated.',
  ],
]);
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ready = configured(),
    { notice } = await searchParams;
  return (
    <main id="content" className="auth-page login-fit staff-auth">
      <section className="auth-story" aria-labelledby="staff-signin-brand">
        <div className="staff-signin-logo">
          <BrandLogo />
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">SHREE SUDHYA OPERATIONS</p>
          <h2 id="staff-signin-brand">Laundry operations.</h2>
          <p>Manage pickups, deliveries, and billing in one workspace.</p>
        </div>
      </section>
      <section className="auth-panel" aria-labelledby="staff-signin-title">
        <div className="auth-box">
          <header className="staff-signin-card-header">
            <span className="staff-signin-key" aria-hidden="true">
              <KeyRound size={20} />
            </span>
            <div>
              <h1 id="staff-signin-title">Welcome back.</h1>
              <p>Sign in to your Operations workspace.</p>
            </div>
          </header>
          <div className="staff-signin-card-body">
            {!ready && (
              <div className="notice">
                <strong>Sign-in is unavailable</strong>
                <p>Contact your administrator to restore workspace access.</p>
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {notices.get(notice) ??
                  'Your account needs administrator access or local setup. Contact your administrator.'}
              </div>
            )}
            <AuthForm mode="sign-in" configured={ready} />
          </div>
          <Link className="staff-signin-register" href="/register" aria-label="Create an account">
            <UserRoundPlus size={19} aria-hidden="true" />
            <span>
              New team member?{' '}
              <strong>Create an account</strong>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <nav className="login-demo-roles" aria-label="Explore Demo Dashboard">
          <small>Explore Demo Dashboard</small>
          <div>
            {[
              ['admin', 'Admin'],
              ['supervisor', 'Supervisor'],
              ['executive', 'Executive'],
            ].map(([role, label]) => (
              <Link
                key={role}
                className="button secondary"
                href={'/demo?role=' + role}
                aria-label={label + ' demo dashboard'}
              >
                {label}
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </main>
  );
}
