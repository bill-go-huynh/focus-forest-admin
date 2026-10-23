'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  Button,
  Cell,
  ErrorMessage,
  Loading,
  PageTitle,
  Panel,
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
  statusLabel,
} from '../../lib/format';
import type { SessionRow, UserDetail as Detail, UserRow } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { useHasRole } from '../shell/AdminShell';
import { CompensationGrant, NotificationDiagnostics } from './UserOperations';

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
  // Moderators never read notes (A5.3, least privilege).
  const canRevealNotes = useHasRole('admin', 'support');
  // D6.3: notification diagnostics for admins and support (A6.6).
  const canDiagnose = useHasRole('admin', 'support');
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
      {/* Owner, 2026-10-23: the person at a glance, then one card per part. */}
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-soft font-display text-2xl text-forest-deep"
          >
            {(profile.displayName ?? profile.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{profile.displayName ?? '—'}</p>
            <p className="text-sm text-ink-2">{profile.username ? `@${profile.username}` : '—'}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              profile.status === 'active'
                ? 'bg-forest-soft text-forest-deep'
                : 'bg-amber-soft text-amber'
            }`}
          >
            {statusLabel(profile.status)}
          </span>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Fact label="Bio">{profile.bio ?? '—'}</Fact>
          <Fact label="Joined">{instantLabel(profile.joinedAt)}</Fact>
          <Fact label="Time zone">{profile.timezone ?? '—'}</Fact>
          <Fact label="Usage data">{detail.shareUsageData ? 'Shared' : 'Not shared'}</Fact>
        </dl>
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-base font-semibold">Lifetime</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Big label="Focused" value={duration(detail.lifetime.focusedMilliseconds)} />
            <Big label="Counted sessions" value={String(detail.lifetime.sessionCount)} />
            <Big label="Monthly trees" value={String(detail.lifetime.archivedTreeCount)} />
          </div>
          <dl className="mt-3 grid gap-y-1 text-sm">
            <Fact label="Streak">
              {detail.lifetime.currentStreak === null
                ? 'No time zone'
                : `${plural(detail.lifetime.currentStreak, 'day')} now, longest ${plural(detail.lifetime.longestStreak ?? 0, 'day')}`}
            </Fact>
          </dl>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold">This month’s tree and rewards</h2>
          <dl className="mt-3 grid gap-y-2 text-sm">
            <Fact label="Current tree">
              {detail.currentTree
                ? `${stageLabel(detail.currentTree.stage)} · ${speciesLabel(detail.currentTree.species)} · fullness ${detail.currentTree.fullnessLevel}, blossoms ${detail.currentTree.blossomLevel}, richness ${detail.currentTree.richnessTier} (${monthLabel(detail.currentTree)})`
                : 'No growing tree'}
            </Fact>
            <Fact label="Rewards">
              {`${plural(detail.rewards.badges, 'badge')} · ${plural(detail.rewards.species, 'species', 'species')} · ${plural(detail.rewards.cosmetics, 'cosmetic')}`}
            </Fact>
          </dl>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold">Moderation</h2>
          <dl className="mt-3 grid gap-y-1 text-sm">
            <Fact label="Reports">{`${plural(detail.moderation.reportsAbout, 'report')} about this user, ${detail.moderation.openReportsAbout} open`}</Fact>
            <Fact label="Filed">{`${plural(detail.moderation.reportsFiled, 'report')} filed`}</Fact>
            <Fact label="Warnings">{plural(detail.moderation.warnings, 'warning')}</Fact>
            <Fact label="Blocks">{`Blocks ${plural(detail.moderation.blocking, 'user')} · blocked by ${plural(detail.moderation.blockedBy, 'user')}`}</Fact>
          </dl>
        </Panel>
      </div>

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
                    ) : !canRevealNotes ? (
                      'Hidden'
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

      {canDiagnose ? <NotificationDiagnostics userId={id} /> : null}
      {isAdmin ? <CompensationGrant userId={id} /> : null}

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

/** One label and its value, side by side on wide screens. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-x-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A headline number in a card. */
function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
