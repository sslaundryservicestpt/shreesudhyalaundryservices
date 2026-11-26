'use client';
import { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lookup } from './CommandForm';
type Scope = { clientId?: string | null; branchId?: string | null; unitId?: string | null };
type ScopeRow = { key: string; scope: Scope };
type Person = {
  id: string;
  version: number;
  displayName: string;
  active: boolean;
  memberships: { role: string }[];
  scopes: Scope[];
};
export default function StaffEditor({ person, self = false }: { person?: Person; self?: boolean }) {
  const pending = Boolean(person && !person.active && !person.memberships.length);
  const router = useRouter(),
    prior = useRef<{ body: string; key: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [scopes, setScopes] = useState<ScopeRow[]>(
      (person?.scopes || []).map((s, i) => ({
        key: 'existing-' + i,
        scope: Object.fromEntries(
          Object.entries(s).filter(([k, v]) => ['clientId', 'branchId', 'unitId'].includes(k) && v),
        ),
      })),
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || self) return;
    const f = new FormData(e.currentTarget);
    const chosen = scopes.map(({ scope: s }, i) => ({
      [Object.keys(s).find((k) => s[k as keyof Scope] !== undefined) || 'branchId']: String(
        f.get('scope:' + i) || '',
      ),
    }));
    const input = {
      action: person ? 'UPDATE' : 'INVITE',
      ...(person
        ? { id: person.id, version: person.version, active: pending || f.has('active') }
        : { email: String(f.get('email')) }),
      displayName: String(f.get('displayName')),
      roles: f.getAll('roles'),
      scopes: chosen,
    };
    const body = JSON.stringify(input);
    if (prior.current?.body !== body) prior.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const r = await fetch('/api/v1/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': prior.current.key },
          body,
        }),
        x = await r.json();
      if (!r.ok)
        throw Error((x.error?.message || 'Access change failed.') + ' Reference: ' + x.requestId);
      prior.current = null;
      setSaved(
        person
          ? 'Access saved. New requests use the updated permissions.'
          : 'Invitation request queued. This does not confirm email delivery; review its job status.',
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed. Entries are preserved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="command-form" onSubmit={submit}>
      <h3>
        {pending
          ? 'Approve access and assign a role'
          : person
            ? 'Review staff access'
            : 'Queue staff invitation'}
      </h3>
      {pending && (
        <p className="notice">
          This account is awaiting review. Choose the role and any scopes before approving access.
        </p>
      )}
      {self && (
        <p className="notice">
          Your own access is read-only here. Another active administrator must change it.
        </p>
      )}
      <fieldset disabled={self || busy}>
        <div className="form-grid">
          <label>
            Display name
            <input name="displayName" required maxLength={160} defaultValue={person?.displayName} />
          </label>
          {!person && (
            <label>
              Invited work email
              <input name="email" type="email" required maxLength={254} />
            </label>
          )}
        </div>
        {person && !pending && (
          <label className="check-label">
            <input type="checkbox" name="active" defaultChecked={person.active} />
            Active application access
          </label>
        )}
        <fieldset>
          <legend>Roles</legend>
          {['ADMIN', 'SUPERVISOR', 'DELIVERY_EXECUTIVE'].map((role) => (
            <label className="check-label" key={role}>
              <input
                type="checkbox"
                name="roles"
                value={role}
                defaultChecked={person?.memberships.some((m) => m.role === role)}
              />{' '}
              {role.replaceAll('_', ' ')}
            </label>
          ))}
        </fieldset>
        <p className="muted tiny">
          Administrators have global access. Supervisor scopes combine as a union. Executives see
          assigned tasks. Branch-user and operator logins remain disabled.
        </p>
        {scopes.map(({ key, scope }, i) => {
          const kind = (Object.keys(scope).find(
            (k) => scope[k as keyof Scope] !== null && scope[k as keyof Scope] !== undefined,
          ) || 'branchId') as keyof Scope;
          return (
            <div className="staff-scope" key={key}>
              <label>
                Scope type
                <select
                  value={kind}
                  onChange={(e) =>
                    setScopes((old) =>
                      old.map((s, n) => (n === i ? { ...s, scope: { [e.target.value]: '' } } : s)),
                    )
                  }
                >
                  <option value="clientId">Client</option>
                  <option value="branchId">Branch</option>
                  <option value="unitId">Laundry unit</option>
                </select>
              </label>
              <Lookup
                key={kind + ':' + key}
                field={{
                  name: 'scope:' + i,
                  label: 'Scope target',
                  initial: scope[kind] || '',
                  lookup:
                    '/api/v1/masters/' +
                    { clientId: 'clients', branchId: 'branches', unitId: 'units' }[kind],
                }}
              />
              <button
                type="button"
                className="button secondary"
                onClick={() => setScopes((old) => old.filter((_, n) => n !== i))}
              >
                Remove scope
              </button>
            </div>
          );
        })}
        <button
          className="button secondary"
          type="button"
          disabled={scopes.length >= 100}
          onClick={() =>
            setScopes([...scopes, { key: crypto.randomUUID(), scope: { branchId: '' } }])
          }
        >
          Add scope
        </button>
        <label className="check-label">
          <input type="checkbox" required />I reviewed the identity, roles and scopes and confirm
          this sensitive access change.
        </label>
        <button className="button" disabled={busy || self}>
          {busy
            ? 'Saving…'
            : pending
              ? 'Approve and activate account'
              : person
                ? 'Save reviewed access'
                : 'Queue invitation request'}
        </button>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="save-notice" role="status">
          {saved}
        </p>
      )}
    </form>
  );
}
