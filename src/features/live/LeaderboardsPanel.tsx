'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, SectionTitle, Table } from '../../components/ui';
import type { StaffBoardQuery } from '../../lib/api';
import { instantLabel, personLabel } from '../../lib/format';
import type { LiveEventSummary } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

/** "Ada (@ada)": a board row's person, as the board shows them. */
const rowName = (person: { username: string | null; displayName: string | null; id: string }) => {
  const name = person.displayName ?? person.username ?? person.id;
  return person.username ? `${name} (@${person.username})` : name;
};

/**
 * Leaderboards as staff see them (D6.2; docs/09 "view, and exclude abusive accounts"): global
 * by week or month, or an event's board with its teams. Excluding takes the account off every
 * board and out of every team score until restored; both carry a reason the API audits.
 */
export function LeaderboardsPanel({ events }: { events: LiveEventSummary[] }) {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const selectId = useId();
  const [choice, setChoice] = useState('global:weekly');
  const [excluding, setExcluding] = useState<{ id: string; name: string } | null>(null);
  const [restoring, setRestoring] = useState<{ id: string; name: string } | null>(null);

  const boards = events.filter((event) => event.leaderboard);
  const [scope, value] = choice.split(':') as ['global' | 'event', string];
  const query: StaffBoardQuery =
    scope === 'event'
      ? { scope, eventId: value }
      : { scope, period: value as 'weekly' | 'monthly' };
  const title =
    scope === 'event'
      ? `${boards.find((event) => event.id === value)?.name ?? value} board`
      : `Global ${value} board`;

  const board = useQuery({
    queryKey: ['live', 'board', choice],
    queryFn: () => api.staffBoard(query),
  });
  const exclusions = useQuery({
    queryKey: ['live', 'exclusions'],
    queryFn: () => api.exclusions(),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['live', 'board'] });
    void queryClient.invalidateQueries({ queryKey: ['live', 'exclusions'] });
  };

  return (
    <>
      <div className="mb-4 max-w-xs space-y-1">
        <label htmlFor={selectId} className="block text-xs font-medium">
          Board
        </label>
        <select
          id={selectId}
          className="w-full rounded border px-2 py-1 text-sm"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="global:weekly">Global, weekly</option>
          <option value="global:monthly">Global, monthly</option>
          {boards.map((event) => (
            <option key={event.id} value={`event:${event.id}`}>
              {`Event: ${event.name}`}
            </option>
          ))}
        </select>
      </div>

      {board.isError ? (
        <ErrorMessage error={board.error} onRetry={() => void board.refetch()} />
      ) : !board.data ? (
        <Loading label="Loading the board" />
      ) : (
        <>
          <p className="mb-2 text-sm">{`${board.data.period.startDate} – ${board.data.period.endDate}`}</p>
          {board.data.teams ? (
            <Table head={['Rank', 'Team', 'Score', 'Members']} label="Teams">
              {board.data.teams.map((team) => (
                <tr key={team.id}>
                  <Cell>{team.rank}</Cell>
                  <Cell>{team.name}</Cell>
                  <Cell>{team.score}</Cell>
                  <Cell>{team.members}</Cell>
                </tr>
              ))}
            </Table>
          ) : null}
          {board.data.rows.length === 0 ? (
            <p className="text-sm">Nobody is on this board yet.</p>
          ) : (
            <Table head={['Rank', 'Person', 'Score', '']} label={title}>
              {board.data.rows.map((row) => (
                <tr key={row.person.id}>
                  <Cell>{row.rank}</Cell>
                  <Cell>{rowName(row.person)}</Cell>
                  <Cell>{row.score}</Cell>
                  <Cell>
                    <Button
                      tone="danger"
                      onClick={() => setExcluding({ id: row.person.id, name: rowName(row.person) })}
                    >
                      Exclude
                    </Button>
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}

      <SectionTitle>Excluded accounts</SectionTitle>
      {exclusions.isError ? (
        <ErrorMessage error={exclusions.error} onRetry={() => void exclusions.refetch()} />
      ) : !exclusions.data ? (
        <Loading label="Loading excluded accounts" />
      ) : exclusions.data.items.length === 0 ? (
        <p className="text-sm">No account is excluded.</p>
      ) : (
        <Table head={['Account', 'Reason', 'By', 'When', '']} label="Excluded accounts">
          {exclusions.data.items.map((row) => (
            <tr key={row.user.id}>
              <Cell>{personLabel(row.user)}</Cell>
              <Cell>{row.reason}</Cell>
              <Cell>{row.by}</Cell>
              <Cell>{instantLabel(row.excludedAt)}</Cell>
              <Cell>
                <Button
                  onClick={() => setRestoring({ id: row.user.id, name: personLabel(row.user) })}
                >
                  Restore
                </Button>
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {excluding ? (
        <ConfirmDialog
          title={`Exclude ${excluding.name} from every board?`}
          description="They keep using the app; no board shows them and no team counts them until restored."
          action="Exclude"
          onConfirm={async (reason) => {
            await api.exclude(excluding.id, reason);
            refresh();
          }}
          onClose={() => setExcluding(null)}
        />
      ) : null}
      {restoring ? (
        <ConfirmDialog
          title={`Restore ${restoring.name} to the boards?`}
          description="They appear again on every board they qualify for."
          action="Restore"
          tone="primary"
          onConfirm={async (reason) => {
            await api.include(restoring.id, reason);
            refresh();
          }}
          onClose={() => setRestoring(null)}
        />
      ) : null}
    </>
  );
}
