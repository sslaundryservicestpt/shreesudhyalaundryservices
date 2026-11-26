'use client';

import Link from 'next/link';
import PickupCountChecklist from './PickupCountChecklist';
import { useState, type FormEvent } from 'react';
import {
  particulars,
  savePracticePickups,
  usePracticePickupStore,
  type PracticePickup,
} from './PracticeHandoff';

const queues = {
  processing: {
    stage: 'VERIFIED',
    label: 'Processing batches',
    empty: 'No verified pickups awaiting processing.',
    button: 'Complete processing',
  },
  quality: {
    stage: 'QUALITY',
    label: 'Quality checks',
    empty: 'No orders awaiting quality checks.',
    button: 'Save quality check',
  },
  dispatch: {
    stage: 'READY_FOR_DISPATCH',
    label: 'Ready for dispatch',
    empty: 'No quality-verified orders ready for dispatch.',
    button: 'Ready for dispatch',
  },
  deliveries: {
    stage: 'DELIVERY',
    label: 'Queued deliveries',
    empty: 'No deliveries in the queue.',
    button: 'Confirm delivery',
  },
  'delivery-history': {
    stage: 'DELIVERED',
    label: 'Completed deliveries',
    empty: 'No completed deliveries yet.',
    button: '',
  },
} as const;
type View = keyof typeof queues;
const steps = ['Wash', 'Dry', 'Iron', 'Fold'] as const;

export function PracticeFulfillmentMetric({ view, href }: { view: View; href: string }) {
  const { records } = usePracticePickupStore();
  const queue = queues[view];
  return (
    <Link className="metric-card crm-kpi" href={href}>
      <strong>{records.filter((row) => row.stage === queue.stage).length}</strong>
      <p>{queue.label}</p>
      <small>Open queue →</small>
    </Link>
  );
}

