'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, Table } from '../../components/ui';
import { instantLabel, liveStatusLabel } from '../../lib/format';
import type { Theme } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';
import { STATUSES } from './EventEditor';
import { InstantField, NumberField, Rows, SelectField, TextField } from './fields';
import { changedFields, themeSchedule } from './live-schedule';

const HEMISPHERES = [
  ['north', 'Northern hemisphere'],
  ['south', 'Southern hemisphere'],
] as const;
const LOCKED = 'Locked: the theme has started.';

const window = (theme: { startsAt: string; endsAt: string }) =>
  `${instantLabel(theme.startsAt)} – ${instantLabel(theme.endsAt)}`;

/**
 * Seasonal themes (D6.2; docs/09 "schedule themes"): what each hemisphere sees, with the gaps
 * and any overlap, and every theme to edit. A theme can be deleted only before it starts.
 */
export function ThemesPanel() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const themes = useQuery({ queryKey: ['live', 'themes'], queryFn: () => api.themes() });
  const [editing, setEditing] = useState<Theme | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Theme | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['live', 'themes'] });

  if (themes.isError) {
    return <ErrorMessage error={themes.error} onRetry={() => void themes.refetch()} />;
  }
  if (!themes.data) return <Loading label="Loading seasonal themes" />;
  const items = themes.data.items;

  return (
    <>
      <div className="mb-3">
        <Button tone="primary" onClick={() => setEditing('new')}>
          New theme
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {HEMISPHERES.map(([hemisphere, label]) => {
          const schedule = themeSchedule(items, hemisphere);
          const headingId = `schedule-${hemisphere}`;
          return (
            <section key={hemisphere} aria-labelledby={headingId} className="rounded border p-3">
              <h3 id={headingId} className="mb-2 text-sm font-semibold">
                {label}
              </h3>
              {schedule.entries.length === 0 ? (
                <p className="text-sm">No themes scheduled.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {schedule.entries.map((entry) =>
                    entry.kind === 'gap' ? (
                      <li key={`gap-${entry.from}`} className="text-neutral-500">
                        {`No theme · ${window({ startsAt: entry.from, endsAt: entry.to })}`}
                      </li>
                    ) : (
                      <li key={entry.theme.id}>
                        {[
                          entry.theme.name,
                          window(entry.theme),
                          liveStatusLabel(entry.theme.status),
                          ...(entry.theme.started ? ['Started'] : []),
                          ...(entry.theme.hemisphere === null ? ['Both hemispheres'] : []),
                        ].join(' · ')}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {schedule.overlaps.map(([a, b]) => (
                <p key={`${a}-${b}`} className="mt-2 text-sm text-red-800">
                  {`${a} and ${b} overlap: only the first shows.`}
                </p>
              ))}
            </section>
          );
        })}
      </div>

      <Table head={['Name', 'Hemisphere', 'Window', 'Status', 'Rewards', '']} label="Themes">
        {items.map((theme) => (
          <tr key={theme.id}>
            <Cell>{theme.name}</Cell>
            <Cell>
              {theme.hemisphere === null
                ? 'Both'
                : theme.hemisphere === 'north'
                  ? 'North'
                  : 'South'}
            </Cell>
            <Cell>{window(theme)}</Cell>
            <Cell>{liveStatusLabel(theme.status)}</Cell>
            <Cell>{theme.rewards.length}</Cell>
            <Cell>
              <div className="flex gap-2">
                <Button label={`Edit ${theme.name}`} onClick={() => setEditing(theme)}>
                  Edit
                </Button>
                {theme.started ? null : (
                  <Button
                    tone="danger"
                    label={`Delete ${theme.name}`}
                    onClick={() => setDeleting(theme)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Cell>
          </tr>
        ))}
      </Table>

      {editing ? (
        <ThemeForm
          theme={editing === 'new' ? null : editing}
          onSubmit={async (body) => {
            if (editing === 'new') await api.createTheme(body);
            else await api.updateTheme(editing.id, body);
            refresh();
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          description="It has not started. Deleting cannot be undone; a started theme is retired instead."
          action="Delete"
          onConfirm={async (reason) => {
            await api.deleteTheme(deleting.id, reason);
            refresh();
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

interface ThemeValues {
  id: string;
  name: string;
  description: string;
  environmentId: string;
  hemisphere: 'north' | 'south' | null;
  status: string;
  startsAt: string;
  endsAt: string;
  rewards: { id: string; badgeId: string; requiredActiveDays: number | null }[];
}

const NEW_THEME: ThemeValues = {
  id: '',
  name: '',
  description: '',
  environmentId: '',
  hemisphere: null,
  status: 'planned',
  startsAt: '',
  endsAt: '',
  rewards: [],
};

/**
 * A theme's fields. Once it has started (A6.5) the start, the hemisphere, and the rewards are
 * locked and the end only moves later; an edit sends only what changed, with a reason.
 */
function ThemeForm({
  theme,
  onSubmit,
  onClose,
}: {
  theme: Theme | null;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const initial: ThemeValues = theme
    ? {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        environmentId: theme.environmentId,
        hemisphere: theme.hemisphere,
        status: theme.status,
        startsAt: theme.startsAt,
        endsAt: theme.endsAt,
        rewards: theme.rewards.map((r) => ({ ...r })),
      }
    : NEW_THEME;
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const locked = theme?.started === true;
  const title = theme ? `Edit ${theme.name}` : 'New theme';
  const set = <K extends keyof ThemeValues>(name: K, value: ThemeValues[K]) =>
    setValues((old) => ({ ...old, [name]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...(theme ? changedFields(initial, values) : values),
        reason: reason.trim(),
      });
      onClose();
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/30 p-4">
      <form
        aria-label={title}
        onSubmit={(e) => void submit(e)}
        className="mx-auto max-w-2xl space-y-4 rounded bg-white p-4 text-neutral-900 shadow"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {locked ? <p className="text-xs text-neutral-600">{LOCKED}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          {theme ? null : <TextField label="Id" value={values.id} onChange={(v) => set('id', v)} />}
          <TextField label="Name" value={values.name} onChange={(v) => set('name', v)} />
          <TextField
            label="Description"
            multiline
            value={values.description}
            onChange={(v) => set('description', v)}
          />
          <TextField
            label="Environment"
            value={values.environmentId}
            onChange={(v) => set('environmentId', v)}
          />
          <SelectField
            label="Hemisphere"
            value={values.hemisphere ?? ''}
            options={[
              ['', 'Both'],
              ['north', 'North'],
              ['south', 'South'],
            ]}
            disabled={locked}
            onChange={(v) => set('hemisphere', v === '' ? null : (v as 'north' | 'south'))}
          />
          <SelectField
            label="Status"
            value={values.status}
            options={STATUSES}
            onChange={(v) => set('status', v)}
          />
          <InstantField
            label="Starts at"
            value={values.startsAt}
            disabled={locked}
            onChange={(v) => set('startsAt', v)}
          />
          <InstantField
            label="Ends at"
            value={values.endsAt}
            hint={locked ? 'The end can only move later.' : undefined}
            onChange={(v) => set('endsAt', v)}
          />
        </div>
        <Rows
          title="Rewards"
          noun="Reward"
          rows={values.rewards}
          blank={() => ({ id: '', badgeId: '', requiredActiveDays: 1 })}
          onChange={(rows) => set('rewards', rows)}
          locked={locked}
          lockedNote="Rewards are locked once the theme starts."
          render={(row, setRow, disabled) => (
            <>
              <TextField
                label="Id"
                value={row.id}
                disabled={disabled}
                onChange={(v) => setRow({ ...row, id: v })}
              />
              <TextField
                label="Badge"
                value={row.badgeId}
                disabled={disabled}
                onChange={(v) => setRow({ ...row, badgeId: v })}
              />
              <NumberField
                label="Active days"
                value={row.requiredActiveDays}
                disabled={disabled}
                onChange={(v) => setRow({ ...row, requiredActiveDays: v })}
              />
            </>
          )}
        />
        <div className="space-y-1">
          <label htmlFor={`${id}-reason`} className="block text-xs font-medium">
            Reason
          </label>
          <input
            id={`${id}-reason`}
            className="w-full rounded border px-2 py-1 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error ? <ErrorMessage error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" tone="primary" disabled={busy || reason.trim().length < 3}>
            {theme ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
