'use client';

import type { ReactNode } from 'react';

import { AdminApiError } from '../lib/api';

/** Plain building blocks (docs/09: clarity over decoration; tables, forms, detail panels). */

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-semibold">{children}</h1>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 text-base font-semibold">{children}</h2>;
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
    default: 'border-neutral-400',
    primary: 'border-neutral-900 bg-neutral-900 text-white',
    danger: 'border-red-700 text-red-800',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded border px-3 py-1.5 text-sm disabled:opacity-50 ${tones[tone]}`}
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
      className="my-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
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
    <p role="status" className="text-sm text-neutral-500">
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
    <table aria-label={label} className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col" className="border-b p-2 text-left font-medium">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Cell({ children }: { children: ReactNode }) {
  return <td className="border-b p-2 align-top">{children}</td>;
}
