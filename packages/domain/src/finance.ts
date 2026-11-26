import { z } from 'zod';
import { DomainError, parseMinorUnits } from './index';
export const policyInput = z
  .object({
    approved: z.boolean(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    scale: z.number().int().min(0).max(3),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Choose an IANA timezone.'),
    taxMode: z.enum(['DISABLED', 'BPS']),
    taxBps: z.number().int().min(0).max(10000),
    pricingDate: z.enum(['COLLECTION', 'COMPLETION']),
    pod: z.enum(['BLOCKED', 'RECIPIENT', 'EVIDENCE']),
    legalName: z.string().trim().min(3).max(160),
    legalAddress: z.string().trim().min(5).max(600),
    registration: z.string().trim().max(200),
    prefix: z.string().regex(/^[A-Z0-9-]{1,15}$/),
    fallbackApproved: z.boolean(),
    rounding: z.literal('HALF_UP'),
    creditNoteFormatApproved: z.boolean(),
    invoiceFormatApproved: z.boolean(),
  })
  .strict()
  .refine((p) => p.taxMode !== 'DISABLED' || p.taxBps === 0, 'Disabled tax must have a zero rate.');
export type Policy = z.infer<typeof policyInput>;
export function approvedPolicy(raw: unknown): Policy {
  const result = policyInput.safeParse(raw);
  if (!result.success || !result.data.approved)
    throw new DomainError(
      'POLICY_REQUIRED',
      'An administrator must save approved currency, timezone, tax, pricing-date, numbering and proof-of-delivery settings.',
      409,
    );
  return result.data;
}
export type Rate = {
  id: string;
  branchId: string | null;
  clientId: string | null;
  clientManaged?: boolean;
  garmentId: string;
  serviceId: string;
  unit: string;
  currency: string;
  rate: bigint;
  startsAt: Date;
  endsAt: Date;
};
export function resolveRate(
  rates: Rate[],
  ctx: {
    branchId: string;
    clientId: string;
    garmentId: string;
    serviceId: string;
    unit: string;
    currency: string;
    date: Date;
    fallbackApproved: boolean;
  },
) {
  const matches = rates.filter(
    (r) =>
      r.garmentId === ctx.garmentId &&
      r.serviceId === ctx.serviceId &&
      r.unit === ctx.unit &&
      r.currency === ctx.currency &&
      r.startsAt <= ctx.date &&
      r.endsAt > ctx.date,
  );
  for (const tier of [
    matches.filter((r) => r.clientManaged && !r.branchId && r.clientId === ctx.clientId),
    matches.filter((r) => r.branchId === ctx.branchId),
    matches.filter((r) => !r.clientManaged && !r.branchId && r.clientId === ctx.clientId),
    ctx.fallbackApproved ? matches.filter((r) => !r.branchId && !r.clientId) : [],
  ]) {
    if (tier.length > 1)
      throw new DomainError('AMBIGUOUS_RATE', 'Overlapping rates block billing.', 409);
    if (tier.length) return tier[0];
  }
  throw new DomainError(
    'MISSING_RATE',
    'No approved effective rate matches this garment, service, unit, currency and pricing date.',
    409,
  );
}
export function roundDivide(n: bigint, d: bigint) {
  if (n < 0n || d <= 0n) throw new DomainError('INVALID_AMOUNT', 'Amounts must be non-negative.');
  return (n + d / 2n) / d;
}
export function lineAmount(quantity: number, rate: bigint) {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new DomainError('INVALID_QUANTITY', 'Invalid billable quantity.');
  return roundDivide(BigInt(quantity) * rate, 1000n);
}
export function taxAmount(subtotal: bigint, policy: Policy) {
  return policy.taxMode === 'DISABLED' ? 0n : roundDivide(subtotal * BigInt(policy.taxBps), 10000n);
}
export function money(value: string, scale: number) {
  const n = parseMinorUnits(value, scale);
  if (n <= 0n || n > 999_999_999_999_999n)
    throw new DomainError(
      'INVALID_AMOUNT',
      'Enter a positive amount within the supported limit.',
      422,
    );
  return n;
}
export function formatMoney(value: string | bigint, scale: number, currency: string) {
  const n = BigInt(value),
    s = n < 0n ? '-' : '',
    a = n < 0n ? -n : n,
    f = 10n ** BigInt(scale);
  return `${currency} ${s}${a / f}${scale ? '.' + (a % f).toString().padStart(scale, '0') : ''}`;
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
