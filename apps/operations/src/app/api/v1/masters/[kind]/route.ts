import { masterKind, requireAdmin } from '@shree/domain';
import { principal } from '@/server/auth';
import { listMasters, saveMaster } from '@/server/masters';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const id = requestId();
  try {
    const actor = await principal();
    const kind = masterKind.parse((await context.params).kind);
    const filters = Object.fromEntries(new URL(request.url).searchParams);
    const result = await listMasters(actor, kind, filters);
    return json(result.rows, id, 200, result.meta);
  } catch (error) {
    return failure(error, id);
  }
}
export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  const id = requestId();
  try {
    verifyOrigin(request);
    const actor = await principal();
    requireAdmin(actor);
    const kind = masterKind.parse((await context.params).kind);
    const result = await saveMaster(
      actor,
      kind,
      await body(request),
      null,
      request.headers.get('idempotency-key') ?? '',
      id,
      kind === 'clients',
    );
    return json(result, id, 201);
  } catch (error) {
    return failure(error, id);
  }
}
