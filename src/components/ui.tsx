'use client';

import type { ReactNode } from 'react';

import { AdminApiError } from '../lib/api';

/**
 * Plain building blocks (docs/09: clarity over decoration; tables, forms, detail panels), in the
 * Focus Forest look: paper, forest green for the primary action, Fraunces for page titles.
 */

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-6 font-display text-3xl font-normal tracking-tight text-ink">{children}</h1>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">{children}</h2>;
}

/** A raised panel: a group of fields or facts on the paper. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_3px_#2b262014]">
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  disabled,
  tone = 'default',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  /** The accessible name, when the text alone repeats on every row ("Edit"). */
  label?: string;
}) {
  const tones = {
    default: 'border-line-strong bg-surface text-ink hover:bg-paper-2',
    primary: 'border-forest bg-forest text-white hover:bg-forest-strong hover:border-forest-strong',
    danger: 'border-danger bg-surface text-danger hover:bg-danger-soft',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/** What went wrong, in the API's words when it gave some, with a retry when one helps. */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof AdminApiError
      ? error.status === 403
        ? "Your role can't do this."
        : error.message
      : 'Something went wrong.';
  return (
    <div
      role="alert"
      className="my-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
    >
      <p>{message}</p>
      {error instanceof AdminApiError && error.problems.length > 1 ? (
        <ul className="mt-1 list-disc pl-5">
          {error.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <div className="mt-2">
          <Button onClick={onRetry}>Try again</Button>
        </div>
      ) : null}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      {/* A quiet spinner beside the words (owner, 2026-10-23); the words carry the meaning. */}
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-forest"
      />
      {label}
    </p>
  );
}

export function Table({
  head,
  label,
  children,
}: {
  head: string[];
  /** The table's accessible name, when a page holds more than one. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table aria-label={label} className="w-full border-collapse text-sm">
        <thead className="bg-paper-2">
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="border-b border-line px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:hover]:bg-paper">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children }: { children: ReactNode }) {
  return <td className="border-b border-line px-3 py-2.5 align-top">{children}</td>;
}
