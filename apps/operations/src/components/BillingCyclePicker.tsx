'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lookup } from './CommandForm';

export default function BillingCyclePicker({
  branch,
  month,
  lookup,
  clientId,
}: {
  branch?: { id: string; name: string };
  month: string;
  lookup: string;
  clientId?: string;
}) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(month);
  function showRegister(branchId: string, period: string) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return;
    const params = new URLSearchParams({ section: 'cycles', month: period });
    if (branchId) params.set('branch', branchId);
    if (clientId) params.set('client', clientId);
    startTransition(() => router.push('/workspace/finance?' + params, { scroll: false }));
  }
  return (
    <div className="billing-cycle-picker">
      <Lookup
        key={branch?.id ?? 'unselected'}
        field={{ name: 'branch', label: 'Client branch', lookup, initial: branch?.id }}
        selectedLabel={branch?.name}
        onSelect={(value) => showRegister(value, selectedMonth)}
      />
      <label>
        Billing month
        <input
          type="month"
          value={selectedMonth}
          onChange={(event) => {
            setSelectedMonth(event.target.value);
            if (branch) showRegister(branch.id, event.target.value);
          }}
        />
      </label>
      {loading && <p role="status">Loading pickup register…</p>}
    </div>
  );
}
