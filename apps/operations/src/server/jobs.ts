import 'server-only';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { formatMoney, displayQuantity, type Policy } from '@shree/domain';
import { database } from './db';
import { scopeTag } from './exports';
import { reportData, reportCsv } from './reports';
import { requireIdentity, DomainError } from '@shree/domain';

export async function renderInvoicePdf(invoice: {
  number: string | null;
  snapshot: Prisma.JsonValue;
  subtotal: bigint;
  tax: bigint;
  total: bigint;
  currency: string;
  dueAt: Date;
}) {
  const s = invoice.snapshot as unknown as {
    policy: Policy;
    branch: { name: string; address: string; client: string };
    lines: {
      orderNumber: string;
      garment: string;
      service: string;
      quantity: number;
      unit: string;
      rate: string;
      amount: string;
    }[];
    period: { start: string; end: string };
  };
  const doc = new PDFDocument({
      margin: 48,
      size: 'A4',
      font: path.join(process.cwd(), 'public/fonts/lato-regular.ttf'),
      info: { Title: `Invoice ${invoice.number}`, Author: s.policy.legalName },
    }),
    chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const m = (n: string | bigint) => formatMoney(n, s.policy.scale, invoice.currency);
  doc.fillColor('#103047').fontSize(20).text(s.policy.legalName);
  doc.fontSize(10).text(s.policy.legalAddress).text(s.policy.registration).moveDown();
  doc.fontSize(17).text(`INVOICE ${invoice.number}`);
  doc
    .fontSize(10)
    .text(`Bill to: ${s.branch.client} / ${s.branch.name}`)
    .text(s.branch.address)
    .text(`Period: ${s.period.start} to ${s.period.end} (exclusive)`)
    .text(`Due: ${invoice.dueAt.toISOString()}`)
    .moveDown();
  for (const l of s.lines) {
    if (doc.y > 690) doc.addPage();
    doc.fontSize(11).text(`Order SS-${l.orderNumber} | ${l.garment} | ${l.service}`);
    doc
      .fontSize(10)
      .text(`${displayQuantity(l.quantity, l.unit)} × ${m(l.rate)} = ${m(l.amount)}`)
      .moveDown(0.6);
  }
  if (doc.y > 650) doc.addPage();
  doc
    .moveDown()
    .fontSize(12)
    .text(`Subtotal: ${m(invoice.subtotal)}`)
    .text(`Tax (${s.policy.taxMode}, ${s.policy.taxBps} bps): ${m(invoice.tax)}`)
    .text(`Total: ${m(invoice.total)}`);
  doc
    .moveDown()
    .fontSize(9)
    .text(
      'Amounts rounded HALF_UP per line; tax rounded on the subtotal. This PDF is generated from the immutable issued invoice snapshot.',
    );
  doc.end();
  return result;
}
export async function runJob(targetId: string | null = null) {
  const token = randomUUID();
  const claimed = await database().$queryRaw<
    { id: string; topic: string; payload: Prisma.JsonValue; attempts: number }[]
  >`
  WITH candidate AS (SELECT id FROM "OutboxEvent" WHERE (${targetId}::uuid IS NULL OR id=${targetId}::uuid) AND (topic <> 'staff.invite' OR ${Boolean(process.env.STAFF_INVITES_ENABLED === 'true' && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.APP_URL)}::boolean) AND "processedAt" IS NULL AND "failedAt" IS NULL AND "availableAt"<=now() AND ("lockedUntil" IS NULL OR "lockedUntil"<now()) ORDER BY CASE WHEN topic='invoice.pdf' THEN 0 ELSE 1 END, "availableAt" FOR UPDATE SKIP LOCKED LIMIT 1)
  UPDATE "OutboxEvent" e SET "lockedUntil"=now()+interval '5 minutes',"leaseToken"=${token},attempts=attempts+1 FROM candidate c WHERE e.id=c.id RETURNING e.id,e.topic,e.payload,e.attempts`;
  const job = claimed[0];
  if (!job) return false;
  try {
    let pdf: Buffer | undefined,
      invoiceId: string | undefined,
      exportPayload: Prisma.InputJsonObject | undefined;
    if (job.topic === 'invoice.pdf') {
      invoiceId = String((job.payload as Record<string, unknown>).invoiceId);
      const i = await database().invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (i.status !== 'ISSUED') throw Error('INVOICE_NOT_ISSUED');
      if (!i.pdf) pdf = await renderInvoicePdf(i);
    } else if (job.topic === 'report.export') {
      const payload = job.payload as Record<string, unknown>;
      const profile = await database().userProfile.findUniqueOrThrow({
        where: { id: String(payload.actorId) },
        include: { memberships: true, scopes: true },
      });
      const actor = {
        id: profile.id,
        active: profile.active,
        roles: profile.memberships.map((m) => m.role),
        scopes: profile.scopes,
      };
      requireIdentity(actor);
      if (scopeTag(actor) !== payload.scopeTag) throw Error('SCOPE_CHANGED');
      const report = await reportData(actor, payload.filter as Record<string, string>),
        csv = reportCsv(report);
      if (Buffer.byteLength(csv) > 5 * 1024 * 1024) throw Error('EXPORT_TOO_LARGE');
      exportPayload = {
        ...payload,
        csv,
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      } as Prisma.InputJsonObject;
    } else if (job.topic === 'staff.invite') {
      const { processStaffInvite } = await import('./staff');
      await processStaffInvite(job.id);
    } else if (job.topic === 'billing.draft') {
      const payload = job.payload as Record<string, string>;
      const profile = await database().userProfile.findUniqueOrThrow({
        where: { id: payload.actorId },
        include: { memberships: true, scopes: true },
      });
      const { financeCommand } = await import('./finance');
      await financeCommand(
        {
          id: profile.id,
          active: profile.active,
          roles: profile.memberships.map((m) => m.role),
          scopes: profile.scopes,
        },
        {
          action: 'DRAFT',
          branchId: payload.branchId,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          dueAt: payload.dueAt,
        },
        payload.key,
        job.id,
      );
    } else if (!['master.changed', 'work.changed'].includes(job.topic))
      throw Error('UNSUPPORTED_JOB_TOPIC');
    await database().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OutboxEvent" WHERE id=${job.id}::uuid FOR UPDATE`;
      const current = await tx.outboxEvent.findUnique({ where: { id: job.id } });
      if (current?.leaseToken !== token || !current.lockedUntil || current.lockedUntil < new Date())
        return;
      if (pdf && invoiceId)
        await tx.invoice.update({ where: { id: invoiceId }, data: { pdf: new Uint8Array(pdf) } });
      await tx.outboxEvent.update({
        where: { id: job.id },
        data: {
          processedAt: new Date(),
          lockedUntil: null,
          leaseToken: null,
          lastError: null,
          ...(exportPayload ? { payload: exportPayload } : {}),
        },
      });
    });
  } catch (error) {
    const safe =
      error instanceof DomainError
        ? error.code
        : error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'RENDER_OR_DATABASE_FAILURE';
    await database().outboxEvent.updateMany({
      where: { id: job.id, leaseToken: token },
      data: {
        lockedUntil: null,
        leaseToken: null,
        lastError: safe,
        ...(job.attempts >= 5
          ? { failedAt: new Date() }
          : { availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000) }),
      },
    });
  }
  return true;
}
export async function purgeExpiredExports() {
  // Erase generated CSV bytes after their download window; retain job metadata.
  await database()
    .$executeRaw`UPDATE "OutboxEvent" SET payload=payload-'csv' WHERE topic='report.export' AND "processedAt" IS NOT NULL AND payload ? 'csv' AND (payload->>'expiresAt') < ${new Date().toISOString()}`;
}
