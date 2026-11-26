'use client';
import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={title} className="ui-dialog" onCancel={onClose} onClose={onClose}>
      <button className="button secondary" type="button" onClick={onClose}>
        Close {title}
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
export const Drawer = Modal;
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {children}
      <button className="button" type="button" onClick={onConfirm}>
        Confirm reviewed change
      </button>
    </Modal>
  );
}
