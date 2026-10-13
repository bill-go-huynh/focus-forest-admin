'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
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
import { instantLabel, liveStatusLabel, plural } from '../../lib/format';
import type { LiveEvent } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { EventEditor, TREE_STAGES } from './EventEditor';
import { eventFormValues } from './live-schedule';

const STAGE_LABELS: Record<string, string> = Object.fromEntries(TREE_STAGES);
const number = (n: number) => n.toLocaleString('en-US');

/**
 * One event (D6.2, `/live/events/[id]`): the Community Tree monitor, the editor with what is
 * locked and why, and deletion while nobody has joined.
 */
export function EventDetail() {
  const api = useAdminApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [deleting, setDeleting] = useState(false);
  const event = useQuery({ queryKey: ['live', 'event', id], queryFn: () => api.liveEvent(id) });

  if (event.isError) {
    return <ErrorMessage error={event.error} onRetry={() => void event.refetch()} />;
  }
  if (!event.data) return <Loading label="Loading the event" />;
  const data = event.data;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/live" className="underline">
          Live operations
        </Link>
      </p>
      <PageTitle>{data.name}</PageTitle>
      <p className="mb-4 text-sm">
        {`${liveStatusLabel(data.status)} · ${instantLabel(data.startsAt)} – ${instantLabel(data.endsAt)} · ${plural(data.participants, 'participant')}`}
      </p>
      {data.communityTree ? <TreeMonitor tree={data.communityTree} /> : null}
      <SectionTitle>Edit</SectionTitle>
      <EventEditor
        title={`Edit ${data.name}`}
        initial={eventFormValues(data)}
        locked={data.locked}
        onSubmit={async (body) => {
          const saved = await api.updateLiveEvent(data.id, body);
          queryClient.setQueryData(['live', 'event', id], saved);
          void queryClient.invalidateQueries({ queryKey: ['live', 'events'] });
          return eventFormValues(saved);
        }}
      />
      {data.participants === 0 ? (
        <div className="mt-6">
          <Button tone="danger" onClick={() => setDeleting(true)}>
            Delete event
          </Button>
        </div>
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${data.name}”?`}
          description="Nobody has joined it. Deleting cannot be undone; a joined event is retired instead."
          action="Delete"
          onConfirm={async (reason) => {
            await api.deleteLiveEvent(data.id, reason);
            void queryClient.invalidateQueries({ queryKey: ['live', 'events'] });
            router.push('/live');
          }}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

/** The Community Tree as it grows: minutes, contributors, and each stage reached or to go. */
function TreeMonitor({ tree }: { tree: NonNullable<LiveEvent['communityTree']> }) {
  return (
    <section aria-labelledby="community-tree" className="mb-6">
      <h2 id="community-tree" className="mb-2 mt-6 text-base font-semibold">
        Community Tree
      </h2>
      <p className="text-sm font-medium">{tree.name}</p>
      <p className="mb-2 text-sm">
        {`${number(tree.totalMinutes)} minutes from ${plural(tree.contributors, 'person', 'people')}`}
      </p>
      <Table head={['Stage', 'Minutes', 'Badge', 'Progress']}>
        {tree.milestones.map((m) => (
          <tr key={m.stage}>
            <Cell>{STAGE_LABELS[m.stage] ?? m.stage}</Cell>
            <Cell>{number(m.thresholdMinutes)}</Cell>
            <Cell>{m.badgeId ?? '—'}</Cell>
            <Cell>
              {m.reachedAt
                ? `Reached ${instantLabel(m.reachedAt)}`
                : `${number(Math.max(0, m.thresholdMinutes - tree.totalMinutes))} minutes to go`}
            </Cell>
          </tr>
        ))}
      </Table>
    </section>
  );
}
