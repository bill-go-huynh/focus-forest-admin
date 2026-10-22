'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import {
  Button,
  Cell,
  ErrorMessage,
  Loading,
  PageTitle,
  SectionTitle,
  Table,
} from '../../components/ui';
import { instantLabel } from '../../lib/format';
import type { ClientErrorGroup } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

const PERIODS = [1, 7, 30] as const;

/** What each rate limit guards (A7.2), in plain words. */
const LIMIT_LABELS: Record<string, string> = {
  signUp: 'New accounts',
  signIn: 'Sign-in attempts',
  refresh: 'Session refreshes',
  deleteAttempts: 'Account deletion attempts',
  reports: 'Reports',
  follows: 'Follows',
  reactions: 'Reactions',
  invites: 'Invitations',
  roomCodes: 'Room codes tried',
  search: 'People searches',
  analytics: 'Usage data batches',
  clientErrors: 'Error reports',
};

/**
 * App errors (D7.1; A7.4, self-built monitoring): crashes and errors the apps reported, grouped
 * by what went wrong, version, and screen, newest first. Nothing says who. Admins and support.
 */
export function ClientErrorsPage() {
  const api = useAdminApi();
  const id = useId();
  const [days, setDays] = useState<number>(7);
  const errors = useQuery({
    queryKey: ['client-errors', days],
    queryFn: () => api.clientErrors(days),
  });

  return (
    <>
      <PageTitle>App errors</PageTitle>
      <div className="mb-4 max-w-xs space-y-1">
        <label htmlFor={id} className="block text-xs font-medium">
          Period
        </label>
        <select
          id={id}
          className="w-full rounded-lg border border-line px-2 py-1 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {value === 1 ? 'Last day' : `Last ${value} days`}
            </option>
          ))}
        </select>
      </div>
      {errors.isError ? (
        <ErrorMessage error={errors.error} onRetry={() => void errors.refetch()} />
      ) : !errors.data ? (
        <Loading label="Loading app errors" />
      ) : errors.data.items.length === 0 ? (
        <p className="text-sm">{`No errors reported in the last ${days === 1 ? 'day' : `${days} days`}.`}</p>
      ) : (
        <Table head={['Kind', 'Message', 'App', 'Screen', 'Count', 'Last seen', '']}>
          {errors.data.items.map((group) => (
            <ErrorRow
              key={`${group.kind}-${group.message}-${group.appVersion}-${group.screen}`}
              group={group}
            />
          ))}
        </Table>
      )}
      <RateLimits />
    </>
  );
}

/** Requests refused by rate limits over the last day, per limit (D7.1; A7.2). */
function RateLimits() {
  const api = useAdminApi();
  const limits = useQuery({ queryKey: ['rate-limits'], queryFn: () => api.rateLimitRefusals() });
  return (
    <>
      <SectionTitle>Rate limits</SectionTitle>
      {limits.isError ? (
        <ErrorMessage error={limits.error} onRetry={() => void limits.refetch()} />
      ) : !limits.data ? (
        <Loading label="Loading rate limits" />
      ) : (
        <>
          <p className="mb-2 text-sm">{`Since ${instantLabel(limits.data.since)}. Counts only: nothing says who.`}</p>
          <Table
            head={['Limit', 'Allowed per window', 'Refused', 'Refused keys']}
            label="Rate limits"
          >
            {limits.data.items.map((item) => (
              <tr key={item.name}>
                <Cell>{LIMIT_LABELS[item.name] ?? item.name}</Cell>
                <Cell>{item.limit}</Cell>
                <Cell>{item.refused}</Cell>
                <Cell>{item.keys}</Cell>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}

function ErrorRow({ group }: { group: ClientErrorGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr>
        <Cell>{group.kind === 'crash' ? 'Crash' : 'Error'}</Cell>
        <Cell>
          <code className="text-xs">{group.message}</code>
        </Cell>
        <Cell>{`${group.platform} ${group.appVersion}`}</Cell>
        <Cell>{group.screen ?? '—'}</Cell>
        <Cell>{group.count}</Cell>
        <Cell>{instantLabel(group.lastSeen)}</Cell>
        <Cell>
          {group.stack ? (
            <Button onClick={() => setOpen((value) => !value)}>
              {open ? 'Hide stack' : 'Show stack'}
            </Button>
          ) : null}
        </Cell>
      </tr>
      {open && group.stack ? (
        <tr>
          <td colSpan={7} className="border-b p-2">
            <pre className="whitespace-pre-wrap text-xs">{group.stack}</pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
