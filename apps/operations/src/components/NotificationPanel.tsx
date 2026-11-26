'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Bell, BellOff, X } from 'lucide-react';

export type WorkspaceNotification = {
  label: string;
  count: number;
  href: string;
  detail?: string;
};

export default function NotificationPanel({ items }: { items?: WorkspaceNotification[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<WorkspaceNotification[]>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const title = useId();
  const isLive = items === undefined;

  useEffect(() => {
    if (!isLive) return;
    let pending: AbortController | undefined;
    async function refresh() {
      if (document.visibilityState !== 'visible' || pending) return;
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch('/api/v1/notifications', { signal: controller.signal });
        if (!response.ok) throw Error('Could not load notifications');
        const result = await response.json();
        if (!controller.signal.aborted) {
          setAlerts(result.data);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = undefined;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      pending?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isLive, revision]);

  const current = items ?? alerts;
  const total = current?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  return (
    <>
      <button
        type="button"
        className="notification-trigger"
        aria-label={total ? 'Notifications, ' + total + ' pending' : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
          if (isLive) setRevision((value) => value + 1);
        }}
      >
        <Bell size={19} aria-hidden="true" />
        {total > 0 && (
          <span className="notification-count" aria-hidden="true">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="notification-panel"
        aria-labelledby={title}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="notification-panel-inner">
          <header>
            <div>
              <h2 id={title}>Notifications</h2>
              <p>{total ? total + ' pending in your workspace' : 'Activity for your role'}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              autoFocus
              aria-label="Close notifications"
              onClick={() => dialog.current?.close()}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="notification-body">
            {failed && (
              <p className="notification-error" role="status">
                Couldn’t refresh notifications.{' '}
                <button type="button" onClick={() => setRevision((value) => value + 1)}>
                  Retry
                </button>
              </p>
            )}
            {current?.length ? (
              <ul>
                {current.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={() => dialog.current?.close()}>
                      <span className="notification-item-count">{item.count}</span>
                      <span>
                        <strong>{item.label}</strong>
                        {item.detail && <small>{item.detail}</small>}
                      </span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              !failed && (
                <p className="notification-empty" role="status">
                  <BellOff size={23} aria-hidden="true" />
                  {current ? 'You’re all caught up.' : 'Checking your workspace…'}
                </p>
              )
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
