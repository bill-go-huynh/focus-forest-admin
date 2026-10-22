'use client';

import { useId, useState, type ReactNode } from 'react';

import { Button, ErrorMessage } from './ui';

/**
 * Every user-affecting action and every reveal is confirmed with a reason that the API logs
 * (docs/09). `confirmText`, when given, must be typed exactly (deleting an account).
 */
export function ConfirmDialog({
  title,
  description,
  action,
  tone = 'danger',
  confirmText,
  confirmLabel = 'Type the email to confirm',
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  action: string;
  tone?: 'danger' | 'primary';
  confirmText?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ready =
    reason.trim().length >= 3 &&
    (confirmText === undefined || typed.trim().toLowerCase() === confirmText.toLowerCase());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1c181266]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-[0_6px_16px_#2b262024]"
      >
        <h2 id={`${id}-title`} className="text-base font-semibold">
          {title}
        </h2>
        <div className="my-2 text-sm">{description}</div>
        <label htmlFor={`${id}-reason`} className="mt-3 block text-sm font-medium">
          Reason (logged)
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full px-3 py-2 text-sm"
          rows={2}
        />
        {confirmText !== undefined ? (
          <>
            <label htmlFor={`${id}-typed`} className="mt-3 block text-sm font-medium">
              {confirmLabel}
            </label>
            <input
              id={`${id}-typed`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm"
              autoComplete="off"
            />
          </>
        ) : null}
        {error ? <ErrorMessage error={error} /> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone={tone} disabled={!ready || busy} onClick={() => void submit()}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
