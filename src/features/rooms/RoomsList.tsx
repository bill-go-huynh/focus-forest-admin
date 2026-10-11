'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { instantLabel, personLabel, phaseLabel } from '../../lib/format';
import type { AdminRoom } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

/**
 * Focus rooms (docs/09 → Focus rooms): the active rooms, and closing one with a confirmed reason
 * the API audits. Closing ends the room for everyone in it; sessions already saved are kept.
 */
export function RoomsList() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState<AdminRoom | null>(null);
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms() });

  const replace = (room: AdminRoom): void => {
    queryClient.setQueryData<{ items: AdminRoom[] }>(['rooms'], (old) =>
      old ? { items: old.items.map((item) => (item.id === room.id ? room : item)) } : old,
    );
  };

  return (
    <>
      <PageTitle>Rooms</PageTitle>
      {rooms.isError ? (
        <ErrorMessage error={rooms.error} onRetry={() => void rooms.refetch()} />
      ) : !rooms.data ? (
        <Loading label="Loading rooms" />
      ) : rooms.data.items.length === 0 ? (
        <p className="text-sm">No open rooms.</p>
      ) : (
        <Table head={['Name', 'Topic', 'Phase', 'Host', 'People', 'Visibility', 'Opened', '']}>
          {rooms.data.items.map((room) => (
            <tr key={room.id}>
              <Cell>{room.name}</Cell>
              <Cell>{room.topic ?? '—'}</Cell>
              <Cell>{phaseLabel(room.phase)}</Cell>
              <Cell>{room.host ? personLabel(room.host) : '—'}</Cell>
              <Cell>{room.participants}</Cell>
              <Cell>{room.visibility === 'public' ? 'Public' : 'Private'}</Cell>
              <Cell>{instantLabel(room.createdAt)}</Cell>
              <Cell>
                {room.phase === 'closed' || room.phase === 'ended' ? null : (
                  <Button tone="danger" onClick={() => setClosing(room)}>
                    Close room
                  </Button>
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      {closing ? (
        <ConfirmDialog
          title={`Close “${closing.name}”?`}
          description="The room ends for everyone in it. Sessions already saved are kept."
          action="Close room"
          onConfirm={async (reason) => replace(await api.closeRoom(closing.id, reason))}
          onClose={() => setClosing(null)}
        />
      ) : null}
    </>
  );
}
