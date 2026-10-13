'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { CATALOG_KINDS, type CatalogItem, type CatalogKind } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { CatalogForm } from './CatalogForm';
import { KIND_LABELS } from './catalog-fields';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  retired: 'Retired',
};

/**
 * The content catalog (D6.1; docs/09 later admin): badges, achievements, species, and cosmetics.
 * Each kind is a table with a preview, the status, and its owners; items are created and edited
 * with a reason, retired by status, and deleted only while nobody owns them.
 */
export function CatalogPage() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CatalogKind>('badges');
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const list = useQuery({ queryKey: ['catalog', kind], queryFn: () => api.catalog(kind) });
  const label = KIND_LABELS[kind];

  const update = (change: (items: CatalogItem[]) => CatalogItem[]) =>
    queryClient.setQueryData<{ items: CatalogItem[] }>(['catalog', kind], (old) =>
      old ? { items: change(old.items) } : old,
    );

  return (
    <>
      <PageTitle>Content</PageTitle>
      <div role="tablist" aria-label="Content kinds" className="mb-4 flex gap-2">
        {CATALOG_KINDS.map((each) => (
          <button
            key={each}
            role="tab"
            aria-selected={each === kind}
            onClick={() => setKind(each)}
            className={`rounded px-3 py-1 text-sm ${each === kind ? 'bg-neutral-900 text-white' : 'border'}`}
          >
            {KIND_LABELS[each].plural}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <Button tone="primary" onClick={() => setEditing('new')}>{`New ${label.one}`}</Button>
      </div>
      {list.isError ? (
        <ErrorMessage error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Loading label={`Loading ${label.plural.toLowerCase()}`} />
      ) : list.data.items.length === 0 ? (
        <p className="text-sm">{`No ${label.plural.toLowerCase()} yet.`}</p>
      ) : (
        <Table head={['Preview', 'Name', 'Id', 'Status', 'Details', 'Owners', '']}>
          {list.data.items.map((item) => (
            <tr key={item.id}>
              <Cell>
                <ArtworkPreview id={String(item['artworkId'] ?? item['badgeId'] ?? item.id)} />
              </Cell>
              <Cell>{String(item['name'] ?? item.id)}</Cell>
              <Cell>
                <code>{item.id}</code>
              </Cell>
              <Cell>{item['status'] ? STATUS_LABELS[String(item['status'])] : '—'}</Cell>
              <Cell>{details(kind, item)}</Cell>
              <Cell>{item.owners}</Cell>
              <Cell>
                <div className="flex gap-2">
                  <Button onClick={() => setEditing(item)}>Edit</Button>
                  {item.owners === 0 && item['source'] !== 'system' ? (
                    <Button tone="danger" onClick={() => setDeleting(item)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      {editing ? (
        <CatalogForm
          kind={kind}
          title={
            editing === 'new' ? `New ${label.one}` : `Edit ${String(editing['name'] ?? editing.id)}`
          }
          item={editing === 'new' ? null : editing}
          onSubmit={async (body) => {
            if (editing === 'new') {
              const created = await api.createCatalogItem(kind, body);
              update((items) => [...items, created]);
            } else {
              const saved = await api.updateCatalogItem(kind, editing.id, body);
              update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
            }
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${String(deleting['name'] ?? deleting.id)}”?`}
          description="Nobody owns it yet. Deleting cannot be undone; owned content is retired instead."
          action="Delete"
          onConfirm={async (reason) => {
            await api.deleteCatalogItem(kind, deleting.id, reason);
            update((items) => items.filter((item) => item.id !== deleting.id));
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function details(kind: CatalogKind, item: CatalogItem): string {
  if (kind === 'achievements') return `${String(item['criterion'])} ≥ ${String(item['target'])}`;
  const parts = [item['rarity'], item['type'] ?? item['category'], item['source']].filter(Boolean);
  return parts.map(String).join(' · ');
}

/**
 * The art ships with the app and is drawn by id (docs/10), so the admin shows the id on a
 * neutral tile until exported images exist (owner decision 7).
 */
export function ArtworkPreview({ id }: { id: string }) {
  return (
    <div
      role="img"
      aria-label={`Artwork ${id} (placeholder)`}
      className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 text-[8px] text-neutral-500"
    >
      {id.slice(0, 8)}
    </div>
  );
}
