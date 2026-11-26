import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  DomainError,
  requireAdmin,
  requireIdentity,
  validateMaster,
  paginationInput,
  type MasterKind,
  type Principal,
} from '@shree/domain';
import { database } from './db';
import { audit } from './commands';
export type MasterRow = {
  id: string;
  name: string;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  unitId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  unit?: string;
  route?: string;
};
const tables = {
  clients: 'Client',
  branches: 'Branch',
  units: 'LaundryUnit',
  garments: 'GarmentType',
  services: 'ServiceCatalog',
} as const;
const table = (kind: MasterKind) => Prisma.raw(`"${tables[kind]}"`);
export function scopeWhere(actor: Principal, kind: MasterKind): Prisma.Sql {
  requireIdentity(actor);
  if (actor.roles.includes('ADMIN')) return Prisma.sql`TRUE`;
  if (!actor.roles.includes('SUPERVISOR'))
    throw new DomainError('FORBIDDEN', 'Your role has no access to these master records.', 403);
  if (!actor.scopes.length) return Prisma.sql`FALSE`;
  if (kind === 'garments' || kind === 'services') return Prisma.sql`TRUE`;
  const clauses: Prisma.Sql[] = [];
  for (const scope of actor.scopes) {
    if (kind === 'branches') {
      if (scope.branchId) clauses.push(Prisma.sql`m."id" = ${scope.branchId}::uuid`);
      if (scope.clientId) clauses.push(Prisma.sql`m."clientId" = ${scope.clientId}::uuid`);
      if (scope.unitId) clauses.push(Prisma.sql`m."unitId" = ${scope.unitId}::uuid`);
    } else if (kind === 'clients') {
      if (scope.clientId) clauses.push(Prisma.sql`m."id" = ${scope.clientId}::uuid`);
      if (scope.branchId)
        clauses.push(
          Prisma.sql`EXISTS(SELECT 1 FROM "Branch" b WHERE b."clientId"=m."id" AND b."id"=${scope.branchId}::uuid)`,
        );
      if (scope.unitId)
        clauses.push(
          Prisma.sql`EXISTS(SELECT 1 FROM "Branch" b WHERE b."clientId"=m."id" AND b."unitId"=${scope.unitId}::uuid)`,
        );
    } else {
      if (scope.unitId) clauses.push(Prisma.sql`m."id"=${scope.unitId}::uuid`);
      if (scope.branchId)
        clauses.push(
          Prisma.sql`EXISTS(SELECT 1 FROM "Branch" b WHERE b."unitId"=m."id" AND b."id"=${scope.branchId}::uuid)`,
        );
      if (scope.clientId)
        clauses.push(
          Prisma.sql`EXISTS(SELECT 1 FROM "Branch" b WHERE b."unitId"=m."id" AND b."clientId"=${scope.clientId}::uuid)`,
        );
    }
  }
  return clauses.length ? Prisma.sql`(${Prisma.join(clauses, ' OR ')})` : Prisma.sql`FALSE`;
}
export async function listMasters(
  actor: Principal,
  kind: MasterKind,
  search: Record<string, string | undefined>,
) {
  const parsed = paginationInput.safeParse(search);
  if (!parsed.success)
    throw new DomainError('INVALID_FILTER', 'Check your search and page filters.', 422);
  const { q, page, limit, archived, sort } = parsed.data;
  const client = kind === 'branches' && search.client ? z.uuid().safeParse(search.client) : null;
  if (client && !client.success)
    throw new DomainError('INVALID_FILTER', 'Choose a valid client.', 422);
  const clientFilter = client?.success
    ? Prisma.sql`AND m."clientId" = ${client.data}::uuid`
    : Prisma.empty;
  const condition = Prisma.sql`${scopeWhere(actor, kind)} AND m."archived"=${archived === 'true'} AND strpos(lower(m."name"), lower(${q})) > 0 ${clientFilter}`;
  const db = database();
  const rows = await db.$queryRaw<MasterRow[]>(
    Prisma.sql`SELECT m.* FROM ${table(kind)} m WHERE ${condition} ORDER BY ${sort === 'name' ? Prisma.sql`m."name" ASC` : Prisma.sql`m."createdAt" DESC`}, m."id" ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
  );
  const total = await db.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT count(*) FROM ${table(kind)} m WHERE ${condition}`,
  );
  return {
    rows,
    meta: {
      page,
      limit,
      total: Number(total[0].count),
      pages: Math.max(1, Math.ceil(Number(total[0].count) / limit)),
    },
  };
}
export async function getMaster(actor: Principal, kind: MasterKind, id: string) {
  const rows = await database().$queryRaw<MasterRow[]>(
    Prisma.sql`SELECT m.* FROM ${table(kind)} m WHERE m."id"=${id}::uuid AND ${scopeWhere(actor, kind)}`,
  );
  if (!rows[0])
    throw new DomainError(
      'NOT_FOUND',
      'This record is unavailable or outside your assigned scope.',
      404,
    );
  return rows[0];
}
const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

