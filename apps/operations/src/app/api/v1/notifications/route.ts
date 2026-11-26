import { principal } from '@/server/auth';
import { failure, json, requestId } from '@/server/http';
import { workspaceNotifications } from '@/server/notifications';

export async function GET() {
  const id = requestId();
  try {
    return json(await workspaceNotifications(await principal()), id);
  } catch (error) {
    return failure(error, id);
  }
}
