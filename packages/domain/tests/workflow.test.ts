import { describe, it, expect } from 'vitest';
const randomUUID = () => crypto.randomUUID();
import {
  transition,
  emptyBalances,
  quantity,
  resolveRate,
  lineAmount,
  taxAmount,
  csvCell,
  policyInput,
  type WorkState,
} from '../src/index';
const lineId = randomUUID();
function initial(): WorkState {
  return {
    pickup: 'ARRIVED',
    custody: 'BRANCH',
    received: false,
    collectedAt: null,
    completedAt: null,
    batches: [],
    deliveries: [],
    lines: [
      {
        id: lineId,
        garmentId: randomUUID(),
        serviceId: randomUUID(),
        name: 'Shirts',
        service: 'Wash & fold',
        unit: 'PIECE',
        route: ['WASH', 'DRY', 'FOLD'],
        pickup: 0,
        inward: null,
        accepted: null,
        discrepancy: null,
        balances: emptyBalances(),
      },
    ],
  };
}
const context = () => ({
  id: randomUUID(),
  now: new Date().toISOString(),
  pod: 'RECIPIENT' as const,
});
describe('quantity workflow', () => {
  it('preserves 24 pickup and 25 inward observations; approval creates accepted stock once', () => {
    let s = transition(
      initial(),
      { action: 'COLLECT', counts: [{ lineId, quantity: 24000 }] },
      context(),
    ).state;
    s = transition(s, { action: 'RECEIVE' }, context()).state;
    s = transition(s, { action: 'VERIFY', lineId, quantity: 25000 }, context()).state;
    expect(s.lines[0].accepted).toBeNull();
    expect(s.lines[0].discrepancy).toBe('EXTRA_ITEMS');
    expect(() =>
      transition(
        s,
        {
          action: 'ALLOCATE',
          lineId,
          quantity: 1000,
          machine: 'Machine A',
          operator: 'Operator A',
        },
        context(),
      ),
    ).toThrow();
    s = transition(
      s,
      { action: 'RESOLVE', lineId, reason: 'Owner approved the extra shirt' },
      context(),
    ).state;
    expect(s.lines[0]).toMatchObject({ pickup: 24000, inward: 25000, accepted: 25000 });
    expect(s.lines[0].balances.AVAILABLE).toBe(25000);
    expect(() => transition(s, { action: 'VERIFY', lineId, quantity: 24000 }, context())).toThrow();
  });
  it('rejects duplicate pickup lines, fractional pieces and over-allocation', () => {
    expect(() =>
      transition(
        initial(),
        {
          action: 'COLLECT',
          counts: [
            { lineId, quantity: 1000 },
            { lineId, quantity: 1000 },
          ],
        },
        context(),
      ),
    ).toThrow();
    expect(() => quantity('1.5', 'PIECE')).toThrow();
    expect(quantity('1.125', 'KG')).toBe(1125);
    const s = initial();
    s.lines[0].accepted = 1000;
    s.lines[0].balances.AVAILABLE = 1000;
    expect(() =>
      transition(
        s,
        { action: 'ALLOCATE', lineId, quantity: 2000, machine: 'Machine', operator: 'Operator' },
        context(),
      ),
    ).toThrow();
  });
  it('cannot acknowledge without approved POD', () => {
    const s = initial(),
      deliveryId = randomUUID();
    s.lines[0].accepted = 1000;
    s.lines[0].balances.TRANSIT = 1000;
    s.deliveries = [
      {
        id: deliveryId,
        executiveId: randomUUID(),
        status: 'DISPATCHED',
        quantities: [{ lineId, quantity: 1000 }],
      },
    ];
    expect(() =>
      transition(
        s,
        {
          action: 'ACKNOWLEDGE',
          deliveryId,
          recipient: 'Recipient',
          reason: 'All received',
          quantities: [{ lineId, quantity: 1000 }],
        },
        { ...context(), pod: 'BLOCKED' },
      ),
    ).toThrow();
  });
  it('shows split custody for a partial acknowledgement and branch custody after complete delivery', () => {
    const s = initial(),
      deliveryId = randomUUID();
    s.received = true;
    s.lines[0].accepted = 2000;
    s.lines[0].balances.TRANSIT = 2000;
    s.deliveries = [
      {
        id: deliveryId,
        executiveId: randomUUID(),
        status: 'DISPATCHED',
        quantities: [{ lineId, quantity: 2000 }],
      },
    ];
    const base = {
      action: 'ACKNOWLEDGE' as const,
      deliveryId,
      recipient: 'Sample recipient',
      reason: 'Physically received and returned',
    };
    const failed = transition(
      s,
      { action: 'FAIL_DELIVERY', deliveryId, reason: 'Client unavailable' },
      context(),
    ).state;
    expect(failed.lines[0].balances.TRANSIT).toBe(2000);
    expect(failed.lines[0].balances.RELEASED).toBe(0);
    const receipt = {
      action: 'RECEIVE_RETURN' as const,
      deliveryId,
      reason: 'Counted both pieces at laundry',
    };
    const received = transition(failed, receipt, context()).state;
    expect(received.lines[0].balances.RELEASED).toBe(2000);
    expect(received.lines[0].balances.TRANSIT).toBe(0);
    expect(() => transition(received, receipt, context())).toThrow();
    expect(
      transition(s, { ...base, quantities: [{ lineId, quantity: 1000 }] }, context()).state.custody,
    ).toBe('MIXED');
    expect(
      transition(s, { ...base, quantities: [{ lineId, quantity: 2000 }] }, context()).state.custody,
    ).toBe('BRANCH');
  });
});
describe('exact financial rules', () => {
  const p = policyInput.parse({
    approved: true,
    currency: 'DEV',
    scale: 2,
    timezone: 'UTC',
    taxMode: 'DISABLED',
    taxBps: 0,
    pricingDate: 'COMPLETION',
    pod: 'RECIPIENT',
    legalName: 'Development fixture',
    legalAddress: 'Development fixture address',
    registration: '',
    prefix: 'DEV',
    fallbackApproved: false,
    rounding: 'HALF_UP',
    creditNoteFormatApproved: true,
    invoiceFormatApproved: true,
  });
  it('four orders × ten shirts resolves to 500.00 / 600.00 with explicitly disabled test tax', () => {
    expect(4n * lineAmount(10000, 1250n)).toBe(50000n);
    expect(4n * lineAmount(10000, 1500n)).toBe(60000n);
    expect(taxAmount(50000n, p)).toBe(0n);
  });
  it('selects branch before client and rejects missing or overlapping contracts', () => {
    const ctx = {
      branchId: 'branch',
      clientId: 'client',
      garmentId: 'garment',
      serviceId: 'service',
      unit: 'PIECE',
      currency: 'DEV',
      date: new Date('2026-11-15'),
      fallbackApproved: false,
    };
    const base = {
      ...ctx,
      startsAt: new Date('2026-11-01'),
      endsAt: new Date('2026-12-01'),
      rate: 1250n,
    };
    const branch = { ...base, id: 'branch-rate' },
      client = { ...base, id: 'client-rate', branchId: null, rate: 1500n };
    expect(resolveRate([client, branch], ctx).id).toBe('branch-rate');
    expect(() => resolveRate([], ctx)).toThrow();
    expect(() => resolveRate([branch, { ...branch, id: 'overlap' }], ctx)).toThrow();
  });
  it('neutralizes spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("bad")')).toContain("'=HYPERLINK");
    expect(csvCell('  +SUM(A1)')).toContain("'  +SUM");
    expect(csvCell('Normal, text')).toBe('"Normal, text"');
  });
});
