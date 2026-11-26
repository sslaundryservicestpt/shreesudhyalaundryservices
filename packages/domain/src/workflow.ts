import { z } from 'zod';
import { DomainError } from './index';

export const buckets = [
  'AVAILABLE',
  'PROCESSING',
  'QC',
  'REWORK',
  'PASSED',
  'RELEASED',
  'TRANSIT',
  'DELIVERED',
] as const;
export type Bucket = (typeof buckets)[number];
export type Line = {
  id: string;
  garmentId: string;
  serviceId: string;
  name: string;
  service: string;
  unit: 'PIECE' | 'KG';
  route: string[];
  pickup: number;
  inward: number | null;
  accepted: number | null;
  discrepancy: string | null;
  balances: Record<Bucket, number>;
};
export type Batch = {
  id: string;
  lineId: string;
  quantity: number;
  step: number;
  status: 'PROCESSING' | 'QC' | 'DONE';
  machine: string;
  operator: string;
};
export type Delivery = {
  id: string;
  executiveId: string;
  status: 'ASSIGNED' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'FAILED';
  quantities: { lineId: string; quantity: number }[];
  acknowledged?: { lineId: string; quantity: number }[];
  recipient?: string;
  reason?: string;
  evidenceId?: string;
  at?: string;
  routeLabel?: string;
  returnPending?: boolean;
  returnedAt?: string;
};
export type WorkState = {
  pickup: 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COLLECTED' | 'CANCELLED';
  custody: 'BRANCH' | 'EXECUTIVE' | 'LAUNDRY' | 'DELIVERY' | 'MIXED';
  received: boolean;
  collectedAt: string | null;
  completedAt: string | null;
  lines: Line[];
  batches: Batch[];
  deliveries: Delivery[];
  intake?: { source: 'PHONE' | 'WHATSAPP'; note: string };
};
export type Movement = {
  lineId: string;
  from: Bucket | 'EXTERNAL';
  to: Bucket;
  quantity: number;
  reference: string;
};
const qty = z.number().int().min(0).max(1_000_000_000);
const id = z.uuid();
const note = z.string().trim().min(3).max(500);
const counts = z
  .array(z.object({ lineId: id, quantity: qty }).strict())
  .min(1)
  .max(50);
