'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { instantLabel } from '../../lib/format';
import { useAdminApi } from '../../lib/session';

/** Users (docs/09): search by email, name, or id; newest first; page by page. */
export function UserSearch() {
  const api = useAdminApi();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const users = useInfiniteQuery({
    queryKey: ['users', query],
    queryFn: ({ pageParam }) => api.searchUsers(query || undefined, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const rows = users.data?.pages.flatMap((page) => page.items) ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
  };

  return (
    <>
      <PageTitle>Users</PageTitle>
      <form role="search" onSubmit={submit} className="mb-4 flex gap-2">
        <input
          type="search"
          aria-label="Search users"
          placeholder="Email, name, or id"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-80 rounded border p-2 text-sm"
        />
        <Button type="submit">Search</Button>
      </form>
      {users.isError ? (
        <ErrorMessage error={users.error} onRetry={() => void users.refetch()} />
      ) : !users.data ? (
        <Loading label="Loading users" />
      ) : rows.length === 0 ? (
        <p className="text-sm">{query ? `No users match “${query}”.` : 'No users yet.'}</p>
      ) : (
        <>
          <Table head={['Email', 'Name', 'Status', 'Joined', 'Time zone']}>
            {rows.map((user) => (
              <tr key={user.id}>
                <Cell>
                  <Link href={`/users/${user.id}`} className="underline">
                    {user.email}
                  </Link>
                </Cell>
                <Cell>{user.displayName ?? '—'}</Cell>
                <Cell>{user.status === 'active' ? 'Active' : 'Suspended'}</Cell>
                <Cell>{instantLabel(user.joinedAt)}</Cell>
                <Cell>{user.timezone ?? '—'}</Cell>
              </tr>
            ))}
          </Table>
          {users.hasNextPage ? (
            <div className="mt-3">
              <Button
                onClick={() => void users.fetchNextPage()}
                disabled={users.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