export default function PracticeFulfillment({ view }: { view: View }) {
  const { snapshot, records } = usePracticePickupStore();
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();
  const queue = queues[view];

  function submit(event: FormEvent<HTMLFormElement>, pickup: PracticePickup) {
    event.preventDefault();
    if (pickup.stage !== queue.stage) return;
    const data = new FormData(event.currentTarget);
    let next: PracticePickup;
    let text: string;
    let error = false;
    switch (view) {
      case 'processing':
        if (!steps.every((step) => data.getAll('completed').includes(step))) {
          setFeedback({ text: 'Confirm each processing step first.', error: true });
          return;
        }
        next = { ...pickup, stage: 'QUALITY' };
        text = 'Processing complete. The order is now in Quality checks.';
        break;
      case 'quality': {
        if (!pickup.inward) return;
        const exception = data.has('quality-exception');
        const confirmed = new Set(data.getAll('confirmed'));
        if (
          !exception &&
          (!data.has('fabric-passed') ||
            pickup.inward.some((count, index) => count > 0 && !confirmed.has(String(index))))
        ) {
          setFeedback({
            text: 'Confirm every inward count and the fabric condition.',
            error: true,
          });
          return;
        }
        const counts = pickup.inward.map((expected, index) => {
          const observed = data.get('count-' + index);
          return exception && typeof observed === 'string' && observed !== ''
            ? Number(observed)
            : expected;
        });
        if (counts.some((count) => !Number.isInteger(count) || count < 0 || count > 10000)) {
          setFeedback({ text: 'Enter whole counts from 0 to 10,000.', error: true });
          return;
        }
        const quality = {
          counts,
          fabricPassed: exception ? !data.has('fabric-issue') : true,
          note: String(data.get('note') ?? '').trim(),
        };
        const matches = counts.every((count, index) => count === pickup.inward?.[index]);
        if (exception && matches && quality.fabricPassed) {
          setFeedback({
            text: 'Record a different count or mark a fabric issue to place the order on hold.',
            error: true,
          });
          return;
        }
        error = !matches || !quality.fabricPassed;
        next = {
          ...pickup,
          stage: error ? 'QUALITY' : 'READY_FOR_DISPATCH',
          quality,
          qualityHistory: [...(pickup.qualityHistory ?? []), quality],
        };
        text = error
          ? 'Quality hold recorded. Resolve the count or fabric issue and check again before dispatch.'
          : 'Quality verified. The order is now in Prepare dispatch.';
        break;
      }
      case 'dispatch':
        next = { ...pickup, stage: 'DELIVERY' };
        text = 'Ready for dispatch. The order is now in the Executive’s delivery queue.';
        break;
      case 'deliveries': {
        const recipient = String(data.get('recipient') ?? '').trim();
        if (!recipient || !data.has('acknowledged')) {
          setFeedback({ text: 'Enter the recipient and confirm the handover.', error: true });
          return;
        }
        next = { ...pickup, stage: 'DELIVERED', recipient };
        text = 'Delivery confirmed. Find it in Completed deliveries.';
        break;
      }
      default:
        return;
    }
    try {
      savePracticePickups(
        snapshot,
        records.map((row) => (row.id === pickup.id ? next : row)),
      );
      setFeedback({ text, error });
    } catch (cause) {
      setFeedback({
        text: cause instanceof Error ? cause.message : 'Could not update the order.',
        error: true,
      });
    }
  }

  const items = records.filter((row) => row.stage === queue.stage);
  return (
    <section className="surface panel-pad executive-delivery-list" aria-label={queue.label}>
      {feedback && (
        <p
          className={feedback.error ? 'form-error' : 'notice success'}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
      {items.length === 0 && <p>{queue.empty}</p>}
      {items.map((pickup) => (
        <details key={pickup.id}>
          <summary>
            <span>
              <strong>{pickup.site}</strong>
              <small>
                {pickup.inward?.reduce((sum, count) => sum + count, 0) ?? 0} inward pieces
              </small>
            </span>
            {view === 'quality' && pickup.quality && <span className="pill">Quality hold</span>}
          </summary>
          <div>
            {pickup.qualityHistory?.some((check) => check.note) && (
              <ul aria-label="Quality notes">
                {pickup.qualityHistory
                  .filter((check) => check.note)
                  .map((check, index) => (
                    <li key={index}>{check.note}</li>
                  ))}
              </ul>
            )}
            {view === 'delivery-history' ? (
              <p>
                Received by <strong>{pickup.recipient}</strong>
              </p>
            ) : (
              <form
                className="command-form"
                key={pickup.qualityHistory?.length ?? 0}
                onSubmit={(event) => submit(event, pickup)}
              >
                {view === 'processing' && (
                  <fieldset>
                    <legend>Confirm every completed step</legend>
                    {steps.map((step) => (
                      <label className="check-label" key={step}>
                        <input name="completed" type="checkbox" value={step} required /> {step}{' '}
                        completed
                      </label>
                    ))}
                  </fieldset>
                )}
                {view === 'quality' && (
                  <>
                    <PickupCountChecklist
                      legend="Match each item to its inward count"
                      items={(pickup.inward ?? []).flatMap((count, index) =>
                        count > 0
                          ? [
                              {
                                id: String(index),
                                label: particulars[index],
                                count: count + ' pcs',
                              },
                            ]
                          : [],
                      )}
                    />
                    <label className="check-label">
                      <input name="fabric-passed" type="checkbox" required />
                      Fabric quality passed
                    </label>
                    <label>
                      Loss or damage notes (optional)
                      <textarea name="note" maxLength={500} rows={3} />
                    </label>
                  </>
                )}
                {view === 'dispatch' && (
                  <p>
                    Counts match and fabric quality passed. Release the order to the Executive for
                    delivery.
                  </p>
                )}
                {view === 'deliveries' && (
                  <>
                    <label>
                      Received by
                      <input name="recipient" maxLength={120} required />
                    </label>
                    <label className="check-label">
                      <input name="acknowledged" type="checkbox" required /> Recipient acknowledged
                      all items
                    </label>
                  </>
                )}
                <button className="button">{queue.button}</button>
              </form>
            )}
            {view === 'quality' && (
              <details className="quality-exception">
                <summary>Report a count or fabric issue</summary>
                <form
                  className="command-form"
                  key={pickup.qualityHistory?.length ?? 0}
                  onSubmit={(event) => submit(event, pickup)}
                >
                  <input type="hidden" name="quality-exception" value="yes" />
                  <p>Enter only counts that differ from the inward count.</p>
                  <div className="form-grid">
                    {particulars.map(
                      (item, index) =>
                        (pickup.inward?.[index] ?? 0) > 0 && (
                          <label key={item}>
                            {item} recounted
                            <small>Inward count {pickup.inward?.[index]}</small>
                            <input
                              name={'count-' + index}
                              type="number"
                              min={0}
                              max={10000}
                              step={1}
                              inputMode="numeric"
                            />
                          </label>
                        ),
                    )}
                  </div>
                  <label className="check-label">
                    <input name="fabric-issue" type="checkbox" /> Fabric needs attention
                  </label>
                  <label>
                    Loss or damage notes
                    <textarea name="note" maxLength={500} rows={3} />
                  </label>
                  <button className="button secondary">Record quality hold</button>
                </form>
              </details>
            )}
          </div>
        </details>
      ))}
    </section>
  );
}
