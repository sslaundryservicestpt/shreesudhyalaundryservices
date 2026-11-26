'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function ArchiveButton({
  kind,
  id,
  version,
  archived,
}: {
  kind: string;
  id: string;
  version: number;
  archived: boolean;
}) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef<string | null>(null);
  const router = useRouter();
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/v1/masters/${kind}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current },
        body: JSON.stringify({ version, archived: !archived }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? 'Could not update this record.');
        return;
      }
      setConfirm(false);
      router.refresh();
    } catch {
      setError('Connection interrupted. Retry to check the same request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="archive-control">
      {!confirm ? (
        <button className="button secondary" onClick={() => setConfirm(true)}>
          {archived ? 'Restore record' : 'Archive record'}
        </button>
      ) : (
        <div className="notice">
          <strong>{archived ? 'Restore this record?' : 'Archive this record?'}</strong>
          <p>
            {archived
              ? 'It will be available for new work again.'
              : 'Historical references are kept. It cannot be selected for new work.'}
          </p>
          <div className="inline-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Keep unchanged
            </button>
            <button className="button" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
      <p role="alert" className="form-error">
        {error}
      </p>
    </div>
  );
}
