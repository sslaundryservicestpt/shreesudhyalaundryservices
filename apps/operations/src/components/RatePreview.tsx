'use client';
import { useState, type FormEvent } from 'react';
import { Lookup } from './CommandForm';
export default function RatePreview() {
  const [result, setResult] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const f = new FormData(e.currentTarget),
        q = new URLSearchParams();
      for (const k of ['branchId', 'garmentId', 'serviceId', 'quantity'])
        q.set(k, String(f.get(k)));
      q.set('at', new Date(String(f.get('at'))).toISOString());
      const r = await fetch('/api/v1/pricing/preview?' + q),
        x = await r.json();
      if (!r.ok) throw Error(x.error?.message || 'Preview unavailable.');
      setResult(x.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="command-form" onSubmit={submit}>
      <h3>Explain an effective rate</h3>
      <p>
        Non-binding estimate at a chosen date. Actual invoices use the approved contractual date
        from their source orders.
      </p>
      <div className="form-grid">
        <Lookup field={{ name: 'branchId', label: 'Branch', lookup: '/api/v1/masters/branches' }} />
        <Lookup
          field={{ name: 'garmentId', label: 'Garment', lookup: '/api/v1/masters/garments' }}
        />
        <Lookup
          field={{ name: 'serviceId', label: 'Service', lookup: '/api/v1/masters/services' }}
        />
        <label>
          Quantity (pieces or kg as defined by garment)
          <input name="quantity" required defaultValue="10" />
        </label>
        <label>
          Effective at (local input)
          <input name="at" type="datetime-local" required />
        </label>
      </div>
      <button className="button secondary" disabled={busy}>
        {busy ? 'Resolving…' : 'Preview selected rate'}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {result && (
        <div className="notice" role="status">
          <strong>
            {result.source}: {result.rate} / {result.unit}
          </strong>
          <p>Preview subtotal: {result.subtotal}, before tax.</p>
          <p>
            Effective [{result.startsAt}, {result.endsAt})
          </p>
          <small>
            Contract {result.rateId} · Invoice date rule: {result.dateRule}
          </small>
        </div>
      )}
    </form>
  );
}
