'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
export default function EvidenceUpload({ orderId }: { orderId: string }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null),
    router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const file = new FormData(form).get('file');
    if (!(file instanceof File)) return;
    key.current ??= crypto.randomUUID();
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/work/${orderId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'Idempotency-Key': key.current },
        body: file,
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error?.message || 'Upload failed.');
      key.current = null;
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="command-form" onSubmit={submit}>
      <label>
        Attach private evidence
        <input
          disabled={busy}
          onChange={() => {
            key.current = null;
          }}
          required
          name="file"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
        />
      </label>
      <small>JPEG, PNG or PDF · 5 MB maximum · authorized download only</small>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button secondary" disabled={busy}>
        {busy ? 'Uploading…' : 'Attach evidence'}
      </button>
    </form>
  );
}