export async function ensureClientPickupSite(
  tx: Prisma.TransactionClient,
  client: Pick<MasterRow, 'id' | 'name' | 'contactName' | 'phone' | 'email'>,
  actor: Principal,
  requestId: string,
) {
  if (
    await tx.branch.findFirst({
      where: { clientId: client.id, OR: [{ archived: false }, { id: client.id }] },
      select: { id: true },
    })
  )
    return;
  const site = await tx.branch.create({
    data: {
      id: client.id,
      clientId: client.id,
      name: client.name,
      contactName: client.contactName,
      phone: client.phone,
      email: client.email,
    },
  });
  await audit(
    tx,
    actor,
    'CREATE_CLIENT_PICKUP_SITE',
    'branches',
    site.id,
    requestId,
    undefined,
    site,
  );
}

export async function saveMaster(
  actor: Principal,
  kind: MasterKind,
  raw: unknown,
  id: string | null,
  key: string,
  correlation: string,
  createClientSite = false,
) {
  requireAdmin(actor);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    throw new DomainError('IDEMPOTENCY_REQUIRED', 'A valid idempotency key is required.', 400);
  const input = validateMaster(kind, raw, Boolean(id));
  const hash = createHash('sha256').update(JSON.stringify({ kind, id, input })).digest('hex');
  const db = database();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "UserProfile" WHERE id=${actor.id}::uuid FOR SHARE`;
          const currentActor = await tx.userProfile.findUnique({
            where: { id: actor.id },
            include: { memberships: true },
          });
          if (!currentActor) throw new DomainError('UNAUTHENTICATED', 'Account not found.', 401);
          requireAdmin({
            ...actor,
            active: currentActor.active,
            roles: currentActor.memberships.map((item) => item.role),
          });
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${actor.id + ':' + key}, 0))`;
          const prior = await tx.idempotencyRecord.findUnique({
            where: { actorId_key: { actorId: actor.id, key } },
          });
          if (prior) {
            if (prior.requestHash !== hash)
              throw new DomainError(
                'IDEMPOTENCY_CONFLICT',
                'This request key was already used with different data.',
                409,
              );
            return prior.response;
          }
          let before: MasterRow | undefined;
          if (id) {
            const rows = await tx.$queryRaw<MasterRow[]>(
              Prisma.sql`SELECT * FROM ${table(kind)} WHERE "id"=${id}::uuid FOR UPDATE`,
            );
            before = rows[0];
            if (!before) throw new DomainError('NOT_FOUND', 'Record not found.', 404);
            if (before.version !== input.version)
              throw new DomainError(
                'VERSION_CONFLICT',
                'This record changed. Reload it before editing again.',
                409,
              );
          }
          const merged = { ...before, ...input };
          if (kind === 'branches') {
            const client = await tx.client.findUnique({ where: { id: String(merged.clientId) } });
            if (!client || client.archived)
              throw new DomainError('INVALID_RELATIONSHIP', 'Choose an active client.', 422, {
                clientId: ['Client is unavailable or archived.'],
              });
            if (merged.unitId) {
              const unit = await tx.laundryUnit.findUnique({
                where: { id: String(merged.unitId) },
              });
              if (!unit || unit.archived)
                throw new DomainError(
                  'INVALID_RELATIONSHIP',
                  'Choose an active laundry unit.',
                  422,
                );
            }
          }
          if (id && input.archived === true && (kind === 'clients' || kind === 'units')) {
            const count = await tx.branch.count({
              where:
                kind === 'clients'
                  ? { clientId: id, archived: false }
                  : { unitId: id, archived: false },
            });
            if (count)
              throw new DomainError(
                'ACTIVE_DEPENDENCIES',
                'Archive or reassign active branches first.',
                409,
              );
          }
          const values = Object.entries(input).filter(([name]) => name !== 'version');
          if (!values.length)
            throw new DomainError('VALIDATION_ERROR', 'Provide a field to change.', 422);
          const sqlValue = (name: string, value: unknown) =>
            value === null
              ? Prisma.sql`NULL`
              : name === 'clientId' || name === 'unitId'
                ? Prisma.sql`${String(value)}::uuid`
                : name === 'unit'
                  ? Prisma.sql`${String(value)}::"QuantityUnit"`
                  : name === 'route'
                    ? Prisma.sql`${String(value)}::"ServiceRoute"`
                    : Prisma.sql`${value}`;
          const recordId = id ?? randomUUID();
          const rows = id
            ? await tx.$queryRaw<MasterRow[]>(
                Prisma.sql`UPDATE ${table(kind)} SET ${Prisma.join(values.map(([name, value]) => Prisma.sql`${Prisma.raw('"' + name + '"')}=${sqlValue(name, value)}`))}, "version"="version"+1,"updatedAt"=now() WHERE "id"=${id}::uuid RETURNING *`,
              )
            : await tx.$queryRaw<MasterRow[]>(
                Prisma.sql`INSERT INTO ${table(kind)} (${Prisma.join([Prisma.raw('"id"'), ...values.map(([name]) => Prisma.raw('"' + name + '"')), Prisma.raw('"updatedAt"')])}) VALUES (${Prisma.join([Prisma.sql`${recordId}::uuid`, ...values.map(([name, value]) => sqlValue(name, value)), Prisma.sql`now()`])}) RETURNING *`,
              );
          const after = snapshot(rows[0]);
          if (kind === 'clients') {
            if (!id && createClientSite)
              await ensureClientPickupSite(tx, rows[0], actor, correlation);
            if (id && before && before.name !== rows[0].name) {
              const site = await tx.branch.findUnique({ where: { id } });
              if (site?.clientId === id && !site.archived) {
                const updated = await tx.branch.update({
                  where: { id },
                  data: { name: rows[0].name, version: { increment: 1 } },
                });
                await audit(
                  tx,
                  actor,
                  'RENAME_CLIENT_PICKUP_SITE',
                  'branches',
                  id,
                  correlation,
                  site,
                  updated,
                );
              }
            }
          }
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: id ? (input.archived === true ? 'ARCHIVE' : 'UPDATE') : 'CREATE',
              resourceType: kind,
              resourceId: recordId,
              requestId: correlation,
              ...(before ? { before: snapshot(before) } : {}),
              after,
            },
          });
          await tx.outboxEvent.create({
            data: {
              topic: 'master.changed',
              payload: { kind, id: recordId, version: rows[0].version, requestId: correlation },
            },
          });
          await tx.idempotencyRecord.create({
            data: { actorId: actor.id, key, requestHash: hash, response: after },
          });
          return after;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const prior = await db.idempotencyRecord.findUnique({
          where: { actorId_key: { actorId: actor.id, key } },
        });
        if (prior) {
          if (prior.requestHash !== hash)
            throw new DomainError(
              'IDEMPOTENCY_CONFLICT',
              'This request key was already used with different data.',
              409,
            );
          return prior.response;
        }
      }
      throw error;
    }
  }
  throw new DomainError('RETRY_REQUIRED', 'Please retry this command.', 409);
}
