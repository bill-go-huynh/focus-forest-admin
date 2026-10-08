'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  Button,
  Cell,
  ErrorMessage,
  Loading,
  PageTitle,
  SectionTitle,
  Table,
} from '../../components/ui';
import {
  duration,
  instantLabel,
  monthLabel,
  plural,
  speciesLabel,
  stageLabel,
} from '../../lib/format';
import type { SessionRow, UserDetail as Detail, UserRow } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { useHasRole } from '../shell/AdminShell';

type Dialog = 'suspend' | 'reactivate' | 'delete' | { reveal: SessionRow } | null;

/**
 * A user (docs/09 → User detail): profile, lifetime stats, the current tree as numbers and a
 * stage label, rewards owned, checkpoint activity, the sessions with why each counted, and the
 * support actions. Notes stay hidden until revealed with a logged reason; account actions are
 * for admins only and always confirmed with a reason.
 */
export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isAdmin = useHasRole('admin');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notes, setNotes] = useState<Record<string, string | null>>({});
  const user = useQuery({ queryKey: ['user', id], queryFn: () => api.user(id) });
  const sessions = useInfiniteQuery({
    queryKey: ['user', id, 'sessions'],
    queryFn: ({ pageParam }) => api.sessions(id, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  if (user.isError) return <ErrorMessage error={user.error} onRetry={() => void user.refetch()} />;
  if (!user.data) return <Loading label="Loading the user" />;
  const detail = user.data;
  const { profile } = detail;

  const updateProfile = (row: UserRow): void => {
    queryClient.setQueryData<Detail>(['user', id], (old) =>
      old ? { ...old, profile: { ...old.profile, ...row } } : old,
    );
  };

  return (
    <>
      <PageTitle>{profile.email}</PageTitle>
      <dl className="grid max-w-3xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Status</dt>
        <dd>{profile.status === 'active' ? 'Active' : 'Suspended'}</dd>
        <dt>Name</dt>
        <dd>{profile.displayName ?? '—'}</dd>
        <dt>Bio</dt>
        <dd>{profile.bio ?? '—'}</dd>
        <dt>Joined</dt>
        <dd>{instantLabel(profile.joinedAt)}</dd>
        <dt>Time zone</dt>
        <dd>{profile.timezone ?? '—'}</dd>
        <dt>Usage data</dt>
        <dd>{detail.shareUsageData ? 'Shared' : 'Not shared'}</dd>
      </dl>

      <SectionTitle>Lifetime</SectionTitle>
      <dl className="grid max-w-3xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Focused</dt>
        <dd>{duration(detail.lifetime.focusedMilliseconds)}</dd>
        <dt>Counted sessions</dt>
        <dd>{detail.lifetime.sessionCount}</dd>
        <dt>Monthly trees</dt>
        <dd>{detail.lifetime.archivedTreeCount}</dd>
        <dt>Streak</dt>
        <dd>
          {detail.lifetime.currentStreak === null
            ? 'No time zone'
            : `${plural(detail.lifetime.currentStreak, 'day')} now, longest ${plural(detail.lifetime.longestStreak ?? 0, 'day')}`}
        </dd>
        <dt>Current tree</dt>
        <dd>
          {detail.currentTree
            ? `${stageLabel(detail.currentTree.stage)} · ${speciesLabel(detail.currentTree.species)} · fullness ${detail.currentTree.fullnessLevel}, blossoms ${detail.currentTree.blossomLevel}, richness ${detail.currentTree.richnessTier} (${monthLabel(detail.currentTree)})`
            : 'No growing tree'}
        </dd>
        <dt>Rewards</dt>
        <dd>
          {`${plural(detail.rewards.badges, 'badge')} · ${plural(detail.rewards.species, 'species', 'species')} · ${plural(detail.rewards.cosmetics, 'cosmetic')}`}
        </dd>
      </dl>

      <SectionTitle>Checkpoint activity</SectionTitle>
      <Checkpoint metrics={detail.checkpoint} />

      <SectionTitle>Sessions</SectionTitle>
      {sessions.isError ? (
        <ErrorMessage error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : !sessions.data ? (
        <Loading label="Loading sessions" />
      ) : (
        <>
          <Table head={['Started', 'Topic', 'Focused', 'Planned', 'Why', 'Note']}>
            {sessions.data.pages
              .flatMap((page) => page.items)
              .map((session) => (
                <tr key={session.id}>
                  <Cell>{instantLabel(session.startedAt)}</Cell>
                  <Cell>{session.topic.name}</Cell>
                  <Cell>{duration(session.focusedMilliseconds)}</Cell>
                  <Cell>{`${session.plannedMinutes} min`}</Cell>
                  <Cell>{session.explanation.text}</Cell>
                  <Cell>
                    {!session.hasNote ? (
                      '—'
                    ) : session.id in notes ? (
                      <q>{notes[session.id] ?? ''}</q>
                    ) : (
                      <Button onClick={() => setDialog({ reveal: session })}>
                        {`Reveal note (${instantLabel(session.startedAt)})`}
                      </Button>
                    )}
                  </Cell>
                </tr>
              ))}
          </Table>
          {sessions.hasNextPage ? (
            <div className="mt-3">
              <Button onClick={() => void sessions.fetchNextPage()}>Load more</Button>
            </div>
          ) : null}
        </>
      )}

      {isAdmin ? (
        <>
          <SectionTitle>Account</SectionTitle>
          <div className="flex gap-2">
            {profile.status === 'active' ? (
              <Button tone="danger" onClick={() => setDialog('suspend')}>
                Suspend account
              </Button>
            ) : (
              <Button onClick={() => setDialog('reactivate')}>Reactivate account</Button>
            )}
            <Button tone="danger" onClick={() => setDialog('delete')}>
              Delete account
            </Button>
          </div>
        </>
      ) : null}

      {dialog === 'suspend' ? (
        <ConfirmDialog
          title="Suspend this account?"
          description="The user is signed out everywhere and can't sign in until reactivated."
          action="Suspend account"
          onConfirm={async (reason) => updateProfile(await api.suspendUser(id, reason))}
          onClose={() => setDialog(null)}
        />
      ) : dialog === 'reactivate' ? (
        <ConfirmDialog
          title="Reactivate this account?"
          description="The user can sign in again."
          action="Reactivate account"
          tone="primary"
          onConfirm={async (reason) => updateProfile(await api.reactivateUser(id, reason))}
          onClose={() => setDialog(null)}
        />
      ) : dialog === 'delete' ? (
        <ConfirmDialog
          title="Delete this account and all its data?"
          description="Sessions, trees, recaps, and rewards are removed. This cannot be undone."
          action="Delete account"
          confirmText={profile.email}
          onConfirm={async (reason) => {
            await api.deleteUser(id, reason, profile.email);
            // The users list no longer holds this account.
            void queryClient.invalidateQueries({ queryKey: ['users'] });
            router.replace('/users');
          }}
          onClose={() => setDialog(null)}
        />
      ) : dialog && typeof dialog === 'object' ? (
        <ConfirmDialog
          title="Reveal this note?"
          description="Notes are personal. Reveal one only for a support case; the reveal is logged."
          action="Reveal note"
          tone="primary"
          onConfirm={async (reason) => {
            const { note } = await api.revealNote(id, dialog.reveal.id, reason);
            setNotes((old) => ({ ...old, [dialog.reveal.id]: note }));
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function Checkpoint({ metrics }: { metrics: Detail['checkpoint'] }) {
  const second =
    metrics.firstArchive === null
      ? 'No archived month yet'
      : metrics.secondMonthReturn === null
        ? 'The month after the first archive is not over'
        : metrics.secondMonthReturn
          ? 'Returned in the month after the first archive'
          : 'Did not return in the month after the first archive';
  return (
    <div className="text-sm">
      <p>{`${plural(metrics.activeDays, 'active day')}, ${plural(metrics.gapReturns, 'return')} after a gap. Last active ${metrics.lastActiveOn ?? 'never'}.`}</p>
      <p>{second}</p>
      <Table head={['Month', 'Active days', 'Focus days']}>
        {metrics.months.map((month) => (
          <tr key={`${month.year}-${month.month}`}>
            <Cell>{monthLabel(month)}</Cell>
            <Cell>{month.activeDays}</Cell>
            <Cell>{month.focusDays}</Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
