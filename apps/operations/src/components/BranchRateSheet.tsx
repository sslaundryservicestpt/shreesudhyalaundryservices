'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lookup } from './CommandForm';

type Option = { id: string; name: string };

export default function BranchRateSheet({
  branch,
  garments,
  services,
  currency,
}: {
  branch?: Option;
  garments: Option[];
  services: Option[];
  currency: string;
}) {
  const router = useRouter();
  const request = useRef<{ body: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const first = String(data.get('service0') || '');
    const second = String(data.get('service1') || '');
    const rates = garments.flatMap(({ id }) =>
      [first, second].flatMap((serviceId, index) => {
        const rate = String(data.get(id + ':' + index) || '').trim();
        return rate ? [{ garmentId: id, serviceId, rate }] : [];
      }),
    );
    if (!rates.length || rates.some((row) => !row.serviceId) || (second && first === second)) {
      setFeedback({
        text: 'Choose a different service for each filled column and enter at least one rate.',
        error: true,
      });
      return;
    }
    setBusy(true);
    setFeedback(undefined);
    try {
      const body = JSON.stringify({
        action: 'BRANCH_RATES',
        branchId: data.get('branchId'),
        startsAt: new Date(data.get('startsAt') + 'T00:00:00+05:30').toISOString(),
        endsAt: new Date(data.get('endsAt') + 'T00:00:00+05:30').toISOString(),
        replace: data.has('replace'),
        rates,
      });
      if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
      const response = await fetch('/api/v1/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.current.key },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message || 'Unable to save branch rates.');
      request.current = null;
      form.reset();
      setFeedback({ text: `${rates.length} branch rates saved.`, error: false });
      router.refresh();
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : 'Unable to save branch rates.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface panel-pad" id="branch-rate-sheet">
      <h2>{branch ? branch.name + ' rates' : 'Set rates for a branch'}</h2>
      {!garments.length || !services.length ? (
        <>
          <p>Add active per-piece garment types and services before entering rates.</p>
          <div className="form-actions">
            <Link className="text-link" href="/workspace/masters/garments">
              Open garment catalog
            </Link>
            <Link className="text-link" href="/workspace/masters/services">
              Open service catalog
            </Link>
          </div>
        </>
      ) : (
        <form className="command-form" onSubmit={save}>
          {branch ? (
            <input type="hidden" name="branchId" value={branch.id} />
          ) : (
            <Lookup
              field={{
                name: 'branchId',
                label: 'Client branch',
                lookup: '/api/v1/masters/branches',
              }}
            />
          )}
          <div className="branch-rate-period">
            <label>
              Effective start (IST)
              <input type="date" name="startsAt" required />
            </label>
            <label>
              End date, excluded (IST)
              <input type="date" name="endsAt" required />
            </label>
          </div>
          <p>
            Choose the services from your catalog. Leave a price cell blank to skip it. Rates are
            saved together for the selected branch.
          </p>
          <label className="check-label">
            <input type="checkbox" name="replace" /> Replace overlapping rates from the future start
            date
          </label>
          <small>
            The new end date must cover the remainder of the rate being replaced. Pricing dates
            before the change keep the earlier rate, and issued invoices keep their saved prices.
          </small>
          <div
            className="table-scroll branch-rate-table"
            tabIndex={0}
            role="region"
            aria-label="Branch rate sheet"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Particular</th>
                  {[0, 1].map((index) => (
                    <th scope="col" key={index}>
                      <label>
                        {index === 0 ? 'Service 1' : 'Service 2 (optional)'}
                        <select name={'service' + index} required={index === 0} defaultValue="">
                          <option value="">Choose service</option>
                          {services.map((service) => (
                            <option value={service.id} key={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {garments.map(({ id, name }) => (
                  <tr key={id}>
                    <th scope="row">{name}</th>
                    {[0, 1].map((index) => (
                      <td key={index}>
                        <input
                          name={id + ':' + index}
                          aria-label={`${name}, service ${index + 1}, ${currency} per piece`}
                          inputMode="decimal"
                          maxLength={20}
                          placeholder={currency}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
          <button className="button" disabled={busy}>
            {busy ? 'Saving rates…' : 'Save branch rates'}
          </button>
        </form>
      )}
    </section>
  );
}
