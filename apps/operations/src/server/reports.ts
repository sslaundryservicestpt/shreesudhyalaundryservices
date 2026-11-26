import 'server-only';
import { z } from 'zod';
import {
  DomainError,
  requireAdmin,
  requireIdentity,
  csvCell,
  type Principal,
  type WorkState,
} from '@shree/domain';
import { database } from './db';
import { workScope } from './work';
export const reportFilter = z.object({
  kind: z
    .enum(['work', 'quantities', 'invoices', 'payments', 'expenses', 'statement'])
    .default('work'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  branch: z.uuid().optional(),
  client: z.uuid().optional(),
});
export function authorizeReport(actor: Principal, kind: string) {
  requireIdentity(actor);
  if (kind === 'work' || kind === 'quantities') {
    if (!actor.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR'))
      throw new DomainError(
        'FORBIDDEN',
        'Coordinator reports require administrator or supervisor access.',
        403,
      );
    workScope(actor);
  } else requireAdmin(actor);
}
export async function reportData(actor: Principal, search: Record<string, string | undefined>) {
  const f = reportFilter.parse(
    Object.fromEntries(Object.entries(search).filter(([, v]) => v !== '')),
  );
  authorizeReport(actor, f.kind);
  if (f.from && f.to && new Date(f.from) >= new Date(f.to))
    throw new DomainError('INVALID_PERIOD', 'End must follow start.', 422);
  const dates = {
    ...(f.from ? { gte: new Date(f.from) } : {}),
    ...(f.to ? { lt: new Date(f.to) } : {}),
  };
  let columns: string[] = [],
    rows: unknown[][] = [];
  if (f.kind === 'work' || f.kind === 'quantities') {
    const orders = await database().workOrder.findMany({
      where: {
        AND: [
          workScope(actor),
          {
            ...(f.branch ? { branchId: f.branch } : {}),
            ...(f.client ? { clientId: f.client } : {}),
            createdAt: dates,
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 5001,
    });
    if (orders.length > 5000)
      throw new DomainError('REPORT_LIMIT', 'Narrow the period to at most 5000 orders.', 422);
    if (f.kind === 'work') {
      columns = [
        'Order',
        'Order ID',
        'Branch ID',
        'Queue',
        'Created UTC',
        'Scheduled UTC',
        'Pickup',
        'Custody',
        'Completed UTC',
      ];
      rows = orders.map((o) => {
        const s = o.state as unknown as WorkState;
        return [
          String(o.number),
          o.id,
          o.branchId,
          o.queue,
          o.createdAt.toISOString(),
          o.scheduledAt.toISOString(),
          s.pickup,
          s.custody,
          s.completedAt || '',
        ];
      });
    } else {
      columns = [
        'Order',
        'Order ID',
        'Branch ID',
        'Garment',
        'Service',
        'Unit',
        'Pickup',
        'Inward',
        'Accepted',
        'Available',
        'Processing',
        'QC',
        'Rework',
        'Passed',
        'Released',
        'Transit',
        'Delivered',
      ];
      rows = orders.flatMap((o) =>
        (o.state as unknown as WorkState).lines.map((l) => [
          String(o.number),
          o.id,
          o.branchId,
          l.name,
          l.service,
          l.unit,
          l.pickup / 1000,
          l.inward === null ? '' : l.inward / 1000,
          l.accepted === null ? '' : l.accepted / 1000,
          ...[
            'AVAILABLE',
            'PROCESSING',
            'QC',
            'REWORK',
            'PASSED',
            'RELEASED',
            'TRANSIT',
            'DELIVERED',
          ].map((b) => l.balances[b as keyof typeof l.balances] / 1000),
        ]),
      );
    }
  } else {
    requireAdmin(actor);
    if (f.kind === 'invoices' || f.kind === 'statement') {
      if (f.kind === 'statement' && !f.client)
        throw new DomainError('CLIENT_REQUIRED', 'Choose a client for its statement.', 422);
      const invoices = await database().invoice.findMany({
        where: {
          status: 'ISSUED',
          ...(f.branch ? { branchId: f.branch } : {}),
          ...(f.client ? { clientId: f.client } : {}),
          issuedAt: dates,
        },
        include: { credits: true, receipts: { include: { payment: true } } },
        orderBy: { issuedAt: 'asc' },
        take: 5001,
      });
      if (invoices.length > 5000)
        throw new DomainError('REPORT_LIMIT', 'Narrow the report period.', 422);
      columns = [
        'Invoice',
        'Invoice ID',
        'Client ID',
        'Branch ID',
        'Issued UTC',
        'Due UTC',
        'Currency',
        'Subtotal minor units',
        'Tax minor units',
        'Total minor units',
        'Credits minor units',
        'Allocated posted receipts minor units',
        'Outstanding minor units',
        'Overdue',
      ];
      rows = invoices.map((i) => {
        const credit = i.credits.reduce((n, c) => n + c.amount, 0n),
          paid = i.receipts.filter((a) => !a.payment.reversedAt).reduce((n, a) => n + a.amount, 0n),
          outstanding = i.total - credit - paid;
        return [
          i.number,
          i.id,
          i.clientId,
          i.branchId,
          i.issuedAt?.toISOString(),
          i.dueAt.toISOString(),
          i.currency,
          String(i.subtotal),
          String(i.tax),
          String(i.total),
          String(credit),
          String(paid),
          String(outstanding),
          outstanding > 0n && i.dueAt < new Date() ? 'YES' : 'NO',
        ];
      });
    } else if (f.kind === 'payments') {
      if (f.branch)
        throw new DomainError(
          'INVALID_FILTER',
          'Receipts belong to clients, not branches. Remove branch filter.',
          422,
        );
      const payments = await database().payment.findMany({
        where: { ...(f.client ? { clientId: f.client } : {}), receivedAt: dates },
        include: { allocations: true },
        orderBy: { receivedAt: 'asc' },
        take: 5001,
      });
      if (payments.length > 5000)
        throw new DomainError('REPORT_LIMIT', 'Narrow the report period.', 422);
      columns = [
        'Receipt ID',
        'Client ID',
        'Received UTC',
        'Currency',
        'Amount minor units',
        'Posted amount minor units',
        'Unallocated credit minor units',
        'Reference',
        'Reversed UTC',
      ];
      rows = payments.map((p) => [
        p.id,
        p.clientId,
        p.receivedAt.toISOString(),
        p.currency,
        String(p.amount),
        p.reversedAt ? '0' : String(p.amount),
        p.reversedAt ? '0' : String(p.amount - p.allocations.reduce((n, a) => n + a.amount, 0n)),
        p.reference,
        p.reversedAt?.toISOString() || '',
      ]);
    } else {
      if (f.branch || f.client)
        throw new DomainError(
          'INVALID_FILTER',
          'Expenses are entity-wide. Remove client/branch filters.',
          422,
        );
      const expenses = await database().expense.findMany({
        where: { incurredAt: dates },
        orderBy: { incurredAt: 'asc' },
        take: 5001,
      });
      if (expenses.length > 5000)
        throw new DomainError('REPORT_LIMIT', 'Narrow the report period.', 422);
      columns = [
        'Expense ID',
        'Category',
        'Description',
        'Incurred UTC',
        'Currency',
        'Amount minor units',
        'Status',
      ];
      rows = expenses.map((e) => [
        e.id,
        e.category,
        e.description,
        e.incurredAt.toISOString(),
        e.currency,
        String(e.amount),
        e.status,
      ]);
    }
  }
  return { filter: f, columns, rows, generatedAt: new Date().toISOString() };
}
export function reportCsv(report: { columns: string[]; rows: unknown[][] }) {
  return (
    '\uFEFF' +
    [report.columns, ...report.rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  );
}
