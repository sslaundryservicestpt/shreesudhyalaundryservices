import { principal } from '@/server/auth';
import { changeWork, workDetail } from '@/server/work';
import { snapshot } from '@/server/commands';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId();
  try {
    return json(snapshot(await workDetail(await principal(), (await context.params).id)), id);
  } catch (e) {
    return failure(e, id);
  }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId();
  try {
    verifyOrigin(request);
    return json(
      await changeWork(
        await principal(),
        (await context.params).id,
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
