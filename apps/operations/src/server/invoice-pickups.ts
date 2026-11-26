import 'server-only';
import type { PickupRegisterLine } from '@/lib/pickup-register';
import { database } from './db';

export async function invoicePickupCollections(branchId: string, lines: PickupRegisterLine[]) {
  const ids = [
    ...new Set(lines.filter((line) => line.collectedAt === undefined).map((line) => line.orderId)),
  ];
  if (!ids.length) return {};
  const orders = await database().workOrder.findMany({
    where: { id: { in: ids }, branchId },
    select: { id: true, state: true },
  });
  const collections: Record<string, string> = {};
  for (const { id, state } of orders) {
    if (
      state &&
      typeof state === 'object' &&
      'collectedAt' in state &&
      typeof state.collectedAt === 'string'
    )
      collections[id] = state.collectedAt;
  }
  return collections;
}
