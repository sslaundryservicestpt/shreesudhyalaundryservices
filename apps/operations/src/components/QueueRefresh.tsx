'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AssignmentNotice } from '@/lib/work-queues';

/** Queue pages refresh independently of open order forms. */
export default function QueueRefresh({ assignments }: { assignments?: AssignmentNotice[] }) {
  const router = useRouter();
  const seen = useRef(new Set(assignments?.map((item) => item.key)));
  const [announced, setAnnounced] = useState<AssignmentNotice[]>([]);
  useEffect(() => {
    const newItems = assignments?.filter((item) => !seen.current.has(item.key)) ?? [];
    for (const item of newItems) seen.current.add(item.key);
    if (newItems.length) setAnnounced((current) => [...newItems, ...current].slice(0, 4));
  }, [assignments]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [router]);
  const active = announced.filter((item) =>
    assignments?.some((pending) => pending.key === item.key),
  );
  return active.length ? (
    <div className="notice" role="status" aria-live="polite">
      <strong>New assignments</strong>
      {active.map((item) => (
        <p key={item.key}>
          <Link href={'/workspace/work/' + item.orderId}>{item.message}</Link>
        </p>
      ))}
    </div>
  ) : null;
}
