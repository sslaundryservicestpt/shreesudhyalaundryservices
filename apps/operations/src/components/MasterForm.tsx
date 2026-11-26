'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, Save, Search } from 'lucide-react';
import type { MasterKind } from '@shree/domain';
type RecordData = {
  id?: string;
  name?: string;
  version?: number;
  clientId?: string;
  unitId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  unit?: string;
  route?: string;
  archived?: boolean;
};
function RelationshipPicker({
  kind,
  name,
  label,
  initial,
}: {
  kind: 'clients' | 'units';
  name: string;
  label: string;
  initial?: string;
}) {
  const [query, setQuery] = useState(''),
    [options, setOptions] = useState<{ id: string; name: string }[]>([]),
    [value, setValue] = useState(initial ?? ''),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/v1/masters/${kind}?q=${encodeURIComponent(query)}&limit=20`, {
        signal: abort.signal,
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw Error(result.error?.message ?? 'Could not load records.');
          setOptions(result.data);
          setError('');
        })
        .catch((error) => {
          if (!abort.signal.aborted)
            setError(error instanceof Error ? error.message : 'Connection failed.');
        });
    }, 200);
    return () => {
      clearTimeout(timeout);
      abort.abort();
    };
  }, [kind, query]);
  return (
    <div className="relationship">
      <label>
        {label} search
        <div className="input-icon">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search active ${kind}`}
            autoComplete="off"
          />
        </div>
      </label>
      <label>
        {label}
        {kind === 'clients' ? ' *' : ''}
        <select
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required={kind === 'clients'}
        >
          <option value="">
            {kind === 'clients' ? 'Choose an active client' : 'No unit assigned'}
          </option>
          {value && !options.some((item) => item.id === value) && (
            <option value={value}>Current relationship ({value.slice(0, 8)})</option>
          )}
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <small>Results are limited to 20. Search by name to find more.</small>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export default function MasterForm({
  kind,
  initial = {},
}: {
  kind: MasterKind;
  initial?: RecordData;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [fields, setFields] = useState<Record<string, string[]>>({});
  const request = useRef<{ body: string; key: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(
      [...form.entries()].filter(([, value]) => typeof value === 'string'),
    );
    const body = JSON.stringify({ ...input, ...(initial.id ? { version: initial.version } : {}) });
    if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setFields({});
    try {
      const response = await fetch(`/api/v1/masters/${kind}${initial.id ? '/' + initial.id : ''}`, {
        method: initial.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.current!.key },
        body,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          `${result.error?.message ?? 'Could not save.'} Reference: ${result.requestId ?? 'unavailable'}`,
        );
        setFields(result.error?.fields ?? {});
        return;
      }
      router.push(`/workspace/masters/${kind}/${result.data.id}?saved=1`);
      router.refresh();
    } catch {
      setError(
        'Connection interrupted. Your entries are preserved. Retrying the same data reuses the request key.',
      );
    } finally {
      setBusy(false);
    }
  }
  const contact = kind === 'clients' || kind === 'branches';
  return (
    <form className="surface record-form" onSubmit={submit}>
      <div className="form-heading">
        <Save size={20} />
        <span>
          {initial.id ? 'Update record' : 'Create record'}
          <small>Required fields are marked *</small>
        </span>
      </div>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label className="full">
            Name *
            <input
              name="name"
              defaultValue={initial.name}
              required
              maxLength={160}
              autoComplete="off"
              aria-invalid={Boolean(fields.name)}
            />
            {fields.name && <small className="form-error">{fields.name.join(' ')}</small>}
          </label>
          {kind === 'branches' && (
            <>
              <RelationshipPicker
                kind="clients"
                name="clientId"
                label="Client"
                initial={initial.clientId}
              />
              <RelationshipPicker
                kind="units"
                name="unitId"
                label="Laundry unit"
                initial={initial.unitId}
              />
            </>
          )}
          {contact && (
            <>
              <label>
                Contact name
                <input name="contactName" defaultValue={initial.contactName} maxLength={160} />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" defaultValue={initial.phone} maxLength={30} />
              </label>
              <label className="full">
                Email
                <input name="email" type="email" defaultValue={initial.email} maxLength={254} />
              </label>
            </>
          )}
          {(kind === 'branches' || kind === 'units') && (
            <label className="full">
              Address
              <textarea name="address" defaultValue={initial.address} rows={3} maxLength={600} />
            </label>
          )}
          {kind === 'garments' && (
            <label>
              Quantity unit
              <select name="unit" defaultValue={initial.unit ?? 'PIECE'}>
                <option value="PIECE">Pieces (whole items)</option>
                <option value="KG">Kilograms (weight)</option>
              </select>
            </label>
          )}
          {kind === 'services' && (
            <label className="full">
              Processing route
              <select name="route" defaultValue={initial.route ?? 'WASH_DRY_FOLD'}>
                <option value="WASH_DRY_FOLD">Wash → Dry → Fold</option>
                <option value="WASH_DRY_IRON">Wash → Dry → Iron</option>
                <option value="IRON_ONLY">Iron only</option>
              </select>
              <small>Routes define the service; processing execution is Phase 2.</small>
            </label>
          )}
        </div>
      </fieldset>
      <p className="form-error" role="alert">
        {error}
      </p>
      <div className="form-actions">
        <Link className="button secondary" href={`/workspace/masters/${kind}`}>
          Cancel
        </Link>
        <button type="submit" className="button" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{' '}
          {busy ? 'Saving…' : 'Save record'}
          <ArrowRight size={16} />
        </button>
      </div>
      <p className="muted tiny">
        Changes are saved on the server with version checks and an audit entry.
      </p>
    </form>
  );
}
