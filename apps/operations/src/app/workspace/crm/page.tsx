import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { pageActor } from '@/server/page-access';
import { crmHistory, crmQueue } from '@/server/crm';
import QueueRefresh from '@/components/QueueRefresh';
import CommandForm, { type Field } from '@/components/CommandForm';

const endpoint = '/api/v1/crm';
const labels = {
  NEW: 'New enquiries',
  UNDER_REVIEW: 'Under review',
  CONVERTED_TO_PICKUP: 'Pickup requests',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};
const dateField = (date?: Date | null) =>
  date ? new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16) : '';
const windowFields: Field[] = [
  {
    name: 'windowStart',
    label: 'Pickup start (Tirupati time)',
    type: 'datetime-local',
    timeZoneOffset: '+05:30',
  },
  {
    name: 'windowEnd',
    label: 'Pickup end (Tirupati time)',
    type: 'datetime-local',
    timeZoneOffset: '+05:30',
  },
];
const fields: Field[] = [
  { name: 'branchId', label: 'Client site', lookup: '/api/v1/masters/branches' },
  { name: 'contactName', label: 'Contact person' },
  { name: 'phone', label: 'Contact phone' },
  { name: 'address', label: 'Pickup address' },
  ...windowFields,
  { name: 'approximateItems', label: 'Approximate items', required: false },
  { name: 'instructions', label: 'Instructions for executive', required: false },
  { name: 'notes', label: 'Internal notes', required: false },
];
const reason: Field = { name: 'reason', label: 'Reason' };
const format = (date: Date) =>
  date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; status?: string; new?: string }>;
}) {
  const actor = await pageActor();
  const query = await searchParams;
  if (query.lead && !z.uuid().safeParse(query.lead).success) notFound();
  const status =
    query.status && Object.hasOwn(labels, query.status)
      ? (query.status as keyof typeof labels)
      : 'NEW';
  const leads = await crmQueue(actor, query.lead, status);
  const lead = query.lead ? leads[0] : undefined;
  if (query.lead && !lead) notFound();
  const command = lead ? { endpoint, recordId: lead.id, version: lead.version } : null;
  const pickup = lead?.pickup;
  const history = lead ? await crmHistory(actor, lead.id, pickup?.id) : [];
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Operations / CRM</p>
          <h1>{lead ? 'Review enquiry' : 'Enquiries and pickups'}</h1>
          <p>Review customer requests, confirm a pickup window and assign an executive.</p>
        </div>
        {lead && (
          <Link className="button secondary" href="/workspace/crm">
            Back to queues
          </Link>
        )}
      </header>
      {!lead && (
        <>
          <QueueRefresh />
          <details className="surface panel-pad" open={query.new === '1' ? true : undefined}>
            <summary>Log a customer enquiry</summary>
            <CommandForm
              title="Customer enquiry"
              endpoint={endpoint}
              action="CREATE"
              redirect="/workspace/crm"
              fields={[
                {
                  name: 'source',
                  label: 'Source',
                  type: 'select',
                  options: [
                    { value: 'PHONE', label: 'Phone call' },
                    { value: 'WHATSAPP', label: 'Manually logged WhatsApp' },
                  ],
                },
                ...fields,
              ]}
            />
          </details>
          <nav className="section-tabs" aria-label="CRM queues">
            {Object.entries(labels).map(([value, label]) => (
              <Link
                key={value}
                href={'?status=' + value}
                className={status === value ? 'selected' : undefined}
                aria-current={status === value ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <section className="surface panel-pad">
            <h2>{labels[status]}</h2>
            {leads.length ? (
              <ul className="crm-record-list">
                {leads.map((record) => (
                  <li key={record.id}>
                    <Link href={'?lead=' + record.id}>
                      <strong>
                        {record.branch
                          ? record.branch.client.name + ' · ' + record.branch.name
                          : 'Site to confirm'}
                      </strong>
                      <span>
                        {record.contactName || 'Contact to confirm'} ·{' '}
                        {record.source === 'PHONE' ? 'Phone' : 'WhatsApp'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No records in this queue.</p>
            )}
            {leads.length === 100 && <p>Showing the 100 most recently updated records.</p>}
          </section>
        </>
      )}
      {lead && command && (
        <section className="surface panel-pad">
          <h2>
            {lead.branch ? lead.branch.client.name + ' · ' + lead.branch.name : 'Site to confirm'}
          </h2>
          <p>
            {labels[lead.status]} · {lead.source === 'PHONE' ? 'Phone' : 'WhatsApp'}
          </p>
          <p>
            {lead.contactName} · {lead.phone}
          </p>
          {lead.reason && <p>Reason: {lead.reason}</p>}
          {lead.address && <p>{lead.address}</p>}
          {lead.instructions && <p>Instructions: {lead.instructions}</p>}
          {lead.notes && <p>Internal notes: {lead.notes}</p>}
          {(lead.status === 'NEW' || lead.status === 'UNDER_REVIEW') && (
            <>
              <CommandForm
                key={lead.version}
                {...command}
                title="Confirm enquiry details"
                action="REVIEW"
                fields={fields.map((field) => ({
                  ...field,
                  initial:
                    field.name === 'windowStart'
                      ? dateField(lead.windowStart)
                      : field.name === 'windowEnd'
                        ? dateField(lead.windowEnd)
                        : String(lead[field.name as keyof typeof lead] ?? ''),
                }))}
              />
              {lead.status === 'UNDER_REVIEW' && (
                <CommandForm
                  {...command}
                  title="Approve and create pickup request"
                  action="CONVERT"
                  confirmation
                />
              )}
              <details>
                <summary>Reject or close enquiry</summary>
                <CommandForm
                  {...command}
                  title="Reject enquiry"
                  action="REJECT"
                  fields={[reason]}
                  confirmation
                />
                <CommandForm
                  {...command}
                  title="Close enquiry"
                  action="CLOSE"
                  fields={[reason]}
                  confirmation
                />
              </details>
            </>
          )}
          {pickup && (
            <>
              <h2>Pickup request</h2>
              <p>
                {pickup.status.toLowerCase().replaceAll('_', ' ')} ·{' '}
                {pickup.executive?.displayName ?? 'Unassigned'}
              </p>
              <p>
                {format(pickup.windowStart)} to {format(pickup.windowEnd)} IST
              </p>
              {pickup.status !== 'CANCELLED' && (
                <>
                  <CommandForm
                    {...command}
                    recordId={pickup.id}
                    version={pickup.version}
                    title={pickup.executiveId ? 'Reassign executive' : 'Assign executive'}
                    action="ASSIGN"
                    fields={[
                      {
                        name: 'executiveId',
                        label: 'Delivery executive',
                        lookup: '/api/v1/executives',
                      },
                    ]}
                  />
                  <details>
                    <summary>Reschedule or cancel pickup</summary>
                    <CommandForm
                      key={pickup.version}
                      {...command}
                      recordId={pickup.id}
                      version={pickup.version}
                      title="Reschedule pickup"
                      action="RESCHEDULE"
                      fields={[
                        { ...windowFields[0], initial: dateField(pickup.windowStart) },
                        { ...windowFields[1], initial: dateField(pickup.windowEnd) },
                        reason,
                      ]}
                    />
                    <CommandForm
                      {...command}
                      recordId={pickup.id}
                      version={pickup.version}
                      title="Cancel pickup"
                      action="CANCEL"
                      fields={[reason]}
                      confirmation
                    />
                  </details>
                </>
              )}
            </>
          )}
          <h2>Recent activity</h2>
          {history.length ? (
            <ul>
              {history.map((event) => (
                <li key={event.id}>
                  {event.action.toLowerCase().replaceAll('_', ' ')} · {format(event.createdAt)}
                  {event.after &&
                  typeof event.after === 'object' &&
                  'reason' in event.after &&
                  typeof event.after.reason === 'string'
                    ? ' · ' + event.after.reason
                    : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {lead.source === 'WHATSAPP' ? 'Awaiting a staff review.' : 'No activity recorded.'}
            </p>
          )}
        </section>
      )}
    </>
  );
}
