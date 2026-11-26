'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import ClientPriceTable, { type PriceRow } from './ClientPriceTable';
import { isSbhsClient, referenceItemKey, sbhsRates } from '@/lib/sbhs-rates';

type Option = { id: string; name: string };
type Price = { id: string; garmentId: string; serviceId: string; price: string };
const isStain = ({ name }: Option) => /stain/i.test(name);

export default function ClientSetup({
  client,
  catalog,
  prices,
}: {
  client: Option;
  catalog?: { garments: Option[]; services: Option[]; currency: string; scale: number };
  prices: Price[];
}) {
  const router = useRouter();
  const services = catalog?.services ?? [];
  const [standard, setStandard] = useState(
    () =>
      (
        services.find(({ name }) => /wash.*dry/i.test(name) && !/stain/i.test(name)) ??
        services.find(({ name }) => /standard|wash.*fold/i.test(name) && !/stain/i.test(name))
      )?.id ?? '',
  );
  const [stain, setStain] = useState(() => services.find(isStain)?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const request = useRef<{ body: string; key: string } | null>(null);
  const byPair = new Map(prices.map((price) => [price.garmentId + ':' + price.serviceId, price]));
  const garments = new Map(
    catalog?.garments.map((garment) => [referenceItemKey(garment.name), garment]),
  );
  const referencedIds = new Set<string>();
  const prefillReference = catalog?.currency === 'INR' && isSbhsClient(client.name);
  const duplicate = Boolean(standard && standard === stain);

  function row(
    item: string,
    garmentId: string,
    standardPrice?: number,
    stainPrice?: number,
  ): PriceRow {
    const cell = (service: string, reference: number | undefined, column: number) => {
      const saved = byPair.get(garmentId + ':' + service);
      return {
        name: garmentId + ':' + column,
        value:
          saved?.price ??
          (prefillReference && reference !== undefined ? String(reference) : undefined),
        reference,
        disabled: !service || duplicate || garmentId.startsWith('missing:'),
      };
    };
    return {
      id: garmentId,
      item,
      cells: [cell(standard, standardPrice, 0), cell(stain, stainPrice, 1)],
    };
  }

  const rows = sbhsRates.map(([item, regular, heavy]) => {
    const garment = garments.get(referenceItemKey(item));
    if (garment) referencedIds.add(garment.id);
    return row(item, garment?.id ?? 'missing:' + item, regular, heavy);
  });
  for (const garment of catalog?.garments ?? []) {
    if (!referencedIds.has(garment.id)) rows.push(row(garment.name, garment.id));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog || duplicate || busy) return;
    const values = new FormData(event.currentTarget);
    const rates = rows.flatMap(({ id, cells }) =>
      [standard, stain].flatMap((serviceId, column) => {
        const prior = byPair.get(id + ':' + serviceId);
        const rate = String(values.get(cells[column].name) ?? '').trim();
        return rate && (!prior || Number(rate) !== Number(prior.price))
          ? [{ garmentId: id, serviceId, rate, expectedRateId: prior?.id ?? null }]
          : [];
      }),
    );
    if (!rates.length) {
      setMessage({ text: 'Enter or change a price to save.', error: true });
      return;
    }
    const body = JSON.stringify({ action: 'CLIENT_RATES', clientId: client.id, rates });
    if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/v1/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.current.key },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || 'Unable to save prices.');
      request.current = null;
      setMessage({ text: 'Client prices saved.', error: false });
      router.refresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to save prices.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const servicePicker = (label: string, value: string, select: (value: string) => void) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        select(event.target.value);
        setMessage(undefined);
      }}
    >
      <option value="">Choose service</option>
      {services.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );

  return (
    <section className="surface panel-pad">
      <h2>Item prices</h2>
      {!catalog ? (
        <p>
          Approve the <Link href="/workspace/finance?section=policy">business policy</Link> to set
          client prices.
        </p>
      ) : (
        <form
          className="command-form"
          onSubmit={save}
          key={standard + ':' + stain + ':' + prices.map((price) => price.id).join(',')}
        >
          <p>
            Prices are per piece in {catalog.currency}, with up to three digits before the decimal.
            Review and save the amounts to use them in billing.
          </p>
          {(rows.some(({ id }) => id.startsWith('missing:')) || !stain || !standard) && (
            <p>
              To enable unavailable fields, add the corresponding{' '}
              <Link href="/workspace/masters/garments">garment type</Link> or{' '}
              <Link href="/workspace/masters/services">service</Link> and select the service above
              its price column.
            </p>
          )}
          {duplicate && <p role="alert">Choose a different service for each price column.</p>}
          <fieldset disabled={busy}>
            <ClientPriceTable
              rows={rows}
              scale={catalog.scale}
              canLoadReference={catalog.currency === 'INR'}
              columns={[
                servicePicker('Standard service', standard, setStandard),
                servicePicker('Heavy stain service', stain, setStain),
              ]}
            />
          </fieldset>
          {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
          <button
            className="button"
            disabled={
              busy || duplicate || rows.every(({ cells }) => cells.every((cell) => cell.disabled))
            }
          >
            {busy ? 'Saving prices…' : 'Save client prices'}
          </button>
        </form>
      )}
    </section>
  );
}
