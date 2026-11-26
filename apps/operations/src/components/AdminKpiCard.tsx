import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

export default function AdminKpiCard({
  label,
  value,
  href,
  action,
  icon: Icon,
  tone = 'blue',
  detail,
}: {
  label: string;
  value: number | string | readonly string[];
  href: string;
  action: string;
  icon: LucideIcon;
  tone?: 'blue' | 'gold' | 'green';
  detail?: string;
}) {
  return (
    <Link className="admin-kpi" data-tone={tone} href={href}>
      <span className="admin-kpi-label">
        <span className="admin-kpi-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        {label}
      </span>
      <strong className="admin-kpi-value">
        {Array.isArray(value) ? value.map((amount) => <span key={amount}>{amount}</span>) : value}
      </strong>
      {detail && <small className="admin-kpi-detail">{detail}</small>}
      <span className="admin-kpi-action">
        {action}
        <ArrowUpRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
