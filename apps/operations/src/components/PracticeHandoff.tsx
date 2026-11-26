'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import PickupCountChecklist from './PickupCountChecklist';
import NotificationPanel from './NotificationPanel';
import { sbhsRates } from '@/lib/sbhs-rates';
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';

const storageKey = 'shree-training-handoff-v4';
const changed = 'shree-training-handoff';
export const particulars = sbhsRates.map(([item]) => item);

export type PracticePickup = {
  id: string;
  collectedAt?: number;
  stage:
    | 'ASSIGNED'
    | 'COLLECTED'
    | 'VERIFIED'
    | 'DISCREPANCY'
    | 'REVIEWED'
    | 'QUALITY'
    | 'READY_FOR_DISPATCH'
    | 'DELIVERY'
    | 'DELIVERED';
  site: string;
  counts?: number[];
  inward?: number[];
  instructions?: string;
  decision?: string;
  quality?: { counts: number[]; fabricPassed: boolean; note: string };
  qualityHistory?: NonNullable<PracticePickup['quality']>[];
  recipient?: string;
};

function subscribe(onChange: () => void) {
  window.addEventListener(changed, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(changed, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readSnapshot() {
  try {
    return localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

function pickupRecords(snapshot: string): PracticePickup[] {
  try {
    const parsed: unknown = snapshot ? JSON.parse(snapshot) : [];
    if (Array.isArray(parsed))
      return (parsed as PracticePickup[]).map((pickup) =>
        pickup.stage === 'REVIEWED' &&
        pickup.counts?.every((count, index) => count === pickup.inward?.[index])
          ? { ...pickup, stage: 'VERIFIED' }
          : pickup,
      );
  } catch {
    /* Ignore invalid local entries. */
  }
  return [];
}

export function usePracticePickups() {
  return usePracticePickupStore().records;
}

export function needsPracticeReview({ stage, decision }: PracticePickup) {
  return !decision && (stage === 'VERIFIED' || stage === 'DISCREPANCY');
}

export function PracticeRoleNotifications({ role }: { role: 'supervisor' | 'executive' }) {
  const pickups = usePracticePickups();
  const items =
    role === 'supervisor'
      ? [
          { label: 'Pickups to verify', view: 'verification', stage: 'COLLECTED' },
          { label: 'Batches in processing', view: 'processing', stage: 'VERIFIED' },
          { label: 'Quality checks due', view: 'quality', stage: 'QUALITY' },
          { label: 'Orders ready for dispatch', view: 'dispatch', stage: 'READY_FOR_DISPATCH' },
        ]
      : [
          { label: 'Assigned pickups', view: 'pickups', stage: 'ASSIGNED' },
          { label: 'Queued deliveries', view: 'deliveries', stage: 'DELIVERY' },
        ];
  return (
    <NotificationPanel
      items={items
        .map((item) => ({
          label: item.label,
          href: '/demo?role=' + role + '&view=' + item.view,
          count: pickups.filter(({ stage }) => stage === item.stage).length,
        }))
        .filter(({ count }) => count > 0)}
    />
  );
}

export function usePracticePickupStore() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => '');
  return { snapshot, records: pickupRecords(snapshot) };
}

export function savePracticePickups(snapshot: string, records: PracticePickup[]) {
  if (snapshot !== readSnapshot())
    throw Error('The queue changed. Review the latest details and try again.');
  localStorage.setItem(storageKey, JSON.stringify(records));
  window.dispatchEvent(new Event(changed));
}

export function PendingPickupMetric({
  href,
  queue = 'assignment',
}: {
  href: string;
  queue?: 'assignment' | 'verification';
}) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => '');
  const count = pickupRecords(snapshot).filter((pickup) =>
    queue === 'verification' ? pickup.stage === 'COLLECTED' : pickup.stage === 'ASSIGNED',
  ).length;
  const label = queue === 'verification' ? 'Pickups to verify' : 'Pending pickups';
  return (
    <Link className="metric-card crm-kpi" href={href}>
      <strong>{count}</strong>
      <p>{label}</p>
      <small>Open details</small>
    </Link>
  );
}

export default function PracticeHandoff({
  role,
  focus = false,
  history = false,
  assignment = false,
  sites,
}: {
  role: 'admin' | 'supervisor' | 'executive';
  focus?: boolean;
  history?: boolean;
  assignment?: boolean;
  sites?: ReactNode;
}) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => '');
  const records = pickupRecords(snapshot);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState('');
  const pending = records.filter((pickup) => pickup.stage === 'ASSIGNED');
  const waiting = records
    .filter((pickup) => pickup.stage === 'COLLECTED')
    .sort((a, b) => (a.collectedAt ?? 0) - (b.collectedAt ?? 0));
  const review = records.filter(needsPracticeReview);
  const completed = records
    .filter((pickup) => pickup.stage !== 'ASSIGNED')
    .sort((a, b) => (b.collectedAt ?? 0) - (a.collectedAt ?? 0));
  const priority =
    role === 'executive'
      ? history
        ? completed
        : pending
      : role === 'supervisor'
        ? waiting
        : review;
  const visible =
    role === 'executive'
      ? priority
      : [...priority, ...records.filter((pickup) => !priority.includes(pickup))];
  const record = visible.find((pickup) => pickup.id === selectedId) ?? visible[0];
  const assigned = record?.stage === 'ASSIGNED';

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (snapshot !== readSnapshot()) {
      setMessage('The pickup changed. Review the updated record before trying again.');
      return;
    }
    const data = new FormData(event.currentTarget);
    let next: PracticePickup;
    if (role === 'supervisor' && data.get('intent') === 'assign') {
      const site = String(data.get('site') ?? '').trim();
      if (!site) {
        setMessage('Enter the client site.');
        return;
      }
      next = {
        id: crypto.randomUUID(),
        stage: 'ASSIGNED',
        site,
        instructions: String(data.get('instructions') ?? '').trim(),
      };
    } else if (!record) {
      return;
    } else if (
      role === 'supervisor' &&
      record.stage === 'COLLECTED' &&
      data.get('intent') === 'verify'
    ) {
      const confirmed = new Set(data.getAll('confirmed'));
      if (particulars.some((name) => !confirmed.has(name)) || !record.counts) {
        setMessage('Confirm all counts before processing.');
        return;
      }
      next = { ...record, inward: [...record.counts], stage: 'VERIFIED' };
    } else if (
      (role === 'executive' && assigned) ||
      (role === 'supervisor' && record.stage === 'COLLECTED')
    ) {
      const counts = particulars.map((_, i) => Number(data.get('item-' + i)));
      if (counts.some((count) => !Number.isInteger(count) || count < 0 || count > 10000)) {
        setMessage('Enter whole counts from 0 to 10,000.');
        return;
      }
      if (role === 'executive') {
        if (counts.every((count) => count === 0)) {
          setMessage('Enter at least one collected piece.');
          return;
        }
        next = { ...record, counts, collectedAt: Date.now(), stage: 'COLLECTED' };
      } else {
        const matches = counts.every((count, i) => count === record.counts?.[i]);
        next = { ...record, inward: counts, stage: matches ? 'VERIFIED' : 'DISCREPANCY' };
      }
    } else if (
      record &&
      role === 'admin' &&
      (record.stage === 'VERIFIED' || record.stage === 'DISCREPANCY')
    ) {
      const decision = String(data.get('decision') ?? '').trim();
      if (!decision) {
        setMessage('Enter a review note.');
        return;
      }
      next = { ...record, decision, stage: record.stage === 'VERIFIED' ? 'VERIFIED' : 'REVIEWED' };
    } else return;

    try {
      const updated =
        data.get('intent') === 'assign'
          ? [...records, next]
          : records.map((pickup) => (pickup.id === record?.id ? next : pickup));
      savePracticePickups(snapshot, updated);
      if (data.get('intent') === 'assign') {
        event.currentTarget.reset();
      } else {
        setSelectedId(role === 'executive' ? undefined : next.id);
      }
      setMessage(
        role === 'executive'
          ? pending.length > 1
            ? 'Pickup saved to history. Next pickup is ready.'
            : 'Pickup saved to history. You’re all caught up.'
          : 'Pickup updated in this browser.',
      );
    } catch {
      setMessage('Browser storage is unavailable. Your changes could not be saved.');
    }
  }

  const stages = {
    ASSIGNED: 'Pending pickup',
    COLLECTED: 'Awaiting inward count',
    VERIFIED: 'Counts verified · Ready for processing',
    DISCREPANCY: 'Count mismatch · Awaiting Admin review',
    REVIEWED: 'Admin reviewed',
    QUALITY: 'Awaiting quality check',
    READY_FOR_DISPATCH: 'Quality verified · Ready for dispatch',
    DELIVERY: 'Queued for delivery',
    DELIVERED: 'Delivered',
  };

  const checkingPickup = role === 'supervisor' && record?.stage === 'COLLECTED';

  const openId = role === 'supervisor' ? selectedId : record?.id;
  const pickupDetails = record && (
    <>
      {record && (
        <div className="practice-counts">
          <div className="practice-pickup-heading">
            <strong>{record.site}</strong>
            {record.counts && (
              <span>
                {record.counts.reduce((total, count) => total + count, 0)} pieces collected
              </span>
            )}
          </div>
          {assigned && record.instructions && <span>{record.instructions}</span>}
          {record.counts &&
            !checkingPickup &&
            particulars.map((name, i) => {
              const collected = record.counts?.[i] ?? 0;
              const received = record.inward?.[i];
              return (
                (collected > 0 || (received ?? 0) > 0) && (
                  <span key={name}>
                    {name} · {collected} collected
                    {received === undefined ? '' : ' / ' + received + ' received'}
                    {received !== undefined && received !== collected ? ' · Count mismatch' : ''}
                  </span>
                )
              );
            })}
          {record.decision && <p>Admin note · {record.decision}</p>}
        </div>
      )}
      <form key={record.id + record.stage} onSubmit={save}>
        {role === 'executive' &&
          assigned &&
          (focus ? (
            <>
              <p>
                Enter the number of pieces collected for each item. Leave uncollected items at zero.
              </p>
              <div className="form-grid">
                {particulars.map((name, i) => (
                  <label key={name}>
                    {name}
                    <input
                      name={'item-' + i}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10000}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                ))}
              </div>
              <button className="button">Send to supervisor</button>
            </>
          ) : (
            <a className="button" href="/demo?role=executive&view=pickups">
              Open pending pickup
            </a>
          ))}
        {role === 'admin' &&
          !record.decision &&
          (record.stage === 'VERIFIED' || record.stage === 'DISCREPANCY') && (
            <>
              <label>
                Review note
                <textarea name="decision" required maxLength={300} rows={3} />
              </label>
              <button className="button">Record review</button>
            </>
          )}
      </form>
      {checkingPickup && (
        <>
          <form key={record.id} onSubmit={save}>
            <input type="hidden" name="intent" value="verify" />
            <PickupCountChecklist
              items={particulars.map((name, index) => ({
                id: name,
                label: name,
                count: (record.counts?.[index] ?? 0) + ' pcs',
              }))}
            />
            <button className="button">Verify and process</button>
          </form>
          <details>
            <summary>Report a count mismatch</summary>
            <form key={record.id} onSubmit={save}>
              <div className="form-grid">
                {particulars.map((name, i) => (
                  <label key={name}>
                    Received {name}
                    <small>{record.counts?.[i] ?? 0} collected</small>
                    <input
                      name={'item-' + i}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10000}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                ))}
              </div>
              <button className="button">Submit inward count</button>
            </form>
          </details>
        </>
      )}
    </>
  );

  if (role === 'supervisor' && assignment) {
    return (
      <section
        className="surface panel-pad practice-handoff practice-assignment"
        aria-label="Assign a pickup"
      >
        <form onSubmit={save}>
          <label>
            Client site
            {sites}
          </label>
          <label>
            Pickup instructions
            <textarea name="instructions" maxLength={300} rows={2} />
          </label>
          <input type="hidden" name="intent" value="assign" />
          <button className="button">Assign pickup to Executive</button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="surface panel-pad practice-handoff" aria-labelledby="handoff-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Collection and inward verification</p>
          <h2 id="handoff-heading">
            {role === 'executive'
              ? history
                ? 'Pickup history'
                : 'Pickup queue'
              : role === 'supervisor'
                ? 'Verify inward count'
                : 'Review pickup handoff'}
          </h2>
        </div>
        {role !== 'supervisor' && record && <span className="pill">{stages[record.stage]}</span>}
      </div>
      <section className="pickup-queue-panel" aria-label="Branch pickup queue">
        <header>
          <h3>
            {role === 'executive'
              ? history
                ? 'Collected pickups'
                : 'Assigned branches'
              : role === 'supervisor'
                ? 'Verification queue'
                : 'Review queue'}
          </h3>
          <span className="pill">
            {priority.length} {history ? 'collected' : 'awaiting action'}
          </span>
        </header>
        {role === 'executive' && !history && visible.length > 0 && (
          <label>
            Assigned client site
            <select
              value={openId ?? ''}
              onChange={(event) => {
                setSelectedId(event.target.value || undefined);
                setMessage('');
              }}
            >
              <option value="">Choose an assigned pickup</option>
              {visible.map((pickup) => (
                <option value={pickup.id} key={pickup.id}>
                  {pickup.site}
                </option>
              ))}
            </select>
          </label>
        )}
        {priority.length === 0 && (
          <p>
            {history
              ? 'No pickups have been collected yet.'
              : role === 'executive'
                ? 'You’re all caught up. New assignments will appear here.'
                : 'No pickups awaiting this step.'}
          </p>
        )}
        <ul>
          {visible.map((pickup) => (
            <li key={pickup.id}>
              <button
                type="button"
                aria-expanded={openId === pickup.id}
                aria-controls={'pickup-panel-' + pickup.id}
                onClick={() => {
                  setSelectedId(openId === pickup.id ? undefined : pickup.id);
                  setMessage('');
                }}
              >
                <span>{pickup.site}</span>
                <small>{stages[pickup.stage]}</small>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <div
                id={'pickup-panel-' + pickup.id}
                hidden={openId !== pickup.id}
                className="practice-branch-detail"
              >
                {openId === pickup.id && pickupDetails}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {!record && role !== 'executive' && (
        <p>New handoffs appear after the executive records pickup quantities.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
