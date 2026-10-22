'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, ErrorMessage, Loading, PageTitle } from '../../components/ui';
import { personLabel } from '../../lib/format';
import type { IntegrityFlag } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

/** What a flag says, in plain words. */
export function flagLabel(flag: IntegrityFlag): string {
  switch (flag.kind) {
    case 'overlap':
      return `Two sessions at once (${flag.detail.overlapMinutes} min overlap)`;
    case 'day_total':
      return `${flag.detail.focusMinutes} minutes of focus on ${flag.detail.localDate}`;
    case 'late':
      return `A session stored ${flag.detail.hoursLate} hours after it ended`;
    case 'spike':
      return `Week of ${flag.detail.weekStart}: ${flag.detail.focusMinutes} minutes, usually ${flag.detail.usualMinutes}`;
  }
}

type Action =
  | { kind: 'dismiss'; userId: string; flag: IntegrityFlag }
  | { kind: 'exclude'; userId: string; email: string };

/**
 * Leaderboard integrity (D7.1; A7.3, Phase 7 owner decision 8): people on the boards whose focus
 * looks implausible, with the evidence. Staff dismiss a flag that is fine, or exclude the account
 * from every board (A6.5); both ask for a reason. Admins and content staff.
 */
export function IntegrityPage() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const flags = useQuery({ queryKey: ['integrity'], queryFn: () => api.integrityFlags() });
  const [action, setAction] = useState<Action | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['integrity'] });

  return (
    <>
      <PageTitle>Leaderboard integrity</PageTitle>
      <p className="mb-4 max-w-2xl text-sm">
        Focus that looks implausible on the boards, with its evidence. Flags change nothing on their
        own: exclude an account only when you are sure, and dismiss what is fine.
      </p>
      {flags.isError ? (
        <ErrorMessage error={flags.error} onRetry={() => void flags.refetch()} />
      ) : !flags.data ? (
        <Loading label="Loading flags" />
      ) : flags.data.items.length === 0 ? (
        <p className="text-sm">Nothing looks unusual.</p>
      ) : (
        <div className="space-y-4">
          {flags.data.items.map(({ user, flags: list }) => (
            <section key={user.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{personLabel(user)}</h2>
                <Button
                  tone="danger"
                  label={`Exclude ${user.email} from boards`}
                  onClick={() => setAction({ kind: 'exclude', userId: user.id, email: user.email })}
                >
                  Exclude from boards
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {list.map((flag) => (
                  <li key={flag.key} className="flex items-center justify-between gap-3">
                    <span>{flagLabel(flag)}</span>
                    <Button
                      label={`Dismiss: ${flagLabel(flag)}`}
                      onClick={() => setAction({ kind: 'dismiss', userId: user.id, flag })}
                    >
                      Dismiss
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {action?.kind === 'dismiss' ? (
        <ConfirmDialog
          title="Dismiss this flag?"
          description={`${flagLabel(action.flag)}. It will not come back for this evidence.`}
          action="Dismiss"
          tone="primary"
          onConfirm={async (reason) => {
            await api.dismissIntegrityFlag(action.userId, action.flag.key, reason);
            refresh();
          }}
          onClose={() => setAction(null)}
        />
      ) : action?.kind === 'exclude' ? (
        <ConfirmDialog
          title={`Exclude ${action.email} from every board?`}
          description="They keep using the app; no board shows them and no team counts them until restored (Live → Leaderboards)."
          action="Exclude"
          onConfirm={async (reason) => {
            await api.exclude(action.userId, reason);
            refresh();
          }}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
