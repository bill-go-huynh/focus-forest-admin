'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { instantLabel, liveStatusLabel } from '../../lib/format';
import type { LiveEventSummary } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { EventEditor } from './EventEditor';
import { LeaderboardsPanel } from './LeaderboardsPanel';
import { NEW_EVENT, eventCalendar } from './live-schedule';
import { ThemesPanel } from './ThemesPanel';

const TABS = [
  ['events', 'Events'],
  ['themes', 'Seasonal themes'],
  ['leaderboards', 'Leaderboards'],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * Live operations (D6.2; docs/09 later admin): events with their calendar, seasonal themes per
 * hemisphere, and leaderboards with exclusions. Admins and content staff.
 */
export function LivePage() {
  const api = useAdminApi();
  const [tab, setTab] = useState<Tab>('events');
  const events = useQuery({ queryKey: ['live', 'events'], queryFn: () => api.liveEvents() });

  return (
    <>
      <PageTitle>Live operations</PageTitle>
      <div role="tablist" aria-label="Live operations" className="mb-4 flex gap-2">
        {TABS.map(([each, label]) => (
          <button
            key={each}
            role="tab"
            aria-selected={each === tab}
            onClick={() => setTab(each)}
            className={`rounded px-3 py-1 text-sm ${each === tab ? 'bg-neutral-900 text-white' : 'border'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'events' ? (
        events.isError ? (
          <ErrorMessage error={events.error} onRetry={() => void events.refetch()} />
        ) : !events.data ? (
          <Loading label="Loading events" />
        ) : (
          <EventsPanel events={events.data.items} />
        )
      ) : tab === 'themes' ? (
        <ThemesPanel />
      ) : (
        <LeaderboardsPanel events={events.data?.items ?? []} />
      )}
    </>
  );
}

function EventsPanel({ events }: { events: LiveEventSummary[] }) {
  const api = useAdminApi();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const calendar = eventCalendar(events);

  return (
    <>
      <div className="mb-3">
        <Button tone="primary" onClick={() => setCreating(true)}>
          New event
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm">No events yet.</p>
      ) : (
        <Table head={['Name', 'Status', 'Window', 'People', '']}>
          {events.map((event) => (
            <tr key={event.id}>
              <Cell>
                <Link href={`/live/events/${encodeURIComponent(event.id)}`} className="underline">
                  {event.name}
                </Link>
              </Cell>
              <Cell>{liveStatusLabel(event.status)}</Cell>
              <Cell>{`${instantLabel(event.startsAt)} – ${instantLabel(event.endsAt)}`}</Cell>
              <Cell>{event.participants}</Cell>
              <Cell>{event.locked ? 'Locked' : ''}</Cell>
            </tr>
          ))}
        </Table>
      )}
      {calendar.length > 0 ? (
        <section aria-labelledby="calendar" className="mt-6">
          <h2 id="calendar" className="mb-2 text-base font-semibold">
            Calendar
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {calendar.map((month) => (
              <div key={month.key} className="rounded border p-2">
                <h3 className="text-sm font-semibold">{month.label}</h3>
                <ul className="text-sm">
                  {month.events.map((event) => (
                    <li key={event.id}>{`${event.name} · ${event.days}`}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {creating ? (
        <div className="fixed inset-0 overflow-y-auto bg-black/30 p-4">
          <div className="mx-auto max-w-3xl rounded bg-white p-4 text-neutral-900 shadow">
            <h2 className="mb-3 text-base font-semibold">New event</h2>
            <EventEditor
              title="New event"
              initial={NEW_EVENT}
              locked={null}
              onSubmit={async (body) => {
                const created = await api.createLiveEvent(body);
                // The event's own page edits it from here.
                router.push(`/live/events/${encodeURIComponent(created.id)}`);
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
