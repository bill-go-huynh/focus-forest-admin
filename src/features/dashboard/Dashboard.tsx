'use client';

import { useQuery } from '@tanstack/react-query';

import { ErrorMessage, Loading, PageTitle } from '../../components/ui';
import type { Dashboard as DashboardData } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

const STATS: { key: Exclude<keyof DashboardData, 'generatedAt'>; label: string }[] = [
  { key: 'signupsLast7Days', label: 'Sign-ups, last 7 days' },
  { key: 'activeUsersLast7Days', label: 'Active users, last 7 days' },
  { key: 'sessionsToday', label: 'Sessions today' },
  { key: 'discardedToday', label: 'Discarded today' },
  { key: 'openReports', label: 'Open reports' },
];

/** A few plain operational counts (docs/09 → Dashboard). UTC days. */
export function Dashboard() {
  const api = useAdminApi();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard() });
  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      {query.isError ? (
        <ErrorMessage error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Loading label="Loading the dashboard" />
      ) : (
        <dl className="grid max-w-2xl grid-cols-2 gap-4">
          {STATS.map(({ key, label }) => (
            <div key={key} className="rounded border p-3">
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd data-testid={`stat-${key}`} className="text-2xl font-semibold">
                {query.data[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
