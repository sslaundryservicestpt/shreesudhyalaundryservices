import Link from 'next/link';
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { displayQuantity, formatMoney } from '@shree/domain';

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumbs">
        {items.map((i, n) => (
          <li key={n}>
            {i.href ? (
              <Link href={i.href}>{i.label}</Link>
            ) : (
              <span aria-current="page">{i.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function StatusBadge({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span className={'ui-badge tone-' + tone}>
      <span aria-hidden="true">{{ info: '●', success: '✓', warning: '!', danger: '×' }[tone]}</span>{' '}
      {children}
    </span>
  );
}
export const PriorityBadge = StatusBadge;
export function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export const StatCard = KpiCard;
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="form-error" role="alert">
      {children}
    </div>
  );
}
export function LoadingSkeleton({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div className="ui-skeleton" role="status" aria-label={label}>
      <span>{label}…</span>
    </div>
  );
}
export function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function DataToolbar({ children }: { children: ReactNode }) {
  return <div className="filters">{children}</div>;
}
export const FilterBar = DataToolbar;
export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label>
      {label}
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" {...props} />;
}
export function DatePicker(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} />;
}
export function FileUpload(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="file" {...props} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}
export function Pagination({
  page,
  total,
  limit,
  href,
}: {
  page: number;
  total: number;
  limit: number;
  href: (page: number) => string;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {total} records · Page {page}
      </span>
      {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
      {page * limit < total && <Link href={href(page + 1)}>Next</Link>}
    </nav>
  );
}
export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="ui-timeline">{children}</ol>;
}
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <label>
      {label}
      <progress max={100} value={Math.max(0, Math.min(100, value))} />
    </label>
  );
}
export function QuantityDisplay({ value, unit }: { value: number; unit: 'PIECE' | 'KG' }) {
  return <span className="numeric">{displayQuantity(value, unit)}</span>;
}
export function MoneyDisplay({
  value,
  scale,
  currency,
}: {
  value: bigint | string;
  scale: number;
  currency: string;
}) {
  return <span className="numeric">{formatMoney(value, scale, currency)}</span>;
}
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface panel-pad">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
/** Presentation only. Every data read and command must authorize independently. */
export function RoleGate({
  roles,
  allow,
  children,
}: {
  roles: string[];
  allow: string[];
  children: ReactNode;
}) {
  return roles.some((r) => allow.includes(r)) ? children : null;
}
export function Toast({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="save-notice">
      {children}
    </p>
  );
}

export function TrendChart({
  points,
  label,
}: {
  points: { label: string; value: number }[];
  label: string;
}) {
  const maximum = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure>
      <figcaption>{label}</figcaption>
      <svg role="img" aria-label={label} viewBox="0 0 400 120">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          points={points
            .map(
              (p, i) =>
                `${20 + (i * 360) / Math.max(1, points.length - 1)},${100 - (80 * Math.max(0, p.value)) / maximum}`,
            )
            .join(' ')}
        />
      </svg>
      <ul>
        {points.map((p, i) => (
          <li key={i}>
            {p.label}: {p.value}
          </li>
        ))}
      </ul>
    </figure>
  );
}
