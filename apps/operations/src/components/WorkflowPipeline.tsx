import type { WorkState } from '@shree/domain';
export default function WorkflowPipeline({ state: s }: { state: WorkState }) {
  const verified = s.lines.length > 0 && s.lines.every((l) => l.accepted !== null),
    processing = s.batches.length > 0,
    quality =
      verified &&
      s.batches.length > 0 &&
      s.lines.every(
        (l) =>
          l.balances.AVAILABLE === 0 &&
          l.balances.PROCESSING === 0 &&
          l.balances.QC === 0 &&
          l.balances.REWORK === 0,
      );
  const steps = [
    { name: 'Pickup', done: s.pickup === 'COLLECTED' },
    { name: 'Verification', done: verified },
    {
      name: 'Processing',
      done: processing && s.batches.every((b) => b.status === 'DONE') && quality,
    },
    { name: 'Quality check', done: quality },
    { name: 'Delivery', done: !!s.completedAt },
    { name: 'Billing eligibility', done: !!s.completedAt },
  ];
  const active = steps.findIndex((v) => !v.done);
  return (
    <section className="workflow-panel surface panel-pad" aria-label="Persisted order progress">
      <p className="eyebrow">THE CARE JOURNEY</p>
      <ol className="workflow-pipeline">
        {steps.map((step, i) => (
          <li
            key={step.name}
            data-done={step.done}
            aria-current={active === i ? 'step' : undefined}
          >
            <span>{step.done ? '✓' : String(i + 1).padStart(2, '0')}</span>
            <strong>{step.name}</strong>
            <small>
              {s.pickup === 'CANCELLED'
                ? 'Pickup cancelled'
                : step.done
                  ? i === 5
                    ? 'Ready for finance review'
                    : 'Confirmed'
                  : active === i
                    ? 'Needs attention'
                    : 'Upcoming'}
            </small>
          </li>
        ))}
      </ol>
      <p className="muted tiny">
        Confirmed order state only. Processing follows each garment’s service route; billing
        eligibility does not mean an invoice has been issued.
      </p>
    </section>
  );
}
