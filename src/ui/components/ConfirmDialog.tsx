import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

/**
 * Modal confirmation built on the native <dialog>: focus is trapped and Escape cancels.
 * Used before every action that destroys data.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', ''); // very old browsers, test environments
    }
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <div style={{ marginTop: 'var(--space-3)' }}>{children}</div>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={onCancel} autoFocus>
          {t('common.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
