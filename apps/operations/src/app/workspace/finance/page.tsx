import { z } from 'zod';
import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { database } from '@/server/db';
import { branchRateCatalog, financeView, previewBillingCycle } from '@/server/finance';
import { displayQuantity, DomainError, formatMoney, type Policy } from '@shree/domain';
import CommandForm, { type Field } from '@/components/CommandForm';
import { PageHeader, Pagination } from '@/components/ui';
import RatePreview from '@/components/RatePreview';
import BranchRateSheet from '@/components/BranchRateSheet';
import BillingCyclePicker from '@/components/BillingCyclePicker';
import { PickupRegisterTable } from '@/components/InvoicePickupRegister';
import { billingMonth, pickupRegister } from '@/lib/pickup-register';
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await pageActor(),
    search = await searchParams,
    v = await financeView(actor, search),
    p = v.settings?.value as Policy | undefined;
  const sections = [
    'policy',
    'invoices',
    'cycles',
    'pricing',
    'receivables',
    'credits',
    'expenses',
    'losses',
    'jobs',
  ];
  const section = sections.includes(search.section || '') ? search.section! : 'invoices';
  const client = search.client
    ? await database().client.findUnique({
        where: { id: search.client },
        select: { id: true, name: true },
      })
    : null;
  const branch = z.uuid().safeParse(search.branch).success
    ? await database().branch.findUnique({
        where: { id: search.branch },
        select: { id: true, name: true, archived: true },
      })
    : null;
  const rateCatalog = section === 'pricing' && p?.approved ? await branchRateCatalog(actor) : null;
  const verified =
    section === 'receivables'
      ? new Set(
          (
            await database().auditLog.findMany({
              where: {
                resourceType: 'payment',
                action: 'VERIFY_PAYMENT',
                resourceId: { in: v.payments.map((item) => item.id) },
              },
              select: { resourceId: true },
            })
          ).map((row) => row.resourceId),
        )
      : new Set<string>();
  const incidents =
    section === 'losses'
      ? await database().auditLog.findMany({
          where: { resourceType: 'loss', action: 'RECORD_LOSS' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];
  const activeMonth = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const [currentYear, currentMonth] = activeMonth.split('-').map(Number);
  const previousMonth = new Date(Date.UTC(currentYear, currentMonth - 2, 1))
    .toISOString()
    .slice(0, 7);
  const period = billingMonth(search.month ?? previousMonth) ?? billingMonth(previousMonth)!;
  let cycleError = '';
  let preview: Awaited<ReturnType<typeof previewBillingCycle>> | undefined;
  if (section === 'cycles' && branch) {
    try {
      preview = await previewBillingCycle(actor, branch.id, period);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      cycleError = error.message;
    }
  }
  const register =
    preview &&
    pickupRegister({
      lines: preview.lines,
      calendarDays: period.days,
      timezone: preview.policy?.timezone ?? 'Asia/Kolkata',
      money: (n) => formatMoney(n, preview?.policy?.scale ?? 2, preview?.policy?.currency ?? 'INR'),
    });
  const cycleClosed = new Date(period.endsAt) <= new Date();
  const branchFilter = '/api/v1/masters/branches' + (client ? '?client=' + client.id : '');
  const select = (name: string, label: string, values: string[], initial?: string): Field => ({
    name,
    label,
    type: 'select',
    initial,
    options: values.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
  });
  const endpoint = '/api/v1/finance',
    money = (n: bigint, currency: string) => formatMoney(n, p?.scale ?? 2, currency);
  const form = (action: string, title: string, fields: Field[], description?: string) => (
    <CommandForm
      action={action}
      title={title}
      endpoint={endpoint}
      fields={fields}
      description={description}
      confirmation
    />
  );
  const configFields: Field[] = [
    { name: 'currency', label: 'Approved ISO currency (e.g. INR)', initial: p?.currency },
    {
      name: 'scale',
      label: 'Approved minor-unit decimal places (0–3)',
      type: 'number',
      initial: p?.scale ?? 2,
    },
    { name: 'timezone', label: 'Approved IANA timezone (e.g. Asia/Kolkata)', initial: p?.timezone },
    select('taxMode', 'Tax treatment', ['DISABLED', 'BPS'], p?.taxMode),
    {
      name: 'taxBps',
      label: 'Approved tax rate in basis points (100 = 1%)',
      type: 'number',
      initial: p?.taxBps ?? 0,
    },
    select('pricingDate', 'Contractual pricing date', ['COLLECTION', 'COMPLETION'], p?.pricingDate),
    select('pod', 'Proof-of-delivery policy', ['BLOCKED', 'RECIPIENT', 'EVIDENCE'], p?.pod),
    { name: 'legalName', label: 'Legal entity name', initial: p?.legalName },
    { name: 'legalAddress', label: 'Legal entity address', initial: p?.legalAddress },
    {
      name: 'registration',
      label: 'Tax / business registration details',
      initial: p?.registration,
      required: false,
    },
    {
      name: 'prefix',
      label: 'Approved continuous invoice prefix (A–Z, 0–9, hyphen)',
      initial: p?.prefix,
    },
    select('rounding', 'Rounding policy', ['HALF_UP'], p?.rounding),
    ...(
      ['fallbackApproved', 'invoiceFormatApproved', 'creditNoteFormatApproved', 'approved'] as const
    ).map((name) => ({
      name,
      label: {
        fallbackApproved: 'Allow explicitly configured fallback rates',
        invoiceFormatApproved: 'Owner/accountant approved invoice format and continuous numbering',
        creditNoteFormatApproved: 'Owner/accountant approved credit adjustment workflow',
        approved: 'Owner/accountant approved all settings above',
      }[name],
      type: 'checkbox' as const,
      initial: p?.[name] ?? false,
    })),
  ];
  return (
    <>
      <PageHeader
        eyebrow="FINANCE / CONTROLLED WORKSPACE"
        title={
          {
            policy: 'Business policy',
            invoices: 'Invoices',
            cycles: 'Pickup register & invoice review',
            pricing: 'Pricing',
            receivables: 'Payments & receivables',
            credits: 'Credit adjustments',
            expenses: 'Expenses',
            jobs: 'Background activity',
          }[section] || 'Finance'
        }
        description="Reviewed sources, exact amounts and traceable actions."
      />
      <nav className="section-tabs" aria-label="Finance sections">
        {sections.map((key) => (
          <Link
            key={key}
            className={key === section ? 'selected' : ''}
            aria-current={key === section ? 'page' : undefined}
            href={'/workspace/finance?section=' + key}
          >
            {
              {
                policy: 'Policy',
                invoices: 'Invoices',
                cycles: 'Pickup register',
                pricing: 'Pricing',
                receivables: 'Payments',
                credits: 'Credits',
                expenses: 'Expenses',
                losses: 'Loss & damage',
                jobs: 'Jobs',
              }[key]
            }
          </Link>
        ))}
      </nav>
      {['pricing', 'receivables', 'expenses', 'credits', 'jobs'].includes(section) && (
        <form className="filters">
          <input type="hidden" name="section" value={section} />
          {branch && <input type="hidden" name="branch" value={branch.id} />}
          <label>
            Search by name or reference
            <input name="q" defaultValue={search.q} maxLength={100} />
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={search.sort || 'newest'}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <button className="button secondary">Apply filters</button>
          <Link href={'?section=' + section}>Clear filters</Link>
        </form>
      )}
      {!p?.approved && (
        <div className="setup-banner">
          <strong>Financial actions are blocked until approved configuration is saved.</strong>
          <p>
            Tax, currency, pricing date and legal document settings are never inferred. The
            supported tax model is a single tax percentage added to the subtotal; complex
            jurisdictional tax rules need additional review.
          </p>
        </div>
      )}
      {section === 'policy' && (
        <details className="surface panel-pad" open={!p?.approved}>
          <summary>
            Business, finance and delivery policy · Version {v.settings?.version || 0}
          </summary>
          <CommandForm
            title="Save reviewed policy"
            endpoint={endpoint}
            mode="policy"
            version={v.settings?.version || 0}
            fields={configFields}
            confirmation
            description="Approve only rules agreed with the owner/accountant. Periods are entered as explicit instants and shown in UTC. Numbering is a continuous prefix sequence, not a fiscal-year reset. Proof of delivery uses recorded recipient acknowledgement, with an attachment if EVIDENCE is chosen; this does not verify an OTP."
          />
        </details>
      )}
      {section === 'invoices' && (
        <section className="surface panel-pad">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BILLING WORKSPACE</p>
              <h2>Invoices & draft reservations</h2>
            </div>
            <div className="form-actions">
              <Link className="button" href="/workspace/finance?section=cycles">
                Review pickups &amp; generate invoice
              </Link>
              <a className="text-link" href="/api/v1/reports?kind=invoices">
                Export invoice CSV
              </a>
            </div>
          </div>
          <form className="filters">
            <input type="hidden" name="section" value="invoices" />
            <label>
              Search document
              <input
                name="q"
                defaultValue={search.q}
                maxLength={100}
                placeholder="Invoice number"
              />
            </label>
            <label>
              Status
              <select name="status" defaultValue={search.status || 'ALL'}>
                {['ALL', 'DRAFT', 'APPROVED', 'ISSUED', 'CANCELLED'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="button secondary">Filter</button>
          </form>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Period UTC [start,end)</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {v.invoices.map((i) => {
                  const paid = i.receipts
                      .filter((a) => !a.payment.reversedAt)
                      .reduce((n, a) => n + a.amount, 0n),
                    credit = i.credits.reduce((n, c) => n + c.amount, 0n);
                  return (
                    <tr key={i.id}>
                      <td>{i.number || `Draft ${i.id.slice(0, 8)}`}</td>
                      <td>
                        <span className="pill">{i.status}</span>
                      </td>
                      <td>
                        {i.startsAt.toISOString().slice(0, 10)} →{' '}
                        {i.endsAt.toISOString().slice(0, 10)}
                      </td>
                      <td>{money(i.total, i.currency)}</td>
                      <td>
                        {i.status === 'ISSUED'
                          ? money(i.total - paid - credit, i.currency)
                          : 'Not posted'}
                      </td>
                      <td>
                        <Link className="text-link" href={`/workspace/finance/${i.id}`}>
                          Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!v.invoices.length && (
            <p className="empty-state">
              No matching invoices. Configure rates and complete an order before drafting.
            </p>
          )}
          <div className="pagination">
            <span>
              {v.total} invoices · Page {v.page}
            </span>
            {v.page > 1 && (
              <Link
                href={`?section=invoices${client ? '&client=' + client.id : ''}&q=${encodeURIComponent(search.q || '')}&status=${search.status || 'ALL'}&page=${v.page - 1}`}
              >
                Previous
              </Link>
            )}
            {v.page * 20 < v.total && (
              <Link
                href={`?section=invoices${client ? '&client=' + client.id : ''}&q=${encodeURIComponent(search.q || '')}&status=${search.status || 'ALL'}&page=${v.page + 1}`}
              >
                Next
              </Link>
            )}
          </div>
          <details>
            <summary>Prepare a billing cycle draft</summary>
            {form(
              'DRAFT',
              'Generate reconciled draft',
              [
                { name: 'branchId', label: 'Branch', lookup: branchFilter },
                {
                  name: 'startsAt',
                  label: 'Period start (local input converted to UTC)',
                  type: 'datetime-local',
                },
                { name: 'endsAt', label: 'Exclusive period end', type: 'datetime-local' },
                { name: 'dueAt', label: 'Payment due date', type: 'datetime-local' },
              ],
              'Only fully acknowledged orders whose completion falls in [start,end) are reserved. Missing/ambiguous rates block the whole draft. Exclusions and rate sources appear in its review.',
            )}
          </details>
        </section>
      )}
      {section === 'cycles' && (
        <section className="surface panel-pad invoice-pickup-register">
          <h2>Choose a branch and billing month</h2>
          <BillingCyclePicker
            key={(branch?.id ?? '') + period.month}
            branch={branch ?? undefined}
            month={period.month}
            lookup={branchFilter}
            clientId={client?.id}
          />
          {cycleError && (
            <p className="notice" role="alert">
              {cycleError}
            </p>
          )}
          {preview && register && (
            <>
              <div className="section-heading">
                <div>
                  <h3>
                    {preview.branch.name} · {period.month}
                  </h3>
                  <p>
                    Only delivered and reconciled orders completed in this billing month are
                    eligible. Columns show the actual pickup dates.
                  </p>
                </div>
                {register.rows.length > 0 && (
                  <a
                    className="button secondary"
                    href={
                      '/api/v1/finance/pickup-register?' +
                      new URLSearchParams({
                        branch: preview.branch.id,
                        month: period.month,
                        review: preview.reviewFingerprint,
                      })
                    }
                  >
                    Download pickup register (CSV)
                  </a>
                )}
              </div>
              <PickupRegisterTable register={register} />
              {!preview.policy && (
                <p className="notice">
                  Approve the finance policy to calculate amounts and generate an invoice.
                </p>
              )}
              {preview.unpriced.length > 0 && (
                <details className="notice">
                  <summary>Resolve item rates before generating an invoice</summary>
                  <ul>
                    {preview.unpriced.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </details>
              )}
              {!cycleClosed && (
                <p className="notice">
                  This billing month is still open. Review the register now and generate the draft
                  after the cycle closes.
                </p>
              )}
              {cycleClosed &&
                preview.policy &&
                preview.unpriced.length === 0 &&
                register.rows.length > 0 && (
                  <CommandForm
                    key={preview.reviewFingerprint}
                    action="CLOSE_CYCLE"
                    title="Generate invoice draft"
                    endpoint={endpoint}
                    confirmation
                    description="The draft uses the quantities and rates shown above. Review and approve the draft before issuing the invoice PDF."
                    fields={[
                      {
                        name: 'branchId',
                        label: 'Client branch',
                        type: 'hidden',
                        initial: preview.branch.id,
                      },
                      {
                        name: 'startsAt',
                        label: 'Period start',
                        type: 'hidden',
                        initial: period.startsAt,
                      },
                      {
                        name: 'endsAt',
                        label: 'Period end',
                        type: 'hidden',
                        initial: period.endsAt,
                      },
                      {
                        name: 'previewFingerprint',
                        label: 'Reviewed register',
                        type: 'hidden',
                        initial: preview.reviewFingerprint,
                      },
                      {
                        name: 'dueAt',
                        label: 'Payment due date (Tirupati time)',
                        type: 'datetime-local',
                        timeZoneOffset: '+05:30',
                      },
                    ]}
                  />
                )}
            </>
          )}
          {!branch && !cycleError && (
            <p className="muted">
              Select a client branch to see its pickup dates, item counts and billable amounts.
            </p>
          )}
          <details>
            <summary>Schedule a future draft</summary>
            {form('SCHEDULE_DRAFT', 'Schedule billing draft', [
              { name: 'branchId', label: 'Branch', lookup: branchFilter },
              { name: 'startsAt', label: 'Period start', type: 'datetime-local' },
              { name: 'endsAt', label: 'Exclusive period end', type: 'datetime-local' },
              { name: 'dueAt', label: 'Payment due date', type: 'datetime-local' },
              { name: 'runAt', label: 'Prepare draft at', type: 'datetime-local' },
            ])}
          </details>
        </section>
      )}
      {rateCatalog && (
        <BranchRateSheet
          key={branch?.id ?? 'select-branch'}
          branch={branch && !branch.archived ? branch : undefined}
          {...rateCatalog}
        />
      )}
      {section === 'pricing' && (
        <section className="surface panel-pad">
          <h2>Effective rates</h2>
          <details>
            <summary>Preview rate resolution</summary>
            <RatePreview />
          </details>
          <p>
            20 contracts per page. Rates cannot be edited retrospectively; use non-overlapping
            effective periods.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Garment / service reference</th>
                  <th>Effective UTC</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {v.rates.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.branchId
                        ? v.names[r.branchId] || 'Historical branch'
                        : r.clientId
                          ? v.names[r.clientId] || 'Historical client'
                          : 'Approved fallback'}
                    </td>
                    <td>
                      <Link href={`/workspace/masters/garments/${r.garmentId}`}>
                        {v.names[r.garmentId] || 'Historical garment'}
                      </Link>{' '}
                      /{' '}
                      <Link href={`/workspace/masters/services/${r.serviceId}`}>
                        {v.names[r.serviceId] || 'Historical service'}
                      </Link>
                    </td>
                    <td>
                      {r.startsAt.toISOString().slice(0, 10)} →{' '}
                      {r.endsAt.toISOString().slice(0, 10)}
                    </td>
                    <td>
                      {money(r.rate, r.currency)} / {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details open={Boolean(client || branch)}>
            <summary id="add-rate">Add an effective rate</summary>
            {form(
              'RATE',
              'Save rate contract',
              [
                {
                  name: 'branchId',
                  label: 'Branch-specific contract (leave client empty)',
                  initial: branch?.id,
                  lookup: '/api/v1/masters/branches',
                  required: false,
                },
                {
                  name: 'clientId',
                  label: 'Client default (leave branch empty)',
                  initial: branch ? undefined : client?.id,
                  lookup: '/api/v1/masters/clients',
                  required: false,
                },
                { name: 'garmentId', label: 'Garment', lookup: '/api/v1/masters/garments' },
                { name: 'serviceId', label: 'Service', lookup: '/api/v1/masters/services' },
                { name: 'rate', label: 'Rate per piece or kg, in configured currency units' },
                { name: 'startsAt', label: 'Effective from', type: 'datetime-local' },
                { name: 'endsAt', label: 'Exclusive effective end', type: 'datetime-local' },
              ],
              'Select one scope; neither means fallback and requires explicit approval.',
            )}
          </details>
        </section>
      )}
      {section === 'receivables' && (
        <section id="payments" className="surface panel-pad">
          <h2>Payments & available customer credit</h2>
          <p>
            20 receipts per page. Collections are separate from sales. Reversals preserve receipt
            and allocation history.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Reference / client</th>
                  <th>Received</th>
                  <th>Available credit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {v.payments.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.id.slice(0, 8)}
                      <br />
                      {r.reversedAt
                        ? 'REVERSED'
                        : verified.has(r.id)
                          ? 'VERIFIED'
                          : 'AWAITING VERIFICATION'}
                    </td>
                    <td>
                      {r.reference}
                      <br />
                      <Link href={`/workspace/masters/clients/${r.clientId}`}>
                        {v.names[r.clientId] || 'Historical client'}
                      </Link>
                    </td>
                    <td>{money(r.amount, r.currency)}</td>
                    <td>
                      {r.reversedAt
                        ? 'Reversed'
                        : money(
                            r.amount - r.allocations.reduce((n, a) => n + a.amount, 0n),
                            r.currency,
                          )}
                    </td>
                    <td>
                      {!r.reversedAt && !verified.has(r.id) && (
                        <details>
                          <summary>Verify funds credited</summary>
                          {form(
                            'VERIFY_PAYMENT',
                            'Verify payment receipt',
                            [
                              select('paymentId', 'Receipt', [r.id], r.id),
                              { name: 'reason', label: 'Bank confirmation or verification note' },
                            ],
                            'Use this only after confirming the funds were received.',
                          )}
                        </details>
                      )}
                      {!r.reversedAt && (
                        <details>
                          <summary>Reverse receipt</summary>
                          {form('REVERSE_PAYMENT', 'Confirm receipt reversal', [
                            select('paymentId', 'Receipt', [r.id], r.id),
                            { name: 'reason', label: 'Reversal reason' },
                          ])}
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Record a received payment</summary>
            {form(
              'PAYMENT',
              'Record receipt',
              [
                { name: 'clientId', label: 'Client', lookup: '/api/v1/masters/clients' },
                { name: 'amount', label: 'Amount received' },
                { name: 'reference', label: 'Bank / cash receipt reference' },
                { name: 'receivedAt', label: 'Received date and time', type: 'datetime-local' },
              ],
              'Records money already received; does not charge a customer or contact a payment provider.',
            )}
          </details>
        </section>
      )}
      {section === 'expenses' && (
        <section className="surface panel-pad">
          <h2>Expenses</h2>
          <p>20 expenses per page. Approval and payment recording are separate actions.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status / action</th>
                </tr>
              </thead>
              <tbody>
                {v.expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.category}</td>
                    <td>{e.description}</td>
                    <td>{money(e.amount, e.currency)}</td>
                    <td>
                      {e.status}
                      {e.status === 'SUBMITTED' && (
                        <details>
                          <summary>Review</summary>
                          {form('APPROVE_EXPENSE', 'Approve expense', [
                            select('expenseId', 'Expense', [e.id], e.id),
                          ])}
                          {form('REJECT_EXPENSE', 'Reject expense', [
                            select('expenseId', 'Expense', [e.id], e.id),
                          ])}
                        </details>
                      )}
                      {e.status === 'APPROVED' && (
                        <details>
                          <summary>Record paid</summary>
                          {form('PAY_EXPENSE', 'Confirm expense paid', [
                            select('expenseId', 'Expense', [e.id], e.id),
                          ])}
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Submit an expense</summary>
            {form('EXPENSE', 'Save expense', [
              { name: 'category', label: 'Category' },
              { name: 'description', label: 'Description / receipt reference' },
              { name: 'amount', label: 'Expense amount' },
              { name: 'incurredAt', label: 'Incurred date', type: 'datetime-local' },
            ])}
          </details>
        </section>
      )}
      {section === 'losses' && (
        <section className="surface panel-pad">
          <h2>Loss & damage register</h2>
          <p>
            Record an incident from its work order. This register keeps the original quantities and
            invoice history intact.
          </p>
          <Link className="button secondary" href="/workspace/work">
            Find a work order
          </Link>
          {incidents.length === 0 && <p>No incidents recorded.</p>}
          {incidents.map((entry) => {
            const data = entry.after as {
              garment: string;
              incident: string;
              quantity: number;
              unit: string;
              reason: string;
            } | null;
            return (
              data && (
                <article className="timeline-item" key={entry.id}>
                  <strong>
                    {data.garment} · {data.incident.toLowerCase()} ·{' '}
                    {displayQuantity(data.quantity, data.unit)}
                  </strong>
                  <p>{data.reason}</p>
                  <Link href={'/workspace/work/' + entry.resourceId}>Open work order</Link>
                </article>
              )
            );
          })}
        </section>
      )}
      {section === 'jobs' && (
        <section className="surface panel-pad">
          <h2>Background jobs</h2>
          <p>
            20 PDF, scheduled draft, staff invitation and export jobs per page. Run the operations
            worker. A retry keeps the same source command or issued invoice.
          </p>
          {v.jobs.map((j) => (
            <div className="timeline-item" key={j.id}>
              <strong>
                {j.topic} ·{' '}
                {j.processedAt
                  ? 'Completed'
                  : j.failedAt
                    ? 'Failed — review and retry from invoice'
                    : j.lockedUntil && j.lockedUntil > new Date()
                      ? 'Leased'
                      : 'Pending'}
              </strong>
              <small>
                {j.attempts} attempts · {j.createdAt.toISOString()}
              </small>
              {j.lastError && <p>{j.lastError}</p>}
              {j.failedAt &&
                form('RETRY_JOB', 'Retry reviewed job', [
                  {
                    name: 'jobId',
                    label: 'Job',
                    type: 'select',
                    options: [{ value: j.id, label: j.topic + ' ' + j.id.slice(0, 8) }],
                  },
                ])}
            </div>
          ))}
        </section>
      )}
      {section === 'credits' && (
        <section className="surface panel-pad">
          <h2>Posted credit adjustments</h2>
          <p>
            20 per page. Create a reviewed adjustment from its issued invoice; existing legal-format
            approval remains required.
          </p>
          {!v.credits.length && <p className="empty-state">No posted adjustments.</p>}
          {v.credits.map((c) => (
            <div key={c.id} className="timeline-item">
              <Link href={'/workspace/finance/' + c.invoiceId}>
                {c.invoice.number || 'Invoice'}
              </Link>
              <strong>{money(c.amount, c.invoice.currency)}</strong>
              <p>{c.reason}</p>
              <small>{c.createdAt.toISOString()}</small>
            </div>
          ))}
        </section>
      )}
      {['pricing', 'receivables', 'expenses', 'credits', 'jobs'].includes(section) && (
        <Pagination
          page={v.page}
          total={v.sectionTotal}
          limit={20}
          href={(page) =>
            '?' +
            new URLSearchParams({
              section,
              q: search.q || '',
              sort: search.sort || 'newest',
              page: String(page),
            })
          }
        />
      )}
    </>
  );
}
