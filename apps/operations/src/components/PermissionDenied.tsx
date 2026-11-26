import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
export default function PermissionDenied() {
  return (
    <section className="surface empty-state">
      <ShieldAlert size={36} />
      <h1>Access restricted.</h1>
      <p>
        Your account does not have permission for this action. Contact your administrator if you
        need access.
      </p>
      <Link className="button secondary" href="/workspace">
        Return to overview
      </Link>
    </section>
  );
}
