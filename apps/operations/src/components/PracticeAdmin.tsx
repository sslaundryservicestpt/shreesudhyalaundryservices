'use client';

import {
  BadgeIndianRupee,
  Building2,
  ClipboardList,
  FileCheck2,
  Receipt,
  Wallet,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { needsPracticeReview, particulars, usePracticePickups } from './PracticeHandoff';
import AdminKpiCard from './AdminKpiCard';
import NotificationPanel from './NotificationPanel';
import { PickupRegisterTable } from './InvoicePickupRegister';
import {
  billingMonth,
  pickupRegister,
  pickupRegisterCsv,
  type PickupRegisterLine,
} from '@/lib/pickup-register';
import ClientPriceTable from './ClientPriceTable';
import { isSbhsClient, sbhsClientName, sbhsRates } from '@/lib/sbhs-rates';

type Client = {
  id: string;
  name: string;
  rates?: Record<string, number>;
  stainRates?: Record<string, number>;
  branches: {
    id: string;
    name: string;
    rates: Record<string, number>;
    stainRates?: Record<string, number>;
  }[];
};
type Bill = {
  id: string;
  branchId: string;
  branch: string;
  month: string;
  days: string[];
  pickups: number;
  lines: { item: string; counts: number[]; amount: number }[];
  total: number;
  verified?: string;
};
type Entry = { id: string; name: string; detail: string; clientId?: string };
type Store = { clients: Client[]; bills: Bill[]; expenses: Entry[]; losses: Entry[] };
type View = 'clients' | 'pricing' | 'billing' | 'payments' | 'expenses' | 'losses';

// Start the new practice workspace without reusing the retired client data.
const key = 'shree-admin-practice-v2';
const initial: Store = {
  clients: [
    {
      id: 'sbhs-home-stays',
      name: sbhsClientName,
      branches: [],
      rates: Object.fromEntries(sbhsRates.map(([item, standard]) => [item, standard * 100])),
      stainRates: Object.fromEntries(sbhsRates.map(([item, , stain]) => [item, stain * 100])),
    },
  ],
  bills: [],
  expenses: [],
  losses: [],
};
const currency = (paise: number) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const localDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function preparePracticeBill(
  pickups: ReturnType<typeof usePracticePickups>,
  client: Client,
  month: string,
) {
  const records = pickups.filter(
    (row) =>
      row.stage === 'DELIVERED' &&
      [client.name, ...client.branches.map((site) => site.name)].some(
        (name) => row.site.toLowerCase() === name.toLowerCase(),
      ) &&
      row.collectedAt &&
      localDay.format(row.collectedAt).startsWith(month) &&
      row.counts?.every((count, i) => count === row.inward?.[i]),
  );
  const days = [...new Set(records.map((row) => localDay.format(row.collectedAt)))].sort();
  const registerLines: PickupRegisterLine[] = [];
  const missingPrices = new Set<string>();
  const lines = particulars.flatMap((item, index) => {
    const quantities = new Map<string, number>();
    let amount = 0;
    for (const row of records) {
      const count = row.inward?.[index] ?? 0;
      if (!count) continue;
      const date = localDay.format(row.collectedAt);
      const rate =
        client.rates?.[item] ?? client.branches.find((site) => site.name === row.site)?.rates[item];
      quantities.set(date, (quantities.get(date) ?? 0) + count);
      if (rate === undefined) missingPrices.add(item);
      else amount += count * rate;
      registerLines.push({
        orderId: row.id,
        collectedAt: new Date(row.collectedAt!).toISOString(),
        garment: item,
        service: 'Standard',
        quantity: count * 1000,
        unit: 'PIECE',
        amount: rate === undefined ? null : String(count * rate),
      });
    }
    return quantities.size > 0
      ? [{ item, counts: days.map((day) => quantities.get(day) ?? 0), amount }]
      : [];
  });
  return {
    days,
    pickups: records.length,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    registerLines,
    missingPrices,
  };
}

function downloadRegister(csv: string, month: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pickup-register-' + month + '.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function read() {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function subscribe(update: () => void) {
  window.addEventListener(key, update);
  window.addEventListener('storage', update);
  return () => {
    window.removeEventListener(key, update);
    window.removeEventListener('storage', update);
  };
}
function minor(value: string) {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return NaN;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function useAdminStore() {
  const snapshot = useSyncExternalStore(subscribe, read, () => '');
  useEffect(() => {
    if (read()) return;
    try {
      const previous = localStorage.getItem('shree-admin-practice-v1');
      let expenses: Entry[] = [];
      try {
        const entries = previous ? JSON.parse(previous).expenses : [];
        if (Array.isArray(entries)) expenses = entries;
      } catch {
        // Unreadable old practice data cannot be carried forward.
      }
      localStorage.setItem(key, JSON.stringify({ ...initial, expenses }));
      window.dispatchEvent(new Event(key));
    } catch {
      // The starting catalogue remains visible when browser storage is unavailable.
    }
  }, []);
  try {
    return { snapshot, store: (snapshot ? JSON.parse(snapshot) : initial) as Store };
  } catch {
    return { snapshot, store: initial };
  }
}

export function PracticeAssignmentSites() {
  const { store } = useAdminStore();
  return (
    <select name="site" required defaultValue="">
      <option value="">Choose a client</option>
      {store.clients.map((client) => (
        <option key={client.id} value={client.name}>
          {client.name}
        </option>
      ))}
    </select>
  );
}

export function PracticeAdminMetrics() {
  const { store } = useAdminStore();
  const pickups = usePracticePickups();
  const metrics = [
    {
      view: 'clients',
      label: 'Clients',
      value: store.clients.length,
      action: 'Manage clients and prices',
      icon: Building2,
    },
    {
      view: 'handoffs',
      label: 'Handoffs to review',
      value: pickups.filter(needsPracticeReview).length,
      action: 'Review handoffs',
      icon: ClipboardList,
      tone: 'gold',
    },
    {
      view: 'billing',
      label: 'Monthly bills',
      value: store.bills.length,
      action: 'Open billing',
      icon: FileCheck2,
    },
    {
      view: 'payments#payment-receipts',
      label: 'Bills awaiting payment verification',
      value: store.bills.filter((bill) => !bill.verified).length,
      action: 'Review payments',
      icon: Receipt,
      tone: 'gold',
    },
    {
      view: 'payments#confirmed-sales',
      label: 'Payment-confirmed sales',
      value: currency(store.bills.reduce((sum, bill) => sum + (bill.verified ? bill.total : 0), 0)),
      action: 'View verified payments',
      icon: BadgeIndianRupee,
      tone: 'green',
    },
    {
      view: 'expenses',
      label: 'Recorded expenses',
      value: store.expenses.length,
      action: 'Open expense register',
      icon: Wallet,
    },
  ] as const;
  return metrics.map(({ view, ...metric }) => (
    <AdminKpiCard key={metric.label} {...metric} href={'/demo?role=admin&view=' + view} />
  ));
}

export function PracticeAdminNotifications() {
  const { store } = useAdminStore();
  const pickups = usePracticePickups();
  return (
    <NotificationPanel
      items={[
        {
          label: 'Handoffs to review',
          href: '/demo?role=admin&view=handoffs',
          count: pickups.filter(needsPracticeReview).length,
        },
        {
          label: 'Bills awaiting payment verification',
          href: '/demo?role=admin&view=payments#payment-receipts',
          count: store.bills.filter((bill) => !bill.verified).length,
        },
      ].filter((item) => item.count > 0)}
    />
  );
}

export default function PracticeAdmin({ view }: { view: View }) {
  const { snapshot, store } = useAdminStore();
  const pickups = usePracticePickups();
  const [message, setMessage] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [billingClientId, setBillingClientId] = useState('');
  const [month, setMonth] = useState(() => localDay.format(new Date()).slice(0, 7));
  const clientToPrice =
    store.clients.find((client) => client.id === selectedClient) ?? store.clients[0];
  const billingClient = store.clients.find((client) => client.id === billingClientId);
  const period = billingMonth(month);
  const billPreview =
    billingClient && period ? preparePracticeBill(pickups, billingClient, month) : undefined;
  const register =
    billPreview &&
    period &&
    pickupRegister({
      lines: billPreview.registerLines,
      calendarDays: period.days,
      timezone: 'Asia/Kolkata',
      money: (amount) => currency(Number(amount)),
    });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    if (snapshot !== read()) {
      setMessage('The workspace changed. Review the latest records and try again.');
      return;
    }
    try {
      const next = structuredClone(store);
      const id = crypto.randomUUID();
      const client = next.clients.find((row) => row.id === value('client'));
      switch (value('action')) {
        case 'client':
          if (!value('name')) throw Error('Enter the client name.');
          if (next.clients.some((row) => row.name.toLowerCase() === value('name').toLowerCase()))
            throw Error('This client is already listed.');
          next.clients.push({ id, name: value('name'), branches: [] });
          setSelectedClient(id);
          break;
        case 'rate': {
          if (!client) throw Error('Choose a client.');
          const entered = particulars.flatMap((item, index) =>
            ['rates', 'stainRates'].flatMap((service) => {
              const raw = value(service + ':' + index);
              return raw
                ? [{ item, service: service as 'rates' | 'stainRates', price: minor(raw) }]
                : [];
            }),
          );
          if (
            !entered.length ||
            entered.some((entry) => !Number.isSafeInteger(entry.price) || entry.price <= 0)
          )
            throw Error(
              'Enter positive prices with up to three digits before the decimal and two after it.',
            );
          for (const entry of entered) {
            const prices = (client[entry.service] ??= {});
            prices[entry.item] = entry.price;
          }
          break;
        }
        case 'bill': {
          const month = value('month');
          if (!client || !/^20\d\d-(0[1-9]|1[0-2])$/.test(month))
            throw Error('Choose a client and month.');
          if (
            next.bills.some(
              (bill) =>
                (bill.branchId === client.id ||
                  client.branches.some((site) => site.id === bill.branchId)) &&
                bill.month === month,
            )
          )
            throw Error('A bill already exists for this client and month.');
          const draft = preparePracticeBill(pickups, client, month);
          if (!draft.pickups || !draft.lines.length)
            throw Error(
              'No delivered orders with matching inward counts for this client and month.',
            );
          if (draft.missingPrices.size)
            throw Error(
              'Set the client price for ' +
                [...draft.missingPrices].join(', ') +
                ' before generating the bill.',
            );
          next.bills.push({
            id,
            branchId: client.id,
            branch: client.name,
            month,
            days: draft.days,
            pickups: draft.pickups,
            lines: draft.lines,
            total: draft.total,
          });
          break;
        }
        case 'verify': {
          const bill = next.bills.find((row) => row.id === value('bill'));
          if (!bill || bill.verified || !value('reference'))
            throw Error('Choose an unpaid bill and enter the payment reference.');
          bill.verified = value('reference');
          break;
        }
        case 'expense': {
          const amount = minor(value('amount'));
          if (!value('name') || !Number.isSafeInteger(amount) || amount <= 0)
            throw Error('Enter an expense name and positive amount.');
          next.expenses.push({ id, name: value('name'), detail: currency(amount) });
          break;
        }
        case 'loss':
          if (!client || !value('detail'))
            throw Error('Choose a client and describe the incident.');
          next.losses.push({
            id,
            clientId: client.id,
            name: client.name + ' · ' + value('item'),
            detail: value('detail'),
          });
          break;
        default:
          return;
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(key));
      form.reset();
      setMessage('Saved in this browser.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.');
    }
  }

  const clientSelect = (
    <label>
      Client
      <select name="client" required defaultValue="">
        <option value="">Choose a client</option>
        {store.clients.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
  const itemSelect = (
    <label>
      Particular
      <select name="item">
        {particulars.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
  const submit = (action: string, label: string) => (
    <>
      <input type="hidden" name="action" value={action} />
      <button className="button">{label}</button>
    </>
  );

  return (
    <section className="surface panel-pad practice-handoff">
      {view === 'clients' && (
        <>
          <form className="command-form" onSubmit={save}>
            <h3>Add a client</h3>
            <label>
              Client name
              <input name="name" maxLength={120} required />
            </label>
            {submit('client', 'Save client')}
          </form>
        </>
      )}
      {(view === 'clients' || view === 'pricing') && clientToPrice && (
        <section id="client-rates" className="surface panel-pad">
          <h2>Item prices</h2>
          <label>
            Client
            <select
              value={clientToPrice.id}
              onChange={(event) => setSelectedClient(event.target.value)}
            >
              {store.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <form className="command-form" onSubmit={save} key={clientToPrice.id}>
            <input type="hidden" name="client" value={clientToPrice.id} />
            <p>Prices are per piece (₹). Enter up to three digits before the decimal.</p>
            <ClientPriceTable
              rows={sbhsRates.map(([item, standard, stain], index) => {
                const cell = (service: 'rates' | 'stainRates', reference: number) => {
                  const saved = clientToPrice[service]?.[item];
                  return {
                    name: service + ':' + index,
                    reference,
                    value:
                      saved !== undefined
                        ? (saved / 100).toFixed(2)
                        : isSbhsClient(clientToPrice.name)
                          ? String(reference)
                          : undefined,
                  };
                };
                return {
                  id: item,
                  item,
                  cells: [cell('rates', standard), cell('stainRates', stain)],
                };
              })}
            />
            {submit('rate', 'Save client prices')}
          </form>
        </section>
      )}
      {view === 'billing' && (
        <>
          <p>Enter client prices before billing delivered orders.</p>
          <form className="command-form" onSubmit={save}>
            <div className="billing-cycle-picker">
              <label>
                Client
                <select
                  name="client"
                  required
                  value={billingClientId}
                  onChange={(event) => setBillingClientId(event.target.value)}
                >
                  <option value="">Choose a client</option>
                  {store.clients.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Billing month
                <input
                  name="month"
                  type="month"
                  required
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </label>
            </div>
            {billingClient && register && (
              <section className="invoice-pickup-register">
                <div className="section-heading">
                  <h3>{billingClient.name} · Pickup register</h3>
                  {register.rows.length > 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        downloadRegister(
                          pickupRegisterCsv(billingClient.name + ' · ' + month, register),
                          month,
                        )
                      }
                    >
                      Download pickup register (CSV)
                    </button>
                  )}
                </div>
                <PickupRegisterTable register={register} />
                {Boolean(billPreview?.missingPrices.size) && (
                  <p className="notice">
                    Set prices before generating the bill for{' '}
                    {[...billPreview!.missingPrices].join(', ')}.
                  </p>
                )}
              </section>
            )}
            <input type="hidden" name="action" value="bill" />
            <button
              className="button"
              disabled={!register?.rows.length || Boolean(billPreview?.missingPrices.size)}
            >
              Generate monthly bill
            </button>
          </form>
          {store.bills.map((bill) => (
            <article key={bill.id} className="surface panel-pad invoice-pickup-register">
              <h3>
                {bill.branch} · {bill.month}
              </h3>
              <p>
                {bill.days.length} pickup days · {bill.pickups} pickups · {currency(bill.total)}
              </p>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Monthly pickup quantities"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Particular</th>
                      {bill.days.map((day) => (
                        <th scope="col" key={day}>
                          {day}
                        </th>
                      ))}
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((line) => (
                      <tr key={line.item}>
                        <th scope="row">{line.item}</th>
                        {line.counts.map((count, index) => (
                          <td key={bill.days[index]}>{count || '–'}</td>
                        ))}
                        <td>{currency(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </>
      )}
      {view === 'payments' && (
        <>
          <h3 id="confirmed-sales">
            Payment-confirmed sales ·{' '}
            {currency(
              store.bills
                .filter((bill) => bill.verified)
                .reduce((sum, bill) => sum + bill.total, 0),
            )}
          </h3>
          <h4 id="payment-receipts">Payment receipts</h4>
          {store.bills.length === 0 && <p>No bills ready for payment verification.</p>}
          {store.bills.map((bill) => (
            <article className="surface panel-pad" key={bill.id}>
              <h4>
                {bill.branch} · {bill.month}
              </h4>
              <p>{currency(bill.total)}</p>
              {bill.verified ? (
                <p>Verified · {bill.verified}</p>
              ) : (
                <form className="command-form" onSubmit={save}>
                  <input type="hidden" name="bill" value={bill.id} />
                  <label>
                    Full-payment reference
                    <input name="reference" maxLength={120} required />
                  </label>
                  {submit('verify', 'Verify funds credited')}
                </form>
              )}
            </article>
          ))}
        </>
      )}
      {view === 'expenses' && (
        <>
          <form className="command-form" onSubmit={save}>
            <label>
              Expense name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Amount (₹)
              <input name="amount" inputMode="decimal" required />
            </label>
            {submit('expense', 'Record expense')}
          </form>
          {store.expenses.map((entry) => (
            <p key={entry.id}>
              {entry.name} · {entry.detail}
            </p>
          ))}
        </>
      )}
      {view === 'losses' && (
        <>
          <form className="command-form" onSubmit={save}>
            {clientSelect}
            {itemSelect}
            <label>
              Loss or damage details
              <textarea name="detail" required maxLength={300} />
            </label>
            {submit('loss', 'Record incident')}
          </form>
          {store.losses.map((entry) => (
            <p key={entry.id}>
              {entry.name} · {entry.detail}
            </p>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
