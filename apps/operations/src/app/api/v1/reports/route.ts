import { principal } from '@/server/auth';
import { database } from '@/server/db';
import { reportData, reportCsv, reportFilter, authorizeReport } from '@/server/reports';
import { failure, requestId, body, verifyOrigin, json } from '@/server/http';
import { command, audit } from '@/server/commands';
import { scopeTag } from '@/server/exports';
import { DomainError } from '@shree/domain';
import { randomUUID } from 'node:crypto';
export async function GET(request: Request) {
  const id = requestId();
  try {
    const actor = await principal(),
      r = await reportData(actor, Object.fromEntries(new URL(request.url).searchParams));
    await database().auditLog.create({
      data: {
        actorId: actor.id,
        action: 'CSV_EXPORT',
        resourceType: 'report',
        resourceId: randomUUID(),
        requestId: id,
        after: { kind: r.filter.kind, rows: r.rows.length, filters: r.filter },
      },
    });
    return new Response(reportCsv(r), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shree-${r.filter.kind}.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e, id);
  }
}
export async function POST(request: Request) {
  const correlation = requestId();
  try {
    verifyOrigin(request);
    const actor = await principal(),
      filter = reportFilter.parse(await body(request));
    const result = await command(
      actor,
      request.headers.get('idempotency-key') || '',
      correlation,
      'export',
      filter,
      async (tx, fresh) => {
        await reportData(fresh, filter);
        const id = randomUUID();
        await tx.outboxEvent.create({
          data: {
            id,
            topic: 'report.export',
            payload: { actorId: fresh.id, scopeTag: scopeTag(fresh), filter },
          },
        });
        await audit(tx, fresh, 'EXPORT_QUEUED', 'report', id, correlation, undefined, filter);
        return { id };
      },
      async (tx, fresh, previous) => {
        authorizeReport(fresh, filter.kind);
        if (previous) {
          const job = await tx.outboxEvent.findUnique({
            where: { id: String((previous as { id?: string }).id) },
          });
          const p = job?.payload as { actorId?: string; scopeTag?: string } | undefined;
          if (!p || p.actorId !== fresh.id || p.scopeTag !== scopeTag(fresh))
            throw new DomainError('NOT_FOUND', 'Export outside current access.', 404);
        }
      },
    );
    return json(result, correlation, 202);
  } catch (e) {
    return failure(e, correlation);
  }
}
