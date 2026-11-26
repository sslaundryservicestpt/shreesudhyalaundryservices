import type { WorkState } from '@shree/domain';

export const workQueueLabels = {
  PICKUP: 'Pickup requests',
  RECEIVING: 'Awaiting receipt',
  VERIFICATION: 'Count verification',
  DISCREPANCY: 'Count exceptions',
  PROCESSING: 'Processing',
  QC: 'Quality check',
  REWORK: 'Rework',
  OUTWARD: 'Final count & release',
  DELIVERY: 'Delivery queue',
  IN_TRANSIT: 'On delivery',
  DELIVERY_EXCEPTION: 'Delivery exceptions',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
} as const;

export const coordinatorQueues = [
  'PICKUP',
  'RECEIVING',
  'VERIFICATION',
  'DISCREPANCY',
  'PROCESSING',
  'QC',
  'REWORK',
  'OUTWARD',
  'DELIVERY',
  'IN_TRANSIT',
  'DELIVERY_EXCEPTION',
  'COMPLETED',
] as const;

export type AssignmentNotice = { key: string; orderId: string; message: string };

export function pendingAssignments(
  actorId: string,
  rows: { id: string; executiveId: string; branchName: string; state: unknown }[],
): AssignmentNotice[] {
  return rows.flatMap((row) => {
    const state = row.state as WorkState;
    const pickup =
      row.executiveId === actorId && state.pickup === 'ASSIGNED'
        ? [{ key: row.id + ':pickup', orderId: row.id, message: 'Pickup at ' + row.branchName }]
        : [];
    return pickup.concat(
      state.deliveries
        .filter((delivery) => delivery.executiveId === actorId && delivery.status === 'ASSIGNED')
        .map((delivery) => ({
          key: delivery.id,
          orderId: row.id,
          message: 'Delivery to ' + row.branchName,
        })),
    );
  });
}
