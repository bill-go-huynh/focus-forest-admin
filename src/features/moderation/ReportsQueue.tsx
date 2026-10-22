'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState } from 'react';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { categoryLabel, instantLabel, personLabel, reportStatusLabel } from '../../lib/format';
import type { ReportStatus } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

const STATUSES: ReportStatus[] = ['open', 'in_review', 'resolved', 'dismissed'];

/**
 * The reports queue (docs/09 → Reports and moderation): open and in-review reports by default,
 * oldest first, filterable by status, each linked to its detail.
 */
export function ReportsQueue() {
  const api = useAdminApi();
  const id = useId();
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const reports = useInfiniteQuery({
    queryKey: ['reports', status],
    queryFn: ({ pageParam }) => api.reports(status || undefined, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const rows = reports.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageTitle>Reports</PageTitle>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor={`${id}-status`}>Status</label>
        <select
          id={`${id}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value as ReportStatus | '')}
          className="rounded-lg border border-line p-1.5"
        >
          <option value="">Waiting (open and in review)</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {reportStatusLabel(value)}
            </option>
          ))}
        </select>
      </div>
      {reports.isError ? (
        <ErrorMessage error={reports.error} onRetry={() => void reports.refetch()} />
      ) : !reports.data ? (
        <Loading label="Loading reports" />
      ) : rows.length === 0 ? (
        <p className="text-sm">
          {status
            ? `No ${reportStatusLabel(status).toLowerCase()} reports.`
            : 'No reports waiting.'}
        </p>
      ) : (
        <>
          <Table
            head={['Category', 'Status', 'Reported user', 'Open about them', 'Reporter', 'Filed']}
          >
            {rows.map((report) => (
              <tr key={report.id}>
                <Cell>
                  <Link href={`/reports/${report.id}`} className="underline">
                    {categoryLabel(report.category)}
                  </Link>
                </Cell>
                <Cell>{reportStatusLabel(report.status)}</Cell>
                <Cell>{personLabel(report.target)}</Cell>
                <Cell>{report.target.openReports}</Cell>
                <Cell>{report.reporter ? personLabel(report.reporter) : 'Deleted account'}</Cell>
                <Cell>{instantLabel(report.createdAt)}</Cell>
              </tr>
            ))}
          </Table>
          {reports.hasNextPage ? (
            <div className="mt-3">
              <Button
                onClick={() => void reports.fetchNextPage()}
                disabled={reports.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
