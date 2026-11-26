import VerifyPickup from '@/components/VerifyPickup';
import WorkflowPipeline from '@/components/WorkflowPipeline';
import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { workDetail } from '@/server/work';
import { displayQuantity, buckets, type WorkState } from '@shree/domain';
import CommandForm, { type Field } from '@/components/CommandForm';
import type { CountChecklistItem } from '@/components/PickupCountChecklist';
import EvidenceUpload from '@/components/EvidenceUpload';
export default async function WorkDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(),
    id = (await params).id,
    { row, branch, unit, assignee, events, movements, files } = await workDetail(actor, id),
    s = row.state as unknown as WorkState;
  const admin = actor.roles.includes('ADMIN'),
    coord = admin || actor.roles.includes('SUPERVISOR'),
    pickup = coord || actor.id === row.executiveId;
  const dueLines = coord ? s.lines.filter((l) => (l.accepted ?? 0) > l.balances.DELIVERED) : [];
  const readyToQueue =
    coord &&
    s.received &&
    dueLines.length > 0 &&
    s.lines.every((l) => l.accepted !== null && !l.discrepancy) &&
    dueLines.every(
      (l) => l.balances.PASSED + l.balances.RELEASED === (l.accepted ?? 0) - l.balances.DELIVERED,
    ) &&
    !s.deliveries.some(
      (d) => d.status === 'ASSIGNED' || d.status === 'DISPATCHED' || d.returnPending,
    );
  const form = (
    action: string,
    title: string,
    fields: Field[] = [],
    description?: string,
    countChecklist?: CountChecklistItem[],
  ) => (
    <CommandForm
      key={action + title}
      endpoint={`/api/v1/work/${id}`}
      mode="work"
      action={action}
      version={row.version}
      title={title}
      fields={fields}
      description={description}
      countChecklist={countChecklist}
      confirmation
    />
  );
  const hidden = (name: string, value: string): Field => ({
    name,
    label:
      name === 'lineId'
        ? 'Garment line'
        : name === 'batchId'
          ? 'Processing batch'
          : 'Delivery attempt',
    type: 'select',
    initial: value,
    options: [
      {
        value,
        label:
          name === 'lineId'
            ? s.lines.find((l) => l.id === value)?.name || value
            : value.slice(0, 8),
      },
    ],
  });
  const qty = (name: string, label: string, unit: 'PIECE' | 'KG', initial = 0): Field => ({
    name,
    label: `${label} (${unit === 'PIECE' ? 'whole pieces' : 'kg, up to 3 decimals'})`,
    unit,
    initial: initial / 1000,
  });
  const note: Field = {
    name: 'reason',
    label: 'Review / exception / return notes',
    hint: 'Explain discrepancy approval, QC result or any undelivered quantity.',
  };
  if (!coord)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">MY ASSIGNMENT</p>
            <h1>SS-{String(row.number).padStart(6, '0')}</h1>
            <p>
              {branch?.name} · {row.queue.replaceAll('_', ' ')}
            </p>
          </div>
          <Link href="/workspace/work">Back to tasks</Link>
        </div>
        <section className="surface panel-pad">
          <h2>Collection & delivery address</h2>
          <p>{branch?.address}</p>
          {branch?.contactName && <p>Site contact: {branch.contactName}</p>}
          {branch?.phone && <a href={'tel:' + branch.phone}>{branch.phone}</a>}
          <p>
            Scheduled {row.scheduledAt.toISOString()} · {unit?.name}
          </p>
        </section>
        <section className="surface panel-pad">
          <h2>Your next action</h2>
          {pickup && s.pickup === 'ASSIGNED' && form('EN_ROUTE', 'Start pickup travel')}
          {pickup && s.pickup === 'EN_ROUTE' && form('ARRIVE', 'Confirm arrival')}
          {pickup &&
            s.pickup === 'ARRIVED' &&
            form(
              'COLLECT',
              'Record collection',
              s.lines.map((l) => qty('qty:' + l.id, l.name, l.unit)),
            )}
          {s.lines
            .filter((l) => l.pickup > 0)
            .map((l) => (
              <p key={l.id}>
                {l.name} · {l.service} · Collected {displayQuantity(l.pickup, l.unit)}
              </p>
            ))}
          {s.deliveries.map((d) => (
            <article className="surface panel-pad" key={d.id}>
              <h3>Assigned delivery · {d.status}</h3>
              {d.quantities.map((i) => (
                <p key={i.lineId}>
                  {s.lines.find((l) => l.id === i.lineId)?.name}:{' '}
                  {displayQuantity(
                    i.quantity,
                    s.lines.find((l) => l.id === i.lineId)?.unit || 'PIECE',
                  )}
                </p>
              ))}
              {d.status === 'ASSIGNED' &&
                form('DISPATCH', 'Confirm dispatch', [hidden('deliveryId', d.id)])}
              {d.status === 'DISPATCHED' &&
                form(
                  'ACKNOWLEDGE',
                  'Record recipient acknowledgement',
                  [
                    hidden('deliveryId', d.id),
                    { name: 'recipient', label: 'Recipient name / acknowledgement reference' },
                    note,
                    {
                      name: 'evidenceId',
                      label: 'Your attached evidence',
                      type: 'select',
                      required: false,
                      options: [
                        { value: '', label: 'No attachment' },
                        ...files.map((f) => ({ value: f.id, label: f.name })),
                      ],
                    },
                    ...d.quantities.map((i) =>
                      qty(
                        'qty:' + i.lineId,
                        s.lines.find((l) => l.id === i.lineId)?.name || 'Garment',
                        s.lines.find((l) => l.id === i.lineId)?.unit || 'PIECE',
                        i.quantity,
                      ),
                    ),
                  ],
                  'Undelivered items stay in transit until laundry staff confirm the physical return.',
                )}
              {['ASSIGNED', 'DISPATCHED'].includes(d.status) &&
                form('FAIL_DELIVERY', 'Report delivery exception', [
                  hidden('deliveryId', d.id),
                  note,
                ])}
            </article>
          ))}
        </section>
        <section className="surface panel-pad">
          <h2>Your evidence</h2>
          <EvidenceUpload orderId={id} />
          {files.map((f) => (
            <p key={f.id}>
              <a href={'/api/v1/files/' + f.id}>{f.name}</a>
            </p>
          ))}
        </section>
        <section className="surface panel-pad">
          <h2>Your recent actions</h2>
          {events.map((e) => (
            <p key={e.id}>
              {e.action.replaceAll('_', ' ')} · {e.createdAt.toISOString()}
            </p>
          ))}
        </section>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS / ORDER JOURNEY</p>
          <h1>SS-{String(row.number).padStart(6, '0')}</h1>
          <p>
            {branch?.name} · {unit?.name} · Version {row.version}
          </p>
        </div>
        <Link className="text-link" href="/workspace/work">
          Back to queue
        </Link>
      </div>
      <WorkflowPipeline state={s} />
      <div className="journey-summary">
        <section className="surface panel-pad">
          <span className="pill">{row.queue.replaceAll('_', ' ')}</span>
          <h2>{branch?.name}</h2>
          <p>{branch?.address}</p>
          {branch?.phone && (
            <a className="text-link" href={`tel:${branch.phone}`}>
              {branch.phone}
            </a>
          )}
          <p>
            Pickup: {s.pickup.replaceAll('_', ' ')} · Custody: {s.custody}
          </p>
          {s.intake && (
            <p>
              Request from {s.intake.source === 'PHONE' ? 'phone' : 'WhatsApp'}
              {s.intake.note ? `: ${s.intake.note}` : ''}
            </p>
          )}
          <p>Assigned collector: {assignee?.displayName}</p>
          <p>Scheduled: {row.scheduledAt.toISOString()}</p>
        </section>
        <section className="surface panel-pad">
          <h2>Quantity reconciliation</h2>
          <p>
            Pickup and inward observations are permanent. Accepted stock moves between buckets;
            rework never creates new stock.
          </p>
          <p>
            {s.completedAt
              ? `Fully delivered and reconciled: ${s.completedAt}`
              : 'Billing remains blocked until the complete order is acknowledged.'}
          </p>
        </section>
      </div>
      <section className="surface">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Garment / service</th>
                <th>Pickup</th>
                <th>Inward</th>
                <th>Accepted</th>
                {buckets.map((b) => (
                  <th key={b}>{b.toLowerCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                    <br />
                    {l.service}
                    <br />
                    {l.route.join(' → ')}
                    {l.discrepancy && (
                      <p className="form-error">{l.discrepancy.replaceAll('_', ' ')}</p>
                    )}
                  </td>
                  <td>{displayQuantity(l.pickup, l.unit)}</td>
                  <td>{l.inward === null ? 'Not counted' : displayQuantity(l.inward, l.unit)}</td>
                  <td>
                    {l.accepted === null ? 'Not approved' : displayQuantity(l.accepted, l.unit)}
                  </td>
                  {buckets.map((b) => (
                    <td key={b}>{displayQuantity(l.balances[b], l.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {admin && s.lines.some((line) => line.pickup > 0) && (
        <details className="surface panel-pad">
          <summary>Record loss or damage</summary>
          {s.lines
            .filter((line) => line.pickup > 0)
            .map((line) => (
              <CommandForm
                key={line.id}
                endpoint="/api/v1/finance"
                action="RECORD_LOSS"
                title={line.name + ' · incident'}
                confirmation
                fields={[
                  {
                    name: 'orderId',
                    label: 'Work order',
                    type: 'select',
                    options: [{ value: id, label: 'SS-' + row.number }],
                  },
                  hidden('lineId', line.id),
                  {
                    name: 'incident',
                    label: 'Incident type',
                    type: 'select',
                    options: [
                      { value: 'MISSING', label: 'Missing' },
                      { value: 'DAMAGED', label: 'Damaged' },
                    ],
                  },
                  { name: 'quantity', label: 'Affected quantity', unit: line.unit },
                  note,
                ]}
              />
            ))}
        </details>
      )}
      <section className="surface panel-pad">
        <p className="eyebrow">NEXT ACTIONS</p>
        <h2>Move work forward.</h2>
        <div className="action-grid">
          {coord && s.pickup !== 'COLLECTED' && s.pickup !== 'CANCELLED' && (
            <details>
              <summary>Reassign or cancel pickup</summary>
              {form('REASSIGN_PICKUP', 'Reassign pickup', [
                { name: 'executiveId', label: 'New executive', lookup: '/api/v1/executives' },
                note,
              ])}
              {form('CANCEL_PICKUP', 'Cancel uncollected pickup', [note])}
            </details>
          )}

          {pickup && s.pickup === 'ASSIGNED' && form('EN_ROUTE', 'Start pickup travel')}
          {pickup && s.pickup === 'EN_ROUTE' && form('ARRIVE', 'Confirm arrival')}
          {pickup &&
            s.pickup === 'ARRIVED' &&
            form(
              'COLLECT',
              'Record collection',
              s.lines.map((l) => qty('qty:' + l.id, l.name, l.unit)),
            )}
          {coord && s.pickup === 'COLLECTED' && s.lines.some((line) => line.inward === null) && (
            <div key={row.version}>
              <VerifyPickup
                orderId={id}
                version={row.version}
                items={s.lines
                  .filter((line) => line.inward === null)
                  .map((line) => ({
                    id: line.id,
                    label: line.name + ' · ' + line.service,
                    quantity: line.pickup,
                    unit: line.unit,
                  }))}
              />
              <details>
                <summary>Report a count mismatch</summary>
                {form(
                  'VERIFY_RECEIPT',
                  'Verify inward counts',
                  s.lines
                    .filter((l) => l.inward === null)
                    .map((l) =>
                      qty(
                        'qty:' + l.id,
                        `${l.name} · picked up ${displayQuantity(l.pickup, l.unit)}`,
                        l.unit,
                      ),
                    ),
                  'Enter the count you physically observed for every item. Any mismatch moves the order to Exceptions for review.',
                )}
              </details>
            </div>
          )}
          {admin &&
            s.lines
              .filter((l) => l.discrepancy)
              .map((l) =>
                form(
                  'RESOLVE',
                  'Approve observed stock: ' + l.name,
                  [hidden('lineId', l.id), note],
                  `Pickup ${l.pickup / 1000}; inward ${Number(l.inward) / 1000}. This accepts the inward count without changing either observation.`,
                ),
              )}
          {coord &&
            s.lines.every((l) => l.accepted !== null) &&
            s.lines
              .filter((l) => l.balances.AVAILABLE || l.balances.REWORK)
              .map((l) =>
                form(
                  l.balances.REWORK ? 'REWORK' : 'ALLOCATE',
                  (l.balances.REWORK ? 'Start rework: ' : 'Allocate batch: ') + l.name,
                  [
                    hidden('lineId', l.id),
                    qty(
                      'quantity',
                      'Batch quantity',
                      l.unit,
                      l.balances.REWORK || l.balances.AVAILABLE,
                    ),
                    { name: 'machine', label: 'Machine / workstation reference' },
                    { name: 'operator', label: 'Operator reference' },
                  ],
                ),
              )}
          {coord &&
            s.batches
              .filter((b) => b.status !== 'DONE')
              .map((b) => {
                const l = s.lines.find((l) => l.id === b.lineId)!;
                const fabricCheck: Field = {
                  name: 'fabricChecked',
                  label: 'I inspected the fabric condition',
                  type: 'checkbox',
                  required: true,
                };
                const expected = displayQuantity(b.quantity, l.unit);
                return (
                  <div className="quality-batch" key={b.id}>
                    {b.status === 'PROCESSING' ? (
                      form(
                        'ADVANCE',
                        `Complete ${l.route[b.step]}: ${l.name}`,
                        [hidden('batchId', b.id)],
                        `${expected} · ${b.machine} · ${b.operator}`,
                      )
                    ) : (
                      <>
                        {form(
                          'QC',
                          'Confirm quality: ' + l.name,
                          [
                            hidden('batchId', b.id),
                            {
                              ...qty('passed', 'Passed quantity', l.unit, b.quantity),
                              type: 'hidden',
                            },
                            { ...fabricCheck, label: 'Fabric quality passed' },
                          ],
                          `Inward accepted total ${displayQuantity(l.accepted ?? 0, l.unit)}. Confirm the verified quantity for this batch.`,
                          [{ id: b.id, label: l.name + ' · ' + l.service, count: expected }],
                        )}
                        <details className="quality-exception">
                          <summary>Report a count or fabric issue</summary>
                          {form(
                            'QC',
                            'Record a quality exception: ' + l.name,
                            [
                              hidden('batchId', b.id),
                              {
                                name: 'exception',
                                label: 'Quality exception',
                                type: 'hidden',
                                initial: 'yes',
                              },
                              qty('passed', 'Quantity that passed', l.unit),
                              fabricCheck,
                              { name: 'reason', label: 'Count, loss or fabric issue' },
                            ],
                            `Expected ${expected}. Any balance stays in rework and blocks dispatch.`,
                          )}
                        </details>
                      </>
                    )}
                  </div>
                );
              })}
          {readyToQueue &&
            form(
              'VERIFY_AND_QUEUE',
              'Ready for dispatch',
              [
                {
                  name: 'executiveId',
                  label: 'Delivery executive',
                  lookup: '/api/v1/executives',
                  initial: row.executiveId,
                },
                {
                  name: 'routeLabel',
                  label: 'Dispatch route label (optional)',
                  required: false,
                  hint: 'Use the same label for stops you have confirmed share a route.',
                },
                ...dueLines.map((l) =>
                  qty(
                    'qty:' + l.id,
                    `${l.name} · expected ${displayQuantity((l.accepted ?? 0) - l.balances.DELIVERED, l.unit)}`,
                    l.unit,
                  ),
                ),
              ],
              'Count the packed items before releasing them. A mismatch leaves the order at the laundry and does not create a delivery assignment.',
            )}
          {s.deliveries
            .filter(
              (d) =>
                (coord || d.executiveId === actor.id) &&
                (d.status === 'ASSIGNED' || d.status === 'DISPATCHED'),
            )
            .map((d) => (
              <div key={d.id}>
                {d.status === 'ASSIGNED'
                  ? form('DISPATCH', 'Dispatch delivery', [hidden('deliveryId', d.id)])
                  : form(
                      'ACKNOWLEDGE',
                      'Record delivery acknowledgement',
                      [
                        hidden('deliveryId', d.id),
                        ...d.quantities.map((v) => {
                          const l = s.lines.find((l) => l.id === v.lineId)!;
                          return qty('qty:' + l.id, l.name + ' acknowledged', l.unit, v.quantity);
                        }),
                        { name: 'recipient', label: 'Recipient name / acknowledgement reference' },
                        note,
                        {
                          name: 'evidenceId',
                          label: 'Attached evidence (required if policy says so)',
                          type: 'select',
                          required: false,
                          options: [
                            { value: '', label: 'No attachment' },
                            ...files.map((f) => ({ value: f.id, label: f.name })),
                          ],
                        },
                      ],
                      'Enter only quantities actually accepted. The undelivered balance is recorded as returned to the laundry. Confirm physical return before submitting.',
                    )}
                {form(
                  'FAIL_DELIVERY',
                  'Close failed delivery',
                  [hidden('deliveryId', d.id), note],
                  'Closes the delivery attempt. Dispatched garments stay in transit until laundry staff confirm the return.',
                )}
              </div>
            ))}
        </div>
        {s.completedAt && (
          <p className="save-notice">
            This order is fully reconciled and ready for an eligible billing cycle.
          </p>
        )}
      </section>
      <div className="journey-summary">
        {s.deliveries
          .filter((delivery) => delivery.returnPending)
          .map((delivery) => (
            <section className="surface panel-pad" key={delivery.id}>
              <h2>Confirm returned garments</h2>
              <p>
                Check that all quantities below are physically at the laundry before confirming.
              </p>
              <ul>
                {delivery.quantities.map((item) => {
                  const line = s.lines.find((value) => value.id === item.lineId);
                  const accepted =
                    delivery.acknowledged?.find((value) => value.lineId === item.lineId)
                      ?.quantity ?? 0;
                  const returned = item.quantity - accepted;
                  return returned > 0 && line ? (
                    <li key={item.lineId}>
                      {line.name} · {displayQuantity(returned, line.unit)}
                    </li>
                  ) : null;
                })}
              </ul>
              {form('RECEIVE_RETURN', 'Confirm physical return', [
                hidden('deliveryId', delivery.id),
                note,
              ])}
            </section>
          ))}
        <section className="surface panel-pad">
          <h2>Private evidence</h2>
          <EvidenceUpload orderId={id} />
          <ul>
            {files.map((f) => (
              <li key={f.id}>
                <a className="text-link" href={`/api/v1/files/${f.id}`}>
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface panel-pad">
          <h2>Delivery attempts</h2>
          {s.deliveries.length ? (
            s.deliveries.map((d) => (
              <div className="timeline-item" key={d.id}>
                <strong>{d.status}</strong>
                <p>
                  {d.recipient || 'Awaiting acknowledgement'} · {d.at || 'Not closed'}
                </p>
                <p>{d.reason}</p>
                {d.acknowledged?.map((v) => (
                  <small key={v.lineId}>
                    {s.lines.find((l) => l.id === v.lineId)?.name}: {v.quantity / 1000}{' '}
                    acknowledged{' '}
                  </small>
                ))}
              </div>
            ))
          ) : (
            <p>No delivery attempts yet.</p>
          )}
        </section>
      </div>
      <details className="surface panel-pad">
        <summary>Quantity movements ({movements.length}, latest view capped at 500)</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time UTC</th>
                <th>Garment</th>
                <th>From → To</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.createdAt.toISOString()}</td>
                  <td>{s.lines.find((l) => l.id === m.lineId)?.name}</td>
                  <td>
                    {m.from} → {m.to}
                  </td>
                  <td>{displayQuantity(m.quantity, m.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <section className="surface panel-pad">
        <h2>Authorized history</h2>
        <p>Most recent 100 actions, newest first.</p>
        {events.map((e) => (
          <div className="timeline-item" key={e.id}>
            <strong>{e.action.replaceAll('_', ' ')}</strong>
            <small>{e.createdAt.toISOString()}</small>
          </div>
        ))}
      </section>
    </>
  );
}
