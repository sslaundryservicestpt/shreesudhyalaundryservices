import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { pageActor } from '@/server/page-access';
import { executiveCrm } from '@/server/crm';
import CommandForm from '@/components/CommandForm';
import QueueRefresh from '@/components/QueueRefresh';
import AssignedPickupSelect from '@/components/AssignedPickupSelect';

export default async function PickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; stage?: string }>;
}) {
  const { task, stage } = await searchParams;
  if (task && !z.uuid().safeParse(task).success) notFound();
  const actor = await pageActor();
  const [pickups, notifications] = await executiveCrm(actor, task, !task && stage === 'pending');
  if (task && !pickups.length) notFound();
  const date = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  return (
    <>
      <QueueRefresh />
      <header className="page-heading">
        <div>
          <p className="eyebrow">Field work</p>
          <h1>
            {task ? 'Pickup task' : stage === 'pending' ? 'Pending pickups' : 'Assigned pickups'}
          </h1>
          <p>Open a task for its pickup window, site instructions and next action.</p>
        </div>
        {task && (
          <Link className="button secondary" href="/workspace/pickups">
            Back to assigned pickups
          </Link>
        )}
      </header>
      {!task && pickups.length > 0 && (
        <section className="surface panel-pad">
          <AssignedPickupSelect
            tasks={pickups.map((pickup) => ({
              id: pickup.id,
              label:
                (pickup.lead.branch?.name ?? 'Client site') +
                ' · ' +
                date.format(pickup.windowStart),
            }))}
          />
        </section>
      )}
      {!task && (
        <section className="surface panel-pad">
          <h2 id="notifications">Notifications</h2>
          {notifications.length ? (
            <ul className="crm-record-list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link href={'?task=' + item.pickupId}>
                    <strong>{item.pickup.lead.branch?.name ?? 'Pickup task'}</strong>
                    <span>
                      New pickup assigned ·{' '}
                      {date.formatRange(item.pickup.windowStart, item.pickup.windowEnd)} IST
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No unread pickup notifications.</p>
          )}
        </section>
      )}
      {!pickups.length && (
        <section className="surface panel-pad">
          <h2>No pickups in your queue</h2>
          <p>Assigned tasks appear here when a supervisor gives you a pickup.</p>
        </section>
      )}
      {pickups.map((pickup) => {
        const lead = pickup.lead;
        const notification = notifications.find((item) => item.pickupId === pickup.id);
        const action =
          pickup.status === 'IN_QUEUE'
            ? 'START'
            : pickup.status === 'GOING_FOR_PICKUP'
              ? 'ARRIVE'
              : null;
        return (
          <section key={pickup.id} className="surface panel-pad">
            <h2>
              {task ? (
                lead.branch?.name
              ) : (
                <Link href={'?task=' + pickup.id}>{lead.branch?.name}</Link>
              )}
            </h2>
            <p>
              {lead.branch?.client.name} · {pickup.status.toLowerCase().replaceAll('_', ' ')}
            </p>
            <p>{date.formatRange(pickup.windowStart, pickup.windowEnd)} IST</p>
            {task && (
              <>
                <p>
                  {lead.contactName} ·{' '}
                  <a href={'tel:' + lead.phone.replace(/[^+\d]/g, '')}>{lead.phone}</a>
                </p>
                <p>{lead.address}</p>
                <p>
                  <a
                    href={
                      'https://www.google.com/maps/search/?api=1&query=' +
                      encodeURIComponent(lead.address)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open pickup address in Maps
                  </a>
                </p>
                {lead.instructions && <p>{lead.instructions}</p>}
                {action ? (
                  <CommandForm
                    title={
                      action === 'START'
                        ? 'Start travelling to pickup'
                        : 'Confirm arrival at branch'
                    }
                    endpoint="/api/v1/crm"
                    recordId={pickup.id}
                    version={pickup.version}
                    action={action}
                  />
                ) : (
                  <p>Arrival recorded. Collection entry for CRM requests opens in Phase 2.</p>
                )}
                {notification && (
                  <CommandForm
                    title="Mark notification as read"
                    endpoint="/api/v1/crm"
                    action="READ"
                    recordId={notification.id}
                  />
                )}
              </>
            )}
          </section>
        );
      })}
      {!task && (
        <p>
          <Link href="/workspace/work?view=history">View work history</Link>
        </p>
      )}
    </>
  );
}
