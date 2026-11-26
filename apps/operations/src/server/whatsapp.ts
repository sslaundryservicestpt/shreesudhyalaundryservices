import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '@shree/domain';
import { z } from 'zod';
import { database } from './db';

const phone = z.string().regex(/^\d{8,15}$/);
const message = z.object({
  id: z.string().min(1).max(255),
  from: phone,
  text: z.object({ body: z.string() }).optional(),
});
const envelope = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            contacts: z
              .array(z.object({ wa_id: phone, profile: z.object({ name: z.string() }).optional() }))
              .optional(),
            messages: z.array(message).optional(),
          }),
        }),
      ),
    }),
  ),
});

export function webhookConfig() {
  if (process.env.WHATSAPP_WEBHOOK_ENABLED !== 'true') return null;
  const secret = process.env.WHATSAPP_APP_SECRET;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !token || !numberId) return null;
  return { secret, token, numberId };
}

export function constantEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function signedWebhookBody(request: Request, secret: string) {
  const signature = request.headers.get('x-hub-signature-256') ?? '';
  if (!/^sha256=[0-9a-f]{64}$/.test(signature))
    throw new DomainError('INVALID_SIGNATURE', 'Invalid webhook signature.', 403);
  const maxBytes = 256 * 1024;
  let count = 0;
  const bytes: Uint8Array[] = [];
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        throw new DomainError('PAYLOAD_TOO_LARGE', 'Webhook payload is too large.', 413);
      }
      bytes.push(value);
    }
  }
  const raw = Buffer.concat(bytes);
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  if (!constantEqual(signature, `sha256=${digest}`))
    throw new DomainError('INVALID_SIGNATURE', 'Invalid webhook signature.', 403);
  return raw;
}

function localPhone(value: string) {
  return value.replace(/^(?:91|0)(?=\d{10}$)/, '');
}

export async function captureWhatsApp(raw: Buffer, numberId: string) {
  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new DomainError('INVALID_JSON', 'Invalid webhook body.', 400);
  }
  const parsed = envelope.parse(body);
  const changes = parsed.entry
    .flatMap((entry) => entry.changes)
    .filter(
      (change) =>
        change.field === 'messages' && change.value.metadata?.phone_number_id === numberId,
    );
  for (const { value } of changes) {
    for (const entry of value.messages ?? []) {
      await database().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'whatsapp:' + entry.id},0))`;
        if (await tx.whatsAppInbound.findUnique({ where: { id: entry.id }, select: { id: true } }))
          return;
        const sender = localPhone(entry.from);
        const matches = await tx.$queryRaw<{ id: string }[]>`
          SELECT b.id FROM "Branch" b JOIN "Client" c ON c.id=b."clientId"
          WHERE NOT b.archived AND NOT c.archived
          AND ${sender} IN (
            regexp_replace(regexp_replace(b.phone, '[^0-9]', '', 'g'), '^(91|0)([0-9]{10})$', '\\2'),
            regexp_replace(regexp_replace(c.phone, '[^0-9]', '', 'g'), '^(91|0)([0-9]{10})$', '\\2')
          ) LIMIT 2`;
        const contact = value.contacts?.find((candidate) => candidate.wa_id === entry.from);
        const lead = await tx.crmLead.create({
          data: {
            source: 'WHATSAPP',
            phone: '+' + entry.from,
            contactName: contact?.profile?.name.trim().slice(0, 120) ?? '',
            branchId: matches.length === 1 ? matches[0].id : null,
            instructions: entry.text?.body.slice(0, 500) ?? '',
          },
        });
        await tx.whatsAppInbound.create({
          data: {
            id: entry.id,
            leadId: lead.id,
            payload: Uint8Array.from(raw),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
}

export async function purgeExpiredWhatsApp() {
  await database().whatsAppInbound.updateMany({
    where: { expiresAt: { lte: new Date() }, payload: { not: null } },
    data: { payload: null },
  });
}
