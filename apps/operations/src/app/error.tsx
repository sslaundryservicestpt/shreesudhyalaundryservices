'use client';
import Link from 'next/link';
export default function Failure({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="content" className="center-page">
      <section className="surface auth-box">
        <span className="brand-mark">SS</span>
        <h1>Let’s try that again.</h1>
        <p className="muted">
          This request could not be completed. Your permissions have not changed.
        </p>
        <div className="inline-actions">
          <button className="button" onClick={retry}>
            Try again
          </button>
          <Link className="button secondary" href="/workspace">
            Return to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
