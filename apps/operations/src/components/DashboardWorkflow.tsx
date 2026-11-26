import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { dashboardWorkflows, type DashboardRole } from '@/lib/dashboard-roles';

export default function DashboardWorkflow({
  role,
  exampleLinks,
}: {
  role: DashboardRole;
  exampleLinks?: readonly string[];
}) {
  return (
    <section className="surface panel-pad dashboard-workflow" aria-labelledby="workflow-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{role === 'admin' ? 'SETUP & OVERSIGHT' : 'DAILY WORKFLOW'}</p>
          <h2 id="workflow-heading">{exampleLinks ? 'Try the workflow' : 'What to do next'}</h2>
        </div>
      </div>
      <ol>
        {dashboardWorkflows[role].map((step, index) => (
          <li key={step.title}>
            <Link href={exampleLinks?.[index] ?? step.href}>
              <span className="dashboard-step" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
