'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { displayQuantity } from '@shree/domain';
import PickupCountChecklist from './PickupCountChecklist';

export default function VerifyPickup({
  orderId,
  version,
  items,
}: {
  orderId: string;
  version: number;
  items: { id: string; label: string; quantity: number; unit: 'PIECE' | 'KG' }[];
}) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const confirmed = new Set(new FormData(event.currentTarget).getAll('confirmed'));
    if (items.some((item) => !confirmed.has(item.id))) return;
    setBusy(true);
    setError('');
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/v1/work/' + orderId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey.current },
        body: JSON.stringify({
          version,
          command: {
            action: 'VERIFY_RECEIPT',
            counts: items.map(({ id, quantity }) => ({ lineId: id, quantity })),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not verify pickup.');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not verify pickup.');
      setBusy(false);
    }
  }

  return (
    <form className="command-form" onSubmit={verify}>
      <h3>Verify pickup counts</h3>
      <p>
        Compare each count with the garments received. If any count differs, report the mismatch
        below.
      </p>
      <PickupCountChecklist
        items={items.map(({ id, label, quantity, unit }) => ({
          id,
          label,
          count: displayQuantity(quantity, unit),
        }))}
      />
      <button className="button" disabled={busy}>
        {busy ? 'Verifying…' : 'Verify and process'}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
