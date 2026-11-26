import { principal } from '@/server/auth';
import { requireAdmin } from '@shree/domain';
import { financeCommand, financeView } from '@/server/finance';
import { snapshot } from '@/server/commands';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';
export async function GET(request: Request) {
  const id = requestId();
  try {
    const actor = await principal();
    requireAdmin(actor);
    return json(
      snapshot(await financeView(actor, Object.fromEntries(new URL(request.url).searchParams))),
      id,
    );
  } catch (e) {
    return failure(e, id);
  }
}
export async function POST(request: Request) {
  const id = requestId();
  try {
    verifyOrigin(request);
    const actor = await principal();
    requireAdmin(actor);
    return json(
      await financeCommand(
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
