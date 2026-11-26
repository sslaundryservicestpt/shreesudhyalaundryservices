import { csvCell, displayQuantity } from '@shree/domain';

export type PickupRegisterLine = {
  orderId: string;
  garment: string;
  service: string;
  unit: string;
  quantity: number;
  amount: string | null;
  collectedAt?: string | null;
};

export function billingMonth(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    month,
    startsAt: new Date(month + '-01T00:00:00+05:30').toISOString(),
    endsAt: new Date(next + '-01T00:00:00+05:30').toISOString(),
    days: Array.from({ length: days }, (_, i) => month + '-' + String(i + 1).padStart(2, '0')),
  };
}

export function billingMonthForPeriod(start: Date, end: Date) {
  const month = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(start);
  const period = billingMonth(month);
  return period?.startsAt === start.toISOString() && period.endsAt === end.toISOString()
    ? period
    : null;
}

export function pickupRegister({
  lines,
  collections,
  timezone,
  money,
  calendarDays = [],
}: {
  lines: PickupRegisterLine[];
  collections?: Record<string, string>;
  timezone: string;
  money: (amount: bigint) => string;
  calendarDays?: string[];
}) {
  const dayFormat = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const days = new Map<string, Set<string>>(calendarDays.map((day) => [day, new Set()]));
  const items = new Map<
    string,
    {
      name: string;
      service: string;
      unit: string;
      total: number;
      amount: bigint | null;
      counts: Map<string, number>;
    }
  >();
  for (const line of lines) {
    const when = new Date(line.collectedAt ?? collections?.[line.orderId] ?? '');
    const day = Number.isFinite(when.valueOf()) ? dayFormat.format(when) : 'Undated';
    const pickups = days.get(day) ?? new Set<string>();
    pickups.add(line.orderId);
    days.set(day, pickups);
    const key = JSON.stringify([line.garment, line.service, line.unit]);
    const row = items.get(key) ?? {
      name: line.garment,
      service: line.service,
      unit: line.unit,
      total: 0,
      amount: 0n,
      counts: new Map<string, number>(),
    };
    row.total += line.quantity;
    row.amount =
      row.amount === null || line.amount === null ? null : row.amount + BigInt(line.amount);
    row.counts.set(day, (row.counts.get(day) ?? 0) + line.quantity);
    items.set(key, row);
  }
  const columns = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, pickups]) => ({
      day,
      pickups: pickups.size,
    }));
  const totalsFor = (day?: string) => {
    const totals = new Map<string, number>();
    for (const row of items.values()) {
      const amount = day ? (row.counts.get(day) ?? 0) : row.total;
      if (amount) totals.set(row.unit, (totals.get(row.unit) ?? 0) + amount);
    }
    return [...totals].map(([unit, count]) => displayQuantity(count, unit)).join(' · ');
  };
  const rows = [...items].map(([key, row]) => ({
    key,
    name: row.name,
    service: row.service,
    unit: row.unit,
    cells: columns.map(({ day }) =>
      row.counts.has(day) ? displayQuantity(row.counts.get(day)!, row.unit) : '',
    ),
    quantity: displayQuantity(row.total, row.unit),
    amount: row.amount === null ? '' : money(row.amount),
  }));
  const subtotal = [...items.values()].reduce<bigint | null>(
    (sum, row) => (sum === null || row.amount === null ? null : sum + row.amount),
    0n,
  );
  return {
    columns,
    rows,
    pickupDays: columns.filter(({ day, pickups }) => day !== 'Undated' && pickups > 0).length,
    pickupCount: columns.reduce((sum, { pickups }) => sum + pickups, 0),
    undated: days.get('Undated')?.size ?? 0,
    totals: columns.map(({ day }) => totalsFor(day)),
    totalQuantity: totalsFor(),
    subtotal: subtotal === null ? '' : money(subtotal),
  };
}

export type PickupRegister = ReturnType<typeof pickupRegister>;

export function pickupRegisterCsv(title: string, register: PickupRegister) {
  const { columns, rows, pickupCount, pickupDays, totals, totalQuantity, subtotal } = register;
  const quantityNumber = (quantity: string) => quantity.replace(/ (pcs|kg)$/, '');
  const singleUnit = new Set(rows.map((row) => row.unit)).size === 1;
  const records = [
    [title],
    ['Pickup days', pickupDays, 'Pickups', pickupCount],
    [
      'Particular',
      'Service',
      'Unit',
      ...columns.map(({ day }) => day),
      'Total quantity',
      'Amount before tax',
    ],
    ['Pickup visits', '', '', ...columns.map(({ pickups }) => pickups), pickupCount, ''],
    ...rows.map((row) => [
      row.name,
      row.service,
      row.unit,
      ...row.cells.map(quantityNumber),
      quantityNumber(row.quantity),
      row.amount,
    ]),
    [
      'Totals',
      '',
      singleUnit ? rows[0].unit : '',
      ...(singleUnit ? totals.map(quantityNumber) : totals),
      singleUnit ? quantityNumber(totalQuantity) : totalQuantity,
      subtotal,
    ],
  ];
  return '\uFEFF' + records.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
