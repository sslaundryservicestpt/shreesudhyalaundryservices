import { DomainError, formatMoney, requireAdmin } from '@shree/domain';
import { z } from 'zod';
import { principal } from '@/server/auth';
import { database } from '@/server/db';
import { failure, requestId } from '@/server/http';
import { previewBillingCycle } from '@/server/finance';
import { invoicePickupCollections } from '@/server/invoice-pickups';
import {
  billingMonth,
  billingMonthForPeriod,
  pickupRegister,
  pickupRegisterCsv,
} from '@/lib/pickup-register';

const invoiceSnapshot = z.object({
  branch: z.object({ name: z.string() }),
  policy: z.object({ timezone: z.string(), scale: z.number().int().min(0).max(3) }),
  lines: z.array(
    z.object({
      orderId: z.uuid(),
      collectedAt: z.string().nullish(),
      garment: z.string(),
      service: z.string(),
      quantity: z.number().int().nonnegative(),
      unit: z.enum(['PIECE', 'KG']),
      amount: z.string().regex(/^\d+$/),
    }),
  ),
});

async function savedRegister(invoiceId: string) {
  const invoice = await database().invoice.findUnique({
    where: { id: z.uuid().parse(invoiceId) },
    select: {
      id: true,
      number: true,
      branchId: true,
      startsAt: true,
      endsAt: true,
      currency: true,
      snapshot: true,
    },
  });
  if (!invoice) throw new DomainError('NOT_FOUND', 'Invoice not found.', 404);
  const saved = invoiceSnapshot.safeParse(invoice.snapshot);
  if (!saved.success)
    throw new DomainError(
      'REGISTER_UNAVAILABLE',
      'This invoice has no compatible pickup register.',
      409,
    );
  const { lines, branch, policy } = saved.data;
  const period = billingMonthForPeriod(invoice.startsAt, invoice.endsAt);
  return {
    resourceId: invoice.id,
    resourceType: 'invoice',
    filename: period?.month ?? invoice.id.slice(0, 8),
    title: branch.name + ' · ' + (invoice.number ?? period?.month ?? 'Invoice draft'),
    register: pickupRegister({
      lines,
      collections: await invoicePickupCollections(invoice.branchId, lines),
      calendarDays: period?.days,
      timezone: policy.timezone,
      money: (amount) => formatMoney(amount, policy.scale, invoice.currency),
    }),
  };
}

async function pendingRegister(
  actor: Awaited<ReturnType<typeof principal>>,
  query: URLSearchParams,
) {
  const period = billingMonth(query.get('month') ?? '');
  if (!period) throw new DomainError('INVALID_MONTH', 'Select a valid billing month.', 422);
  const preview = await previewBillingCycle(actor, query.get('branch') ?? '', period);
  if (query.get('review') !== preview.reviewFingerprint)
    throw new DomainError(
      'REGISTER_CHANGED',
      'Reload the billing cycle to download the updated register.',
      409,
    );
  return {
    resourceType: 'branch',
    resourceId: preview.branch.id,
    filename: period.month,
    title: preview.branch.name + ' · ' + period.month,
    register: pickupRegister({
      lines: preview.lines,
      calendarDays: period.days,
      timezone: preview.policy?.timezone ?? 'Asia/Kolkata',
      money: (amount) =>
        formatMoney(amount, preview.policy?.scale ?? 2, preview.policy?.currency ?? 'INR'),
    }),
  };
}

export async function GET(request: Request) {
  const id = requestId();
  try {
    const actor = await principal();
    requireAdmin(actor);
    const query = new URL(request.url).searchParams;
    const invoiceId = query.get('invoice');
    const entry = invoiceId ? await savedRegister(invoiceId) : await pendingRegister(actor, query);
    await database().auditLog.create({
      data: {
        actorId: actor.id,
        action: 'PICKUP_REGISTER_EXPORTED',
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        requestId: id,
        after: { pickups: entry.register.pickupCount, pickupDays: entry.register.pickupDays },
      },
    });
    return new Response(pickupRegisterCsv(entry.title, entry.register), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pickup-register-${entry.filename}.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return failure(error, id);
  }
}
