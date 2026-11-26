import {
  captureWhatsApp,
  constantEqual,
  signedWebhookBody,
  webhookConfig,
} from '@/server/whatsapp';
import { failure, requestId } from '@/server/http';

export async function GET(request: Request) {
  const config = webhookConfig();
  if (!config) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const challenge = query.get('hub.challenge');
  if (
    !challenge ||
    query.get('hub.mode') !== 'subscribe' ||
    !constantEqual(query.get('hub.verify_token') ?? '', config.token)
  )
    return new Response(null, { status: 403 });
  return new Response(challenge, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const config = webhookConfig();
  if (!config) return new Response(null, { status: 404 });
  try {
    await captureWhatsApp(await signedWebhookBody(request, config.secret), config.numberId);
    return new Response(null, { status: 200 });
  } catch (error) {
    return failure(error, requestId());
  }
}
