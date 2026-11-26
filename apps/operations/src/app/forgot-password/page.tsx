export const dynamic = 'force-dynamic';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { configured } from '@/server/config';
export default function Recovery() {
  return (
    <main id="content" className="center-page">
      <section className="auth-box surface">
        <span className="brand-mark">SS</span>
        <h1>Reset your password.</h1>
        <p className="muted">
          Enter your registered work email to request a recovery link. For an internal username or
          dummy email, contact your administrator.
        </p>
        {!configured() && (
          <p className="notice">
            Managed authentication is not configured. See the local setup guide.
          </p>
        )}
        <AuthForm mode="recover" configured={configured()} />
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
