import Link from 'next/link';
import { z } from 'zod';
import { requireAdmin, formatMoney, displayQuantity, type Policy } from '@shree/domain';
import { pageActor } from '@/server/page-access';
import { database } from '@/server/db';
import { invoiceBalance } from '@/server/finance';
import InvoicePickupRegister from '@/components/InvoicePickupRegister';
import { billingMonthForPeriod } from '@/lib/pickup-register';
import { invoicePickupCollections } from '@/server/invoice-pickups';
import CommandForm from '@/components/CommandForm';
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor();
  requireAdmin(actor);
  const id = z.uuid().parse((await params).id),
    { row: i, paid, credits, outstanding } = await invoiceBalance(database(), id);
  const s = i.snapshot as unknown as {
    policy: Policy;
    branch: { name: string; address: string; client: string };
    lines: {
      orderId: string;
      orderNumber: string;
      collectedAt?: string | null;
      garment: string;
      service: string;
      quantity: number;
      unit: string;
      rate: string;
      rateId: string;
      rateScope: string;
      effectiveAt: string;
      pricingDate: string;
      amount: string;
    }[];
    excluded: { id: string; number: string; reason: string }[];
  };
  const money = (n: bigint | string) => formatMoney(n, s.policy.scale, i.currency),
    payments = await database().payment.findMany({
      where: { clientId: i.clientId, currency: i.currency, reversedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  const allocatedReceipts = [
    ...new Map(
      i.receipts.map((allocation) => [allocation.payment.id, allocation.payment]),
    ).values(),
  ];
  const verified = new Set(
    (
      await database().auditLog.findMany({
        where: {
          action: 'VERIFY_PAYMENT',
          resourceType: 'payment',
          resourceId: { in: allocatedReceipts.map((receipt) => receipt.id) },
        },
        select: { resourceId: true },
      })
    ).map((record) => record.resourceId),
  );
  const collections = await invoicePickupCollections(i.branchId, s.lines);
  const calendarDays = billingMonthForPeriod(i.startsAt, i.endsAt)?.days;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCE / SOURCE RECONCILIATION</p>
          <h1>{i.number || 'Invoice draft'}</h1>
          <p>
            {s.branch.client} · {s.branch.name} · {i.status}
          </p>
        </div>
        <Link href="/workspace/finance" className="text-link">
          Back to finance
        </Link>
      </div>
      <section className="surface panel-pad">
        <h2>{s.policy.legalName}</h2>
        <p>{s.policy.legalAddress}</p>
        <p>{s.policy.registration}</p>
        <p>
          Bill to: {s.branch.name} · {s.branch.address}
        </p>
        <p>
          Period [{i.startsAt.toISOString()}, {i.endsAt.toISOString()}) · Due{' '}
          {i.dueAt.toISOString()}
        </p>
        <p>
          Pricing date: {s.policy.pricingDate} · Tax: {s.policy.taxMode} ({s.policy.taxBps} basis
          points) · Rounding: {s.policy.rounding}
        </p>
      </section>
      <InvoicePickupRegister
        lines={s.lines}
        calendarDays={calendarDays}
        downloadHref={'/api/v1/finance/pickup-register?invoice=' + i.id}
        collections={collections}
        timezone={s.policy.timezone}
        money={money}
      />
      <details className="surface panel-pad">
        <summary>Invoice source lines and totals</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order / item</th>
                <th>Quantity</th>
                <th>Resolved rate</th>
                <th>Source / pricing date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l, n) => (
                <tr key={n}>
                  <td>
                    <Link href={`/workspace/work/${l.orderId}`}>SS-{l.orderNumber}</Link>
                    <br />
                    {l.garment} / {l.service}
                  </td>
                  <td>{displayQuantity(l.quantity, l.unit)}</td>
                  <td>{money(l.rate)}</td>
                  <td>
                    {l.rateScope} · {l.rateId.slice(0, 8)}
                    <br />
                    {l.effectiveAt}
                    <br />
                    Priced at {l.pricingDate}
                  </td>
                  <td>{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice-totals">
          <p>
            Subtotal <strong>{money(i.subtotal)}</strong>
          </p>
          <p>
            Tax <strong>{money(i.tax)}</strong>
          </p>
          <p>
            Total <strong>{money(i.total)}</strong>
          </p>
          <p>
            Credits <strong>{money(credits)}</strong>
          </p>
          <p>
            Allocated payments <strong>{money(paid)}</strong>
          </p>
          <p>
            Outstanding <strong>{i.status === 'ISSUED' ? money(outstanding) : 'Not posted'}</strong>
          </p>
        </div>
      </details>
      <details className="surface panel-pad">
        <summary>Excluded orders and reasons ({s.excluded.length})</summary>
        {s.excluded.map((e) => (
          <p key={e.id}>
            <Link href={`/workspace/work/${e.id}`}>SS-{e.number}</Link>: {e.reason}
          </p>
        ))}
      </details>
      <section className="surface panel-pad">
        <h2>Reviewed actions</h2>
        <div className="action-grid">
          {(i.status === 'DRAFT'
            ? ['APPROVE', 'CANCEL']
            : i.status === 'APPROVED'
              ? ['ISSUE', 'CANCEL']
              : []
          ).map((action) => (
            <CommandForm
              key={action}
              title={
                action === 'ISSUE'
                  ? 'Issue immutable invoice'
                  : action === 'APPROVE'
                    ? 'Approve draft'
                    : 'Cancel and release reservations'
              }
              endpoint="/api/v1/finance"
              action={action}
              fields={[
                {
                  name: 'invoiceId',
                  label: 'Invoice',
                  type: 'select',
                  options: [{ value: id, label: i.number || id.slice(0, 8) }],
                },
              ]}
              confirmation
            />
          ))}
          {i.status === 'ISSUED' && (
            <>
              <a className="button secondary" href={`/api/v1/invoices/${id}/pdf`}>
                Download final PDF
              </a>
              <CommandForm
                title="Queue PDF retry"
                endpoint="/api/v1/finance"
                action="RETRY_PDF"
                fields={[
                  {
                    name: 'invoiceId',
                    label: 'Invoice',
                    type: 'select',
                    options: [{ value: id, label: i.number! }],
                  },
                ]}
              />
              <CommandForm
                title="Allocate received payment"
                endpoint="/api/v1/finance"
                action="ALLOCATE_PAYMENT"
                confirmation
                fields={[
                  {
                    name: 'invoiceId',
                    label: 'Invoice',
                    type: 'select',
                    options: [{ value: id, label: i.number! }],
                  },
                  {
                    name: 'paymentId',
                    label: 'Client receipt (latest 50)',
                    type: 'select',
                    options: [
                      { value: '', label: 'Choose a receipt' },
                      ...payments.map((p) => ({
                        value: p.id,
                        label: p.reference + ' · ' + money(p.amount),
                      })),
                    ],
                  },
                  { name: 'amount', label: 'Amount to allocate' },
                ]}
              />
              <CommandForm
                title="Post credit adjustment"
                endpoint="/api/v1/finance"
                action="CREDIT"
                confirmation
                description="Only an approved credit adjustment policy permits posting. Amount cannot exceed unpaid balance. Refunds and multi-tax legal credit-note formats require additional review."
                fields={[
                  {
                    name: 'invoiceId',
                    label: 'Invoice',
                    type: 'select',
                    options: [{ value: id, label: i.number! }],
                  },
                  { name: 'amount', label: 'Credit amount' },
                  { name: 'reason', label: 'Credit reason / source reference' },
                ]}
              />
            </>
          )}
        </div>
      </section>
      {i.status === 'ISSUED' && (
        <section className="surface panel-pad">
          <h2>Posted credit history</h2>
          {i.credits.map((c) => (
            <p key={c.id}>
              {c.createdAt.toISOString()} · {money(c.amount)} · {c.reason}
            </p>
          ))}
          {allocatedReceipts
            .filter((receipt) => !receipt.reversedAt && !verified.has(receipt.id))
            .map((receipt) => (
              <CommandForm
                key={receipt.id}
                endpoint="/api/v1/finance"
                action="VERIFY_PAYMENT"
                confirmation
                title="Verify funds credited"
                description="Confirm this receipt against your bank or cash records."
                fields={[
                  {
                    name: 'paymentId',
                    label: 'Receipt',
                    type: 'select',
                    options: [
                      {
                        value: receipt.id,
                        label: receipt.reference + ' · ' + money(receipt.amount),
                      },
                    ],
                  },
                  { name: 'reason', label: 'Bank confirmation or verification note' },
                ]}
              />
            ))}
          <h2>Payment allocations</h2>
          {i.receipts.map((r) => (
            <p key={r.id}>
              {r.createdAt.toISOString()} · {money(r.amount)} ·{' '}
              {r.payment.reversedAt
                ? 'REVERSED'
                : verified.has(r.payment.id)
                  ? 'VERIFIED'
                  : 'AWAITING VERIFICATION'}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
