import { z } from 'zod';
export * from './workflow';
export * from './finance';
export const roles = ['ADMIN', 'SUPERVISOR', 'DELIVERY_EXECUTIVE', 'BRANCH_USER'] as const;
export type Role = (typeof roles)[number];
export type Principal = {
  id: string;
  active: boolean;
  roles: Role[];
  scopes: { clientId?: string | null; branchId?: string | null; unitId?: string | null }[];
};
export type ResourceScope = {
  clientId?: string | null;
  branchId?: string | null;
  unitId?: string | null;
};
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export function requireIdentity(actor: Principal | null): asserts actor is Principal {
  if (!actor) throw new DomainError('UNAUTHENTICATED', 'Please sign in to continue.', 401);
  if (!actor.active)
    throw new DomainError(
      'ACCOUNT_DISABLED',
      'Your account is disabled. Contact your administrator.',
      403,
    );
  if (!actor.roles.some((role) => ['ADMIN', 'SUPERVISOR', 'DELIVERY_EXECUTIVE'].includes(role)))
    throw new DomainError('ACCESS_NOT_ASSIGNED', 'No role has been assigned to your account.', 403);
}
export function requireAdmin(actor: Principal | null): asserts actor is Principal {
  requireIdentity(actor);
  if (!actor.roles.includes('ADMIN'))
    throw new DomainError('FORBIDDEN', 'Only an administrator can change master data.', 403);
}
export function canReadScope(actor: Principal | null, resource: ResourceScope): boolean {
  requireIdentity(actor);
  if (actor.roles.includes('ADMIN')) return true;
  if (!actor.roles.includes('SUPERVISOR')) return false;
  return actor.scopes.some(
    (scope) =>
      Boolean(scope.branchId && resource.branchId === scope.branchId) ||
      Boolean(scope.clientId && resource.clientId === scope.clientId) ||
      Boolean(scope.unitId && resource.unitId === scope.unitId),
  );
}
const text = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(250).optional().default('');
const email = z
  .union([z.email().max(254), z.literal('')])
  .optional()
  .default('');
export const masterKinds = ['clients', 'branches', 'units', 'garments', 'services'] as const;
export type MasterKind = (typeof masterKinds)[number];
export const masterKind = z.enum(masterKinds);
export const masterInput = z
  .object({
    name: text,
    contactName: optionalText,
    phone: z.string().trim().max(30).optional().default(''),
    email,
    address: z.string().trim().max(600).optional().default(''),
    clientId: z.uuid().optional(),
    unitId: z
      .union([z.uuid(), z.literal('')])
      .optional()
      .transform((value) => (value === '' ? null : value)),
    unit: z.enum(['PIECE', 'KG']).optional(),
    route: z.enum(['WASH_DRY_FOLD', 'WASH_DRY_IRON', 'IRON_ONLY']).optional(),
  })
  .strict();
export const updateInput = masterInput
  .partial()
  .extend({ version: z.number().int().positive(), archived: z.boolean().optional() })
  .strict();
export const paginationInput = z.object({
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  archived: z.enum(['true', 'false']).default('false'),
  sort: z.enum(['name', 'newest']).default('name'),
});
export function validateMaster(kind: MasterKind, raw: unknown, updating = false) {
  const parsed = updating ? updateInput.safeParse(raw) : masterInput.safeParse(raw);
  if (!parsed.success)
    throw new DomainError(
      'VALIDATION_ERROR',
      'Please check the highlighted fields.',
      422,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  const value = parsed.data;
  if (kind === 'branches' && !updating && !value.clientId)
    throw new DomainError('VALIDATION_ERROR', 'Choose a client for this branch.', 422, {
      clientId: ['A valid client is required.'],
    });
  const allowed = new Set([
    'name',
    'version',
    'archived',
    ...(kind === 'clients'
      ? ['contactName', 'phone', 'email']
      : kind === 'branches'
        ? ['clientId', 'unitId', 'contactName', 'phone', 'email', 'address']
        : kind === 'units'
          ? ['address']
          : kind === 'garments'
            ? ['unit']
            : ['route']),
  ]);
  const values = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) =>
        allowed.has(key) &&
        value[key as keyof typeof value] !== undefined &&
        (!updating ||
          (typeof raw === 'object' &&
            raw !== null &&
            Object.prototype.hasOwnProperty.call(raw, key))),
    ),
  );
  return values;
}
/** Authoritative amounts are integer minor units; no legal rounding/tax policy is assumed. */
export function parseMinorUnits(value: string, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6)
    throw new DomainError('INVALID_SCALE', 'Unsupported decimal precision.');
  if (value.length > 40)
    throw new DomainError('INVALID_MONEY', 'Amount exceeds the supported precision.');
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${scale || 1}})?$`).test(value) ||
    (scale === 0 && value.includes('.'))
  )
    throw new DomainError(
      'INVALID_MONEY',
      'Enter a non-negative amount at the configured precision.',
    );
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0');
}
