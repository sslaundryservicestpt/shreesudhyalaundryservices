import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="content" className="center-page">
      <section className="surface auth-box">
        <span className="brand-mark">SS</span>
        <h1>Record not available.</h1>
        <p className="muted">This page may not exist or may be outside your assigned access.</p>
        <Link className="text-link" href="/workspace">
          Return to workspace
        </Link>
      </section>
    </main>
  );
}
