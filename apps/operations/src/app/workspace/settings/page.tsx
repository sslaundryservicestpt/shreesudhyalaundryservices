import { pageActor } from '@/server/page-access';
import PermissionDenied from '@/components/PermissionDenied';
import Link from 'next/link';
import CommandForm from '@/components/CommandForm';
import { database } from '@/server/db';
export default async function Settings() {
  const actor = await pageActor();
  if (!actor.roles.includes('ADMIN')) return <PermissionDenied />;
  const delivery = (await database().businessPolicy.findUnique({ where: { id: 'delivery' } }))
    ?.value as { pod?: string; approved?: boolean; reason?: string } | undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE SETTINGS</p>
          <h1>Settings with clear ownership.</h1>
          <p>Review operational, identity and financial policies before use.</p>
          <Link className="button" href="/workspace/finance?section=policy">
            Configure business & finance policy
          </Link>
        </div>
      </div>
      <section className="surface panel-pad">
        <h2>Proof of delivery</h2>
        <p>
          Approve delivery evidence separately from financial rules. This policy takes precedence
          over the legacy POD setting in Finance. Recipient acknowledgement records a
          name/reference; it does not simulate OTP verification.
        </p>
        <CommandForm
          title="Save reviewed delivery policy"
          endpoint="/api/v1/finance"
          action="POD_POLICY"
          confirmation
          fields={[
            {
              name: 'pod',
              initial: delivery?.pod,
              label: 'Delivery acknowledgement method',
              type: 'select',
              options: [
                { value: 'BLOCKED', label: 'Block acknowledgement until review' },
                { value: 'RECIPIENT', label: 'Recipient name / acknowledgement reference' },
                { value: 'EVIDENCE', label: 'Recipient plus private attached evidence' },
              ],
            },
            {
              name: 'reason',
              initial: delivery?.reason,
              label: 'Owner approval reference / reason',
            },
            {
              name: 'approved',
              initial: delivery?.approved,
              label: 'Owner approved this proof-of-delivery policy',
              type: 'checkbox',
            },
          ]}
        />
      </section>
      <section className="surface">
        <dl className="record-details">
          <div>
            <dt>Public registration</dt>
            <dd>
              No application signup screen. Disable public signup separately in Supabase Auth
              settings.
            </dd>
          </div>
          <div>
            <dt>Identity provider</dt>
            <dd>Supabase Auth, verified on the server</dd>
          </div>
          <div>
            <dt>Master-data writes</dt>
            <dd>Admin only, transactional, versioned and audited</dd>
          </div>
          <div>
            <dt>Branch-user accounts</dt>
            <dd>Future module; no portal enabled</dd>
          </div>
          <div>
            <dt>Financial issuance</dt>
            <dd>
              Draft → approval → immutable issuance. Approved configuration and legal format are
              required.
            </dd>
          </div>
          <div>
            <dt>Automation</dt>
            <dd>
              Durable leased worker for scheduled drafts, PDF rendering and private CSV exports. Run
              it as a separate process.
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
