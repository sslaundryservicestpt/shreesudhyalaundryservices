import { z } from 'zod';
import { masterKind, requireAdmin } from '@shree/domain';
import { principal } from '@/server/auth';
import { getMaster, saveMaster } from '@/server/masters';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';
export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const correlation = requestId();
  try {
    const actor = await principal();
    const params = await context.params;
    return json(
      await getMaster(actor, masterKind.parse(params.kind), z.uuid().parse(params.id)),
      correlation,
    );
  } catch (error) {
    return failure(error, correlation);
  }
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const correlation = requestId();
  try {
    verifyOrigin(request);
    const actor = await principal();
    requireAdmin(actor);
    const params = await context.params;
    return json(
      await saveMaster(
        actor,
        masterKind.parse(params.kind),
        await body(request),
        z.uuid().parse(params.id),
        request.headers.get('idempotency-key') ?? '',
        correlation,
      ),
      correlation,
    );
  } catch (error) {
    return failure(error, correlation);
  }
}
