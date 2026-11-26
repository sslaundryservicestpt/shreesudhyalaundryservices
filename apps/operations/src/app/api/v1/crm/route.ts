import { principal } from '@/server/auth';
import { crmCommand } from '@/server/crm';
import { body, failure, json, requestId, verifyOrigin } from '@/server/http';

export async function POST(request: Request) {
  const id = requestId();
  try {
    verifyOrigin(request);
    return json(
      await crmCommand(
        await principal(),
        await body(request),
        request.headers.get('idempotency-key') || '',
        id,
      ),
      id,
    );
  } catch (error) {
    return failure(error, id);
  }
}
