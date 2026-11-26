'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function ExportButton({ filters }: { filters: Record<string, string | undefined> }) {
  const router = useRouter(),
    request = useRef<{ body: string; key: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const body = JSON.stringify(filters);
            if (request.current?.body !== body)
              request.current = { body, key: crypto.randomUUID() };
            const response = await fetch('/api/v1/reports', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Idempotency-Key': request.current.key,
                },
                body,
              }),
              x = await response.json();
            if (!response.ok) throw Error(x.error?.message || 'Export could not be queued.');
            request.current = null;
            router.push(`/workspace/exports/${x.data.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Export failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Queuing…' : 'Prepare private download'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
