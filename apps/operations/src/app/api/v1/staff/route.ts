import { requireAdmin } from '@shree/domain';
import { principal } from '@/server/auth';
import { staffCommand } from '@/server/staff';
import { body, json, failure, requestId, verifyOrigin } from '@/server/http';
export async function POST(request: Request) {
  const id = requestId();
  try {
    verifyOrigin(request);
    const actor = await principal();
    requireAdmin(actor);
    return json(
      await staffCommand(
        actor,
        await body(request),
        request.headers.get('idempotency-key') || '',
        id,
      ),
      id,
    );
  } catch (e) {
    return failure(e, id);
  }
}
