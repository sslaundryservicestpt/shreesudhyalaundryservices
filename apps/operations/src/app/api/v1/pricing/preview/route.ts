import { z } from 'zod';
import {
  requireAdmin,
  quantity,
  resolveRate,
  lineAmount,
  formatMoney,
  DomainError,
} from '@shree/domain';
import { principal } from '@/server/auth';
import { database } from '@/server/db';
import { policy } from '@/server/finance';
import { failure, json, requestId } from '@/server/http';
export async function GET(request: Request) {
  const correlation = requestId();
  try {
    requireAdmin(await principal());
    const v = z
      .object({
        branchId: z.uuid(),
        garmentId: z.uuid(),
        serviceId: z.uuid(),
        at: z.iso.datetime(),
        quantity: z.string().max(20),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const db = database(),
      p = await policy(db),
      branch = await db.branch.findUnique({ where: { id: v.branchId } }),
      garment = await db.garmentType.findUnique({ where: { id: v.garmentId } });
    if (!branch || !garment)
      throw new DomainError('INVALID_RECORD', 'Choose a branch and garment.', 422);
    const r = resolveRate(
      await db.rateContract.findMany({
        where: { garmentId: garment.id, serviceId: v.serviceId, currency: p.currency },
      }),
      {
        branchId: branch.id,
        clientId: branch.clientId,
        garmentId: garment.id,
        serviceId: v.serviceId,
        unit: garment.unit,
        currency: p.currency,
        date: new Date(v.at),
        fallbackApproved: p.fallbackApproved,
      },
    );
    return json(
      {
        source: r.branchId
          ? 'Branch contract'
          : r.clientId
            ? 'Client default'
            : 'Approved fallback',
        rateId: r.id,
        rate: formatMoney(r.rate, p.scale, p.currency),
        unit: r.unit,
        subtotal: formatMoney(
          lineAmount(quantity(v.quantity, garment.unit), r.rate),
          p.scale,
          p.currency,
        ),
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        dateRule: p.pricingDate,
      },
      correlation,
    );
  } catch (e) {
    return failure(e, correlation);
  }
}
