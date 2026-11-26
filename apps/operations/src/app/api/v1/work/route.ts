import { principal } from '@/server/auth';
import { listWork } from '@/server/work';
import { failure, json, requestId, verifyOrigin } from '@/server/http';
import { DomainError } from '@shree/domain';
import { snapshot } from '@/server/commands';
export async function GET(request: Request) {
  const id = requestId();
  try {
    return json(
      snapshot(
        await listWork(await principal(), Object.fromEntries(new URL(request.url).searchParams)),
      ),
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
    await principal();
    throw new DomainError(
      'USE_CRM_INTAKE',
      'Create and approve an enquiry through CRM before assigning a pickup.',
      410,
    );
  } catch (error) {
    return failure(error, id);
  }
}
