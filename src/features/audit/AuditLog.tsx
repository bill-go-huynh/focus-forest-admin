'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { instantLabel } from '../../lib/format';
import { useAdminApi } from '../../lib/session';

/** Who did what, when, and why (docs/09 → Audit log). Newest first. Admins only. */
export function AuditLog() {
  const api = useAdminApi();
  const log = useInfiniteQuery({
    queryKey: ['audit-log'],
    queryFn: ({ pageParam }) => api.auditLog(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  return (
    <>
      <PageTitle>Audit log</PageTitle>
      {log.isError ? (
        <ErrorMessage error={log.error} onRetry={() => void log.refetch()} />
      ) : !log.data ? (
        <Loading label="Loading the audit log" />
      ) : (
        <>
          <Table head={['When', 'Admin', 'Action', 'Target', 'Reason']}>
            {log.data.pages
              .flatMap((page) => page.items)
              .map((entry) => (
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
