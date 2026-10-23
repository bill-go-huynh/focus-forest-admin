'use client';

import { useQuery } from '@tanstack/react-query';

import { ErrorMessage, Loading, PageTitle, Panel } from '../../components/ui';
import type { Dashboard as DashboardData } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

type Stat = Exclude<keyof DashboardData, 'generatedAt' | 'days'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 h 50 min", "45 min", "0 min". */
export function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const dayText = (date: string) => {
  const [, month = 1, day = 1] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] ?? month}`;
};

/** The headline row: the numbers someone opening the admin wants first (owner, 2026-10-23). */
const HEADLINE: { key: Stat; label: string; hours?: boolean }[] = [
  { key: 'totalUsers', label: 'People' },
  { key: 'focusMinutesToday', label: 'Focus today', hours: true },
  { key: 'focusMinutesLast7Days', label: 'Focus, last 7 days', hours: true },
  { key: 'activeUsersLast7Days', label: 'Active users, last 7 days' },
];

/** Operations: what may need someone today. */
const OPERATIONS: { key: Stat; label: string }[] = [
  { key: 'sessionsToday', label: 'Sessions today' },
  { key: 'discardedToday', label: 'Discarded today' },
  { key: 'openRooms', label: 'Open focus rooms' },
  { key: 'notificationsSentToday', label: 'Notifications sent today' },
  { key: 'signupsLast7Days', label: 'Sign-ups, last 7 days' },
  { key: 'openReports', label: 'Open reports' },
];

/**
 * The dashboard (docs/09 → Dashboard): headline numbers, the last 14 days of focus, and the
 * day's operational counts. UTC days. Plain numbers, no targets or rankings.
 */
export function Dashboard() {
  const api = useAdminApi();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard() });
  const data = query.data;
  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      {query.isError ? (
        <ErrorMessage error={query.error} onRetry={() => void query.refetch()} />
      ) : !data ? (
        <Loading label="Loading the dashboard" />
      ) : (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {HEADLINE.map(({ key, label, hours }) => (
              <div
                key={key}
                className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_3px_#2b262014]"
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd
                  data-testid={`stat-${key}`}
                  className="mt-1 font-display text-3xl tracking-tight text-forest-deep"
                >
                  {hours ? hoursText(data[key]) : data[key].toLocaleString('en')}
                </dd>
              </div>
            ))}
          </dl>

          <Panel>
            <h2 className="text-base font-semibold">Focus in the last 14 days</h2>
            <p className="text-xs text-muted">Counted minutes per UTC day; sessions in each bar.</p>
            <FocusChart days={data.days} />
          </Panel>

          <Panel>
            <h2 className="mb-3 text-base font-semibold">Today’s operations</h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATIONS.map(({ key, label }) => (
                <div key={key} className="rounded-xl bg-paper-2 px-4 py-3">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd data-testid={`stat-${key}`} className="text-2xl font-semibold">
                    {data[key].toLocaleString('en')}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      )}
    </>
  );
}

/** Bars by day, each one a list item read as one sentence; no chart library. */
function FocusChart({ days }: { days: DashboardData['days'] }) {
  const top = Math.max(1, ...days.map((day) => day.focusMinutes));
  return (
    <ul
      aria-label="Focus in the last 14 days"
      className="mt-4 flex h-48 items-end gap-1.5 sm:gap-2"
    >
      {days.map((day, index) => {
        const label = `${dayText(day.date)}: ${hoursText(day.focusMinutes)}, ${day.sessions} sessions`;
        const height = Math.max(2, Math.round((day.focusMinutes / top) * 100));
        const today = index === days.length - 1;
        return (
          <li
            key={day.date}
            aria-label={label}
            title={label}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] text-muted" aria-hidden="true">
              {day.sessions > 0 ? day.sessions : ''}
            </span>
            <span
              aria-hidden="true"
              className={`w-full rounded-t-md ${today ? 'bg-forest-deep' : 'bg-forest'}`}
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-muted" aria-hidden="true">
              {dayText(day.date).split(' ')[0]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
