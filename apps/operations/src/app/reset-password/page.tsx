export const dynamic = 'force-dynamic';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { configured } from '@/server/config';
export default function Reset() {
  return (
    <main id="content" className="center-page">
      <section className="auth-box surface">
        <span className="brand-mark">SS</span>
        <h1>Choose a new password.</h1>
        <p className="muted">A valid recovery session is required. After saving, sign in again.</p>
        <AuthForm mode="reset" configured={configured()} />
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
