'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { quantity } from '@shree/domain';
import PickupCountChecklist, { type CountChecklistItem } from './PickupCountChecklist';
export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local' | 'checkbox' | 'select' | 'hidden';
  options?: { value: string; label: string }[];
  lookup?: string;
  required?: boolean;
  initial?: string | number | boolean;
  unit?: 'PIECE' | 'KG';
  hint?: string;
  timeZoneOffset?: string;
};
export function Lookup({
  field,
  selectedLabel,
  onSelect,
}: {
  field: Field;
  selectedLabel?: string;
  onSelect?: (value: string) => void;
}) {
  const [q, setQ] = useState(''),
    [items, setItems] = useState<{ id: string; name: string }[]>([]),
    [value, setValue] = useState(String(field.initial || '')),
    [error, setError] = useState(''),
    [lookupRevision, refreshLookup] = useState(0);
  const clientDirectory = /^\/api\/v1\/masters\/(?:clients|branches)(?:\?|$)/.test(
    field.lookup ?? '',
  );
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `${field.lookup}${field.lookup?.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}&limit=20`,
        { signal: abort.signal },
      )
        .then(async (r) => {
          const x = await r.json();
          if (!r.ok) throw Error(x.error?.message || 'Unable to load records.');
          setItems(x.data);
          setError('');
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [field.lookup, q, lookupRevision]);
  return (
    <div
      className="lookup-field"
      onFocus={(event) => {
        if (clientDirectory && !event.currentTarget.contains(event.relatedTarget))
          refreshLookup((revision) => revision + 1);
      }}
    >
      <label>
        {field.label} search
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" />
      </label>
      <label>
        {field.label}
        <select
          name={field.name}
          required={field.required !== false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onSelect?.(e.target.value);
          }}
        >
          <option value="">Choose a record</option>
          {value && !items.some((i) => i.id === value) && (
            <option value={value}>
              {selectedLabel ?? 'Selected record (' + value.slice(0, 8) + ')'}
            </option>
          )}
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <small>Search to find records beyond the first 20.</small>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
export default function CommandForm({
  title,
  description,
  endpoint,
  action,
  fields = [],
  version,
  recordId,
  mode = 'simple',
  redirect,
  confirmation = false,
  lines = false,
  countChecklist,
}: {
  title: string;
  description?: string;
  endpoint: string;
  action?: string;
  fields?: Field[];
  version?: number;
  recordId?: string;
  mode?: 'simple' | 'work' | 'policy' | 'pickup';
  redirect?: string;
  confirmation?: boolean;
  lines?: boolean;
  countChecklist?: CountChecklistItem[];
}) {
  const router = useRouter(),
    request = useRef<{ body: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [count, setCount] = useState(1);
  const allFields: Field[] = [
    ...fields,
    ...(lines
      ? Array.from({ length: count }, (_, i) => [
          {
            name: `garment:${i}`,
            label: `Line ${i + 1} garment`,
            lookup: '/api/v1/masters/garments',
          },
          {
            name: `service:${i}`,
            label: `Line ${i + 1} service`,
            lookup: '/api/v1/masters/services',
          },
        ]).flat()
      : []),
  ];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    try {
      for (const f of allFields) {
        const v = String(form.get(f.name) || '');
        data[f.name] =
          f.type === 'checkbox'
            ? form.has(f.name)
            : f.unit
              ? quantity(v, f.unit)
              : f.type === 'number'
                ? Number(v)
                : f.type === 'datetime-local'
                  ? new Date(f.timeZoneOffset ? v + f.timeZoneOffset : v).toISOString()
                  : v;
      }
      let input: Record<string, unknown> = { ...data, ...(action ? { action } : {}) };
      if (recordId) input = { ...input, id: recordId, version };
      if (mode === 'policy') input = { action: 'POLICY', version, value: data };
      if (mode === 'pickup' && lines) {
        input = {
          ...data,
          lines: Array.from({ length: count }, (_, i) => ({
            garmentId: data[`garment:${i}`],
            serviceId: data[`service:${i}`],
          })),
        };
        for (const k of Object.keys(input)) if (k.includes(':')) delete input[k];
      }
      if (action === 'RATE') {
        input.branchId ||= null;
        input.clientId ||= null;
      }
      if (mode === 'work') {
        const counts = allFields
          .filter((f) => f.name.startsWith('qty:'))
          .map((f) => ({ lineId: f.name.slice(4), quantity: data[f.name] }));
        for (const k of Object.keys(input)) if (k.startsWith('qty:')) delete input[k];
        if (['COLLECT', 'VERIFY_RECEIPT', 'VERIFY_AND_QUEUE'].includes(action || ''))
          input.counts = counts;
        if (action === 'ASSIGN_DELIVERY' || action === 'ACKNOWLEDGE')
          input.quantities =
            action === 'ASSIGN_DELIVERY' ? counts.filter((v) => Number(v.quantity) > 0) : counts;
        if (input.evidenceId === '') delete input.evidenceId;
        input = { version, command: input };
      }
      const body = JSON.stringify(input);
      if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
      setBusy(true);
      setError('');
      setSuccess('');
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.current.key },
        body,
      });
      const result = await r.json();
      if (!r.ok)
        throw Error(
          `${result.error?.message || 'Could not save.'} Reference: ${result.requestId || 'unavailable'}`,
        );
      request.current = null;
      setSuccess('Saved and confirmed by the server.');
      if (mode === 'pickup') router.push(`/workspace/work/${result.data.id}`);
      else if ((action === 'DRAFT' || action === 'CLOSE_CYCLE') && endpoint === '/api/v1/finance')
        router.push(`/workspace/finance/${result.data.id}`);
      else if (redirect) router.push(redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save. Your entries are preserved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="command-form" onSubmit={submit}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {countChecklist && (
        <PickupCountChecklist
          items={countChecklist}
          legend="Match each item to its verified count"
        />
      )}
      <div className="form-grid">
        {allFields.map((f) =>
          f.type === 'hidden' ? (
            <input key={f.name} name={f.name} type="hidden" value={String(f.initial ?? '')} />
          ) : f.lookup ? (
            <Lookup key={f.name} field={f} />
          ) : (
            <label key={f.name} className={f.type === 'checkbox' ? 'check-label' : ''}>
              {f.type === 'checkbox' ? (
                <>
                  <input
                    name={f.name}
                    type="checkbox"
                    defaultChecked={Boolean(f.initial)}
                    required={f.required === true}
                  />
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
                  {f.type === 'select' ? (
                    <select
                      name={f.name}
                      defaultValue={String(f.initial ?? '')}
                      required={f.required !== false}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={f.name}
                      type={f.type || 'text'}
                      defaultValue={String(f.initial ?? '')}
                      required={f.required !== false}
                      step={f.type === 'number' ? 1 : undefined}
                      inputMode={
                        f.unit === 'PIECE' ? 'numeric' : f.unit === 'KG' ? 'decimal' : undefined
                      }
                      maxLength={f.type === 'text' || !f.type ? 600 : undefined}
                    />
                  )}
                </>
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ),
        )}
      </div>
      {lines && (
        <button
          className="button secondary"
          type="button"
          disabled={count >= 50}
          onClick={() => setCount(count + 1)}
        >
          Add garment line
        </button>
      )}
      {confirmation && (
        <label className="check-label">
          <input type="checkbox" required />I have reviewed the details and confirm this action.
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p
          className={`save-notice ${['COLLECT', 'ISSUE', 'PAYMENT'].includes(action || '') ? 'confirmed-milestone' : ''}`}
          role="status"
        >
          <span aria-hidden="true">✓ </span>
          {success}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? 'Saving…' : title}
      </button>
    </form>
  );
}