export const workCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CANCEL_PICKUP'), reason: note }).strict(),
  z.object({ action: z.literal('REASSIGN_PICKUP'), executiveId: id, reason: note }).strict(),
  z.object({ action: z.literal('EN_ROUTE') }).strict(),
  z.object({ action: z.literal('ARRIVE') }).strict(),
  z
    .object({
      action: z.literal('COLLECT'),
      counts: z
        .array(z.object({ lineId: id, quantity: qty }))
        .min(1)
        .max(50),
    })
    .strict(),
  z.object({ action: z.literal('RECEIVE') }).strict(),
  z.object({ action: z.literal('VERIFY'), lineId: id, quantity: qty }).strict(),
  z.object({ action: z.literal('VERIFY_RECEIPT'), counts }).strict(),
  z
    .object({
      action: z.literal('VERIFY_AND_QUEUE'),
      executiveId: id,
      routeLabel: z.string().trim().max(60).optional(),
      counts,
    })
    .strict(),
  z.object({ action: z.literal('RESOLVE'), lineId: id, reason: note }).strict(),
  z
    .object({
      action: z.literal('ALLOCATE'),
      lineId: id,
      quantity: qty.positive(),
      machine: note,
      operator: note,
    })
    .strict(),
  z.object({ action: z.literal('ADVANCE'), batchId: id }).strict(),
  z
    .object({
      action: z.literal('QC'),
      batchId: id,
      passed: qty,
      fabricChecked: z.literal(true),
      exception: z.literal('yes').optional(),
      reason: z.string().trim().max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('REWORK'),
      lineId: id,
      quantity: qty.positive(),
      machine: note,
      operator: note,
    })
    .strict(),
  z.object({ action: z.literal('RELEASE'), lineId: id, quantity: qty.positive() }).strict(),
  z
    .object({
      action: z.literal('ASSIGN_DELIVERY'),
      executiveId: id,
      quantities: z
        .array(z.object({ lineId: id, quantity: qty.positive() }))
        .min(1)
        .max(50),
    })
    .strict(),
  z.object({ action: z.literal('DISPATCH'), deliveryId: id }).strict(),
  z
    .object({
      action: z.literal('ACKNOWLEDGE'),
      deliveryId: id,
      recipient: note,
      reason: note,
      evidenceId: id.optional(),
      quantities: z
        .array(z.object({ lineId: id, quantity: qty }))
        .min(1)
        .max(50),
    })
    .strict(),
  z.object({ action: z.literal('RECEIVE_RETURN'), deliveryId: id, reason: note }).strict(),
  z.object({ action: z.literal('FAIL_DELIVERY'), deliveryId: id, reason: note }).strict(),
]);
export type WorkCommand = z.infer<typeof workCommand>;
export function emptyBalances(): Record<Bucket, number> {
  return Object.fromEntries(buckets.map((b) => [b, 0])) as Record<Bucket, number>;
}
export function quantity(value: string, unit: 'PIECE' | 'KG') {
  if (!/^(0|[1-9]\d{0,6})(\.\d{1,3})?$/.test(value) || (unit === 'PIECE' && value.includes('.')))
    throw new DomainError(
      'INVALID_QUANTITY',
      'Use whole pieces or kilograms with up to three decimal places.',
      422,
    );
  const [a, b = ''] = value.split('.');
  const result = Number(a) * 1000 + Number(b.padEnd(3, '0'));
  if (result > 1_000_000_000)
    throw new DomainError('INVALID_QUANTITY', 'Quantity is too large.', 422);
  return result;
}
export function displayQuantity(q: number, unit: string) {
  return `${q / 1000} ${unit === 'PIECE' ? 'pcs' : 'kg'}`;
}
export function transition(
  original: WorkState,
  c: WorkCommand,
  context: { id: string; now: string; pod: 'BLOCKED' | 'RECIPIENT' | 'EVIDENCE' },
): { state: WorkState; movements: Movement[] } {
  const s = structuredClone(original),
    movements: Movement[] = [];
  const must = (ok: unknown, message: string) => {
    if (!ok) throw new DomainError('INVALID_TRANSITION', message, 409);
  };
  const line = (id: string) => {
    const l = s.lines.find((l) => l.id === id);
    must(l, 'Order line not found.');
    return l!;
  };
  const check = (l: Line, q: number) => {
    must(Number.isSafeInteger(q) && q >= 0 && q <= 1_000_000_000, 'Invalid quantity.');
    must(l.unit !== 'PIECE' || q % 1000 === 0, 'Piece quantities must be whole numbers.');
  };
  const move = (l: Line, from: Movement['from'], to: Bucket, q: number, reference = context.id) => {
    check(l, q);
    if (!q) return;
    if (from !== 'EXTERNAL') {
      must(l.balances[from] >= q, `Insufficient ${from.toLowerCase()} stock.`);
      l.balances[from] -= q;
    }
    l.balances[to] += q;
    movements.push({ lineId: l.id, from, to, quantity: q, reference });
  };
  const batch = (id: string) => {
    const b = s.batches.find((b) => b.id === id);
    must(b, 'Batch not found.');
    return b!;
  };
  const delivery = (id: string) => {
    const d = s.deliveries.find((d) => d.id === id);
    must(d, 'Delivery not found.');
    return d!;
  };
  const unique = (values: { lineId: string }[]) =>
    must(
      new Set(values.map((v) => v.lineId)).size === values.length,
      'Each order line must appear once.',
    );
  switch (c.action) {
    case 'CANCEL_PICKUP':
      must(
        s.pickup !== 'COLLECTED' && s.pickup !== 'CANCELLED',
        'Only uncollected pickups can be cancelled.',
      );
      s.pickup = 'CANCELLED';
      break;
    case 'REASSIGN_PICKUP':
      must(
        s.pickup !== 'COLLECTED' && s.pickup !== 'CANCELLED',
        'Only open pickups can be reassigned.',
      );
      s.pickup = 'ASSIGNED';
      break;
    case 'EN_ROUTE':
      must(s.pickup === 'ASSIGNED', 'Pickup must be assigned.');
      s.pickup = 'EN_ROUTE';
      break;
    case 'ARRIVE':
      must(s.pickup === 'EN_ROUTE', 'Start travel first.');
      s.pickup = 'ARRIVED';
      break;
    case 'COLLECT':
      must(s.pickup === 'ARRIVED', 'Confirm arrival first.');
      unique(c.counts);
      must(c.counts.length === s.lines.length, 'Count every order line.');
      for (const v of c.counts) {
        const l = line(v.lineId);
        check(l, v.quantity);
        l.pickup = v.quantity;
      }
      must(
        s.lines.some((l) => l.pickup > 0),
        'Collect at least one item.',
      );
      s.pickup = 'COLLECTED';
      s.collectedAt = context.now;
      s.custody = 'EXECUTIVE';
      break;
    case 'RECEIVE':
      must(s.pickup === 'COLLECTED' && !s.received, 'Collection must be received once.');
      s.received = true;
      s.custody = 'LAUNDRY';
      break;
    case 'VERIFY_RECEIPT':
    case 'VERIFY': {
      if (c.action === 'VERIFY_RECEIPT') {
        must(s.pickup === 'COLLECTED', 'Collection must arrive before verification.');
        const pending = s.lines.filter((l) => l.inward === null);
        unique(c.counts);
        must(c.counts.length === pending.length, 'Count each pending item before verifying.');
        s.received = true;
        s.custody = 'LAUNDRY';
      } else must(s.received, 'Receive custody before verifying.');
      const observed = c.action === 'VERIFY' ? [c] : c.counts;
      for (const item of observed) {
        const l = line(item.lineId);
        must(l.inward === null, 'Original inward observation cannot be replaced.');
        check(l, item.quantity);
        l.inward = item.quantity;
        if (l.pickup !== item.quantity)
          l.discrepancy = item.quantity > l.pickup ? 'EXTRA_ITEMS' : 'SHORT_ITEMS';
        else {
          l.accepted = item.quantity;
          move(l, 'EXTERNAL', 'AVAILABLE', item.quantity);
        }
      }
      break;
    }
    case 'RESOLVE': {
      const l = line(c.lineId);
      must(l.inward !== null && l.discrepancy && l.accepted === null, 'No unresolved discrepancy.');
      l.accepted = l.inward;
      l.discrepancy = null;
      move(l, 'EXTERNAL', 'AVAILABLE', l.accepted!);
      break;
    }
    case 'ALLOCATE':
    case 'REWORK': {
      const l = line(c.lineId);
      must(
        s.lines.every((l) => l.accepted !== null),
        'Resolve all inward observations before processing.',
      );
      move(l, c.action === 'REWORK' ? 'REWORK' : 'AVAILABLE', 'PROCESSING', c.quantity);
      s.batches.push({
        id: context.id,
        lineId: l.id,
        quantity: c.quantity,
        step: 0,
        status: 'PROCESSING',
        machine: c.machine,
        operator: c.operator,
      });
      break;
    }
    case 'ADVANCE': {
      const b = batch(c.batchId),
        l = line(b.lineId);
      must(b.status === 'PROCESSING', 'Batch is not processing.');
      b.step++;
      if (b.step >= l.route.length) {
        move(l, 'PROCESSING', 'QC', b.quantity, b.id);
        b.status = 'QC';
      }
      break;
    }
    case 'QC': {
      const b = batch(c.batchId),
        l = line(b.lineId);
      must(b.status === 'QC', 'Complete the service route before QC.');
      check(l, c.passed);
      must(c.passed <= b.quantity, 'Passed quantity exceeds batch quantity.');
      must(
        c.exception !== 'yes' || c.passed < b.quantity,
        'Exclude any missing or damaged items from the passed quantity to record an exception.',
      );
      must(
        c.passed === b.quantity || (c.reason?.length ?? 0) >= 3,
        'Record the count or fabric issue before holding pieces for rework.',
      );
      move(l, 'QC', 'PASSED', c.passed, b.id);
      move(l, 'QC', 'REWORK', b.quantity - c.passed, b.id);
      b.status = 'DONE';
      break;
    }
    case 'RELEASE': {
      const l = line(c.lineId);
      move(l, 'PASSED', 'RELEASED', c.quantity);
      break;
    }
    case 'VERIFY_AND_QUEUE': {
      must(
        s.received && s.lines.every((l) => l.accepted !== null && !l.discrepancy),
        'Resolve all inward counts first.',
      );
      must(
        !s.deliveries.some(
          (d) => d.status === 'ASSIGNED' || d.status === 'DISPATCHED' || d.returnPending,
        ),
        'Close the current delivery and confirm any returns first.',
      );
      unique(c.counts);
      const pending = s.lines.filter((l) => (l.accepted ?? 0) > l.balances.DELIVERED);
      must(
        pending.length > 0 && c.counts.length === pending.length,
        'Recount every item that is still due for delivery.',
      );
      for (const { lineId, quantity } of c.counts) {
        const l = line(lineId);
        check(l, quantity);
        const due = (l.accepted ?? 0) - l.balances.DELIVERED;
        must(
          due > 0 && due === l.balances.PASSED + l.balances.RELEASED,
          'Finish processing and quality checks before release.',
        );
        must(
          quantity === due,
          'The packed count must match the verified balance. Recount before queuing.',
        );
        move(l, 'PASSED', 'RELEASED', l.balances.PASSED);
      }
      s.deliveries.push({
        id: context.id,
        executiveId: c.executiveId,
        status: 'ASSIGNED',
        quantities: c.counts,
        ...(c.routeLabel ? { routeLabel: c.routeLabel } : {}),
      });
      break;
    }
    case 'ASSIGN_DELIVERY': {
      unique(c.quantities);
      must(
        !s.deliveries.some(
          (d) => d.status === 'ASSIGNED' || d.status === 'DISPATCHED' || d.returnPending,
        ),
        'Close the current delivery and confirm any returns first.',
      );
      for (const v of c.quantities) {
        const l = line(v.lineId);
        check(l, v.quantity);
        must(l.balances.RELEASED >= v.quantity, 'Delivery allocation exceeds released stock.');
      }
      s.deliveries.push({
        id: context.id,
        executiveId: c.executiveId,
        status: 'ASSIGNED',
        quantities: c.quantities,
      });
      break;
    }
    case 'DISPATCH': {
      const d = delivery(c.deliveryId);
      must(d.status === 'ASSIGNED', 'Delivery must be assigned.');
      for (const v of d.quantities) move(line(v.lineId), 'RELEASED', 'TRANSIT', v.quantity, d.id);
      d.status = 'DISPATCHED';
      s.custody = 'DELIVERY';
      break;
    }
    case 'ACKNOWLEDGE': {
      const d = delivery(c.deliveryId);
      must(d.status === 'DISPATCHED', 'Dispatch before acknowledgement.');
      must(context.pod !== 'BLOCKED', 'An administrator must approve a proof-of-delivery policy.');
      must(context.pod !== 'EVIDENCE' || c.evidenceId, 'Attach required proof of delivery.');
      unique(c.quantities);
      must(c.quantities.length === d.quantities.length, 'Acknowledge every allocated line.');
      for (const v of c.quantities) {
        const allocated = d.quantities.find((x) => x.lineId === v.lineId);
        must(allocated && v.quantity <= allocated.quantity, 'Acknowledgement exceeds allocation.');
        const l = line(v.lineId);
        move(l, 'TRANSIT', 'DELIVERED', v.quantity, d.id);
        if (allocated!.quantity > v.quantity) d.returnPending = true;
      }
      d.status = 'ACKNOWLEDGED';
      d.acknowledged = c.quantities;
      d.recipient = c.recipient;
      d.reason = c.reason;
      d.evidenceId = c.evidenceId;
      d.at = context.now;
      s.custody = 'LAUNDRY';
      break;
    }
    case 'FAIL_DELIVERY': {
      const d = delivery(c.deliveryId);
      must(d.status === 'DISPATCHED' || d.status === 'ASSIGNED', 'Delivery is already closed.');
      if (d.status === 'DISPATCHED') d.returnPending = true;
      d.status = 'FAILED';
      d.reason = c.reason;
      d.at = context.now;
      s.custody = 'LAUNDRY';
      break;
    }
    case 'RECEIVE_RETURN': {
      const d = delivery(c.deliveryId);
      must(d.returnPending, 'There is no return awaiting laundry receipt.');
      for (const v of d.quantities) {
        const accepted = d.acknowledged?.find((item) => item.lineId === v.lineId)?.quantity ?? 0;
        move(line(v.lineId), 'TRANSIT', 'RELEASED', v.quantity - accepted, d.id);
      }
      d.returnPending = false;
      d.returnedAt = context.now;
      break;
    }
  }
  for (const l of s.lines) {
    const total = buckets.reduce((n, b) => n + l.balances[b], 0);
    must(l.accepted === null ? total === 0 : total === l.accepted, 'Quantity conservation failed.');
  }
  if (s.received) {
    const transit = s.lines.some((l) => l.balances.TRANSIT > 0),
      delivered = s.lines.some((l) => l.balances.DELIVERED > 0),
      laundry = s.lines.some((l) =>
        ['AVAILABLE', 'PROCESSING', 'QC', 'REWORK', 'PASSED', 'RELEASED'].some(
          (b) => l.balances[b as Bucket] > 0,
        ),
      );
    s.custody =
      Number(transit) + Number(delivered) + Number(laundry) > 1
        ? 'MIXED'
        : transit
          ? 'DELIVERY'
          : delivered
            ? 'BRANCH'
            : 'LAUNDRY';
  }
  if (
    s.lines.length &&
    s.lines.every((l) => l.accepted !== null && l.balances.DELIVERED === l.accepted) &&
    s.lines.some((l) => (l.accepted || 0) > 0)
  )
    s.completedAt ||= context.now;
  return { state: s, movements };
}
export function queue(s: WorkState) {
  if (s.pickup === 'CANCELLED') return 'CANCELLED';
  if (s.completedAt) return 'COMPLETED';
  if (s.pickup !== 'COLLECTED') return 'PICKUP';
  if (s.deliveries.some((delivery) => delivery.returnPending)) return 'DELIVERY_EXCEPTION';
  if (!s.received) return 'RECEIVING';
  if (s.lines.some((l) => l.discrepancy)) return 'DISCREPANCY';
  if (s.lines.some((l) => l.inward === null)) return 'VERIFICATION';
  if (s.deliveries.some((d) => d.status === 'DISPATCHED')) return 'IN_TRANSIT';
  if (s.lines.some((l) => l.balances.REWORK)) return 'REWORK';
  if (s.lines.some((l) => l.balances.QC)) return 'QC';
  if (s.lines.some((l) => l.balances.PROCESSING || l.balances.AVAILABLE)) return 'PROCESSING';
  if (s.lines.some((l) => l.balances.PASSED)) return 'OUTWARD';
  const last = s.deliveries.at(-1);
  if (
    last?.status === 'FAILED' ||
    (last?.status === 'ACKNOWLEDGED' &&
      last.quantities.some(
        (v) => (last.acknowledged?.find((a) => a.lineId === v.lineId)?.quantity || 0) < v.quantity,
      ))
  )
    return 'DELIVERY_EXCEPTION';
  return 'DELIVERY';
}
