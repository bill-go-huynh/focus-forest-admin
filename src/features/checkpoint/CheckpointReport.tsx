'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { monthLabel } from '../../lib/format';
import { useAdminApi } from '../../lib/session';

/**
 * The Core Loop Checkpoint (docs/12 ★): for testers who joined in a range, multi-day use in their
 * first month, returns after a gap, and the second-month return after the first archive. Counts,
 * never percentages: the checkpoint reads small numbers of known people. The qualitative half
 * (reactions to the tree) is asked in person (CHECKPOINT.md).
 */
export function CheckpointReport() {
  const api = useAdminApi();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const report = useQuery({
    queryKey: ['checkpoint', range],
    queryFn: () => api.checkpoint(range!.from, range!.to),
    enabled: range !== null,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (from && to) setRange({ from, to });
  };

  return (
    <>
      <PageTitle>Core Loop Checkpoint</PageTitle>
      <form onSubmit={submit} className="mb-4 flex items-end gap-3 text-sm">
        <label className="flex flex-col">
          Joined from
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-lg border border-line p-1"
          />
        </label>
        <label className="flex flex-col">
          Joined to
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-lg border border-line p-1"
          />
        </label>
        <Button type="submit" disabled={!from || !to}>
          Show
        </Button>
      </form>
      {!range ? null : report.isError ? (
        <ErrorMessage error={report.error} onRetry={() => void report.refetch()} />
      ) : !report.data ? (
        <Loading label="Loading the checkpoint" />
      ) : (
        <>
          <dl className="mb-4 grid max-w-2xl grid-cols-[18rem_1fr] gap-y-1 text-sm">
            <dt>Testers</dt>
            <dd data-testid="cohort-users">{report.data.cohort.users}</dd>
            <dt>2+ active days in their first month</dt>
            <dd data-testid="cohort-multiDayFirstMonth">{`${report.data.cohort.multiDayFirstMonth} of ${report.data.cohort.users}`}</dd>
            <dt>Came back after a gap of 3+ days</dt>
            <dd data-testid="cohort-returnedAfterGap">{`${report.data.cohort.returnedAfterGap} of ${report.data.cohort.users}`}</dd>
            <dt>Returned the month after their first tree</dt>
            <dd data-testid="cohort-secondMonth">{`${report.data.cohort.secondMonth.returned} of ${report.data.cohort.secondMonth.decided} decided`}</dd>
            <dt>Median active days, first month</dt>
            <dd>{report.data.cohort.medianFirstMonthActiveDays ?? '—'}</dd>
          </dl>
          <Table
            head={[
              'Tester',
              'Joined',
              'Active days',
              'Gap returns',
              'First tree',
              'Next month',
              'Last active',
            ]}
          >
            {report.data.users.map((user) => (
              <tr key={user.userId}>
                <Cell>{user.email}</Cell>
                <Cell>{user.joinedOn}</Cell>
                <Cell>{user.activeDays}</Cell>
                <Cell>{user.gapReturns}</Cell>
                <Cell>{user.firstArchive ? monthLabel(user.firstArchive) : '—'}</Cell>
                <Cell>
                  {user.secondMonthReturn === null
                    ? 'Not decided'
                    : user.secondMonthReturn
                      ? 'Returned'
                      : 'Did not return'}
                </Cell>
                <Cell>{user.lastActiveOn ?? '—'}</Cell>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
