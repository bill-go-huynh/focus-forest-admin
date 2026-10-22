'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import type { AuditFilters } from '../../lib/api';
import { instantLabel } from '../../lib/format';
import { useAdminApi } from '../../lib/session';

const FIELDS: { name: keyof AuditFilters; label: string; placeholder?: string }[] = [
  { name: 'adminId', label: 'Admin id' },
  { name: 'action', label: 'Action', placeholder: 'user.grant' },
  { name: 'targetType', label: 'Target type', placeholder: 'user' },
  { name: 'targetId', label: 'Target id' },
  { name: 'from', label: 'From', placeholder: '2026-10-01T00:00:00.000Z' },
  { name: 'to', label: 'Before', placeholder: '2026-11-01T00:00:00.000Z' },
];

/**
 * Who did what, when, and why (docs/09 → Audit log). Newest first, filtered by admin, action,
 * target, and time (D6.3: from inclusive, before exclusive). Admins only.
 */
export function AuditLog() {
  const api = useAdminApi();
  const id = useId();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const log = useInfiniteQuery({
    queryKey: ['audit-log', filters],
    queryFn: ({ pageParam }) => api.auditLog(pageParam ?? undefined, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilters(
      Object.fromEntries(
        // Empty fields are left out of the query.
        Object.entries(draft).map(([name, value]) => [name, value?.trim()]),
      ) as AuditFilters,
    );
  };
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageTitle>Audit log</PageTitle>
      <form
        role="search"
        aria-label="Filter the audit log"
        onSubmit={apply}
        className="mb-4 grid max-w-4xl grid-cols-3 gap-3"
      >
        {FIELDS.map((field) => (
          <div key={field.name} className="space-y-1">
            <label htmlFor={`${id}-${field.name}`} className="block text-xs font-medium">
              {field.label}
            </label>
            <input
              id={`${id}-${field.name}`}
              className="w-full rounded-lg border border-line px-2 py-1 text-sm"
              placeholder={field.placeholder}
              value={draft[field.name] ?? ''}
              onChange={(e) => setDraft((old) => ({ ...old, [field.name]: e.target.value }))}
            />
          </div>
        ))}
        <div className="col-span-3 flex gap-2">
          <Button type="submit" tone="primary">
            Filter
          </Button>
          <Button
            onClick={() => {
              setDraft({});
              setFilters({});
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      {log.isError ? (
        <ErrorMessage error={log.error} onRetry={() => void log.refetch()} />
      ) : !log.data ? (
        <Loading label="Loading the audit log" />
      ) : entries.length === 0 ? (
        <p className="text-sm">No entries match.</p>
      ) : (
        <>
          <Table head={['When', 'Admin', 'Action', 'Target', 'Reason']}>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Cell>{instantLabel(entry.createdAt)}</Cell>
                <Cell>{entry.admin.email}</Cell>
                <Cell>
                  <code>{entry.action}</code>
                </Cell>
                <Cell>
                  {entry.targetType ? `${entry.targetType} ${entry.targetId ?? ''}` : '—'}
                </Cell>
                <Cell>{entry.reason ?? '—'}</Cell>
              </tr>
            ))}
          </Table>
          {log.hasNextPage ? (
            <div className="mt-3">
              <Button onClick={() => void log.fetchNextPage()} disabled={log.isFetchingNextPage}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
