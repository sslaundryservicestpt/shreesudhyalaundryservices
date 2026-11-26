'use client';
import { ErrorState } from '@/components/ui';
export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="surface panel-pad">
      <h1>This view could not be loaded.</h1>
      <ErrorState>
        Your access has not changed. Retry, or refresh the page to review the latest saved data.
      </ErrorState>
      <button className="button secondary" onClick={retry}>
        Retry workspace view
      </button>
    </section>
  );
}
