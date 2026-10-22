'use client';

import { useId, useState, type FormEvent } from 'react';

import { Button, ErrorMessage } from '../../components/ui';
import { CheckboxField, InstantField, NumberField, Rows, SelectField, TextField } from './fields';
import { changedFields, type EventValues, type TreeValues } from './live-schedule';

/** The API's choices (focus-forest-api `src/content/live-rules.ts`). */
const MEASURES = [
  ['focus_minutes', 'Focus minutes'],
  ['sessions', 'Counted sessions'],
  ['active_days', 'Active days'],
  ['streak_days', 'Streak days'],
  ['focus_together_sessions', 'Focus Together sessions'],
] as const;
export const TREE_STAGES = [
  ['seedling', 'Seedling'],
  ['growing_tree', 'Growing tree'],
  ['bloom', 'Bloom'],
  ['final_form', 'Final form'],
] as const;
export const STATUSES = [
  ['planned', 'Planned'],
  ['active', 'Active'],
  ['retired', 'Retired'],
] as const;

const LOCKED = 'Locked: people have taken part.';

/**
 * An event with its teams, missions, milestones, and Community Tree (D6.2). Once anyone has
 * joined, what they joined is locked (A6.5): the start, the entry condition, and every list; the
 * end only moves later. A new event sends every field; an edit sends only what changed. Every
 * write carries a reason the API audits.
 */
export function EventEditor({
  title,
  initial,
  locked,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: EventValues;
  /** Null for a new event. */
  locked: boolean | null;
  /** Answers the values to compare later edits against, or nothing when the form is done. */
  onSubmit: (body: Record<string, unknown>) => Promise<EventValues | void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const creating = locked === null;
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof EventValues>(name: K, value: EventValues[K]) => {
    setSaved(false);
    setValues((old) => ({ ...old, [name]: value }));
  };
  const setTree = (tree: TreeValues | null) => set('communityTree', tree);
  const lock = locked === true;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const fields = creating ? values : changedFields(baseline, values);
    try {
      const next = await onSubmit({ ...fields, reason: reason.trim() });
      if (next) {
        setBaseline(next);
        setValues(next);
        setReason('');
        setSaved(true);
      }
    } catch (caught) {
      setError(caught);
    }
    setBusy(false);
  };

  const tree = values.communityTree;
  return (
    <form aria-label={title} onSubmit={(e) => void submit(e)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {creating ? (
          <TextField label="Id" value={values.id} onChange={(v) => set('id', v)} />
        ) : null}
        <TextField label="Event name" value={values.name} onChange={(v) => set('name', v)} />
        <TextField
          label="Description"
          multiline
          value={values.description}
          onChange={(v) => set('description', v)}
        />
        <TextField
          label="Artwork id"
          value={values.artworkId}
          onChange={(v) => set('artworkId', v)}
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
          disabled={lock}
          hint={lock ? LOCKED : undefined}
          onChange={(v) => set('startsAt', v)}
        />
        <InstantField
          label="Ends at"
          value={values.endsAt}
          hint={lock ? 'The end can only move later.' : undefined}
          onChange={(v) => set('endsAt', v)}
        />
        <NumberField
          label="Entry: counted sessions"
          value={values.entryMinSessions}
          disabled={lock}
          onChange={(v) => set('entryMinSessions', v)}
        />
        <CheckboxField
          label="Leaderboard"
          checked={values.leaderboard}
          onChange={(v) => set('leaderboard', v)}
        />
      </div>

      <Rows
        title="Teams"
        noun="Team"
        rows={values.teams}
        blank={() => ({ id: '', name: '' })}
        onChange={(rows) => set('teams', rows)}
        locked={lock}
        lockedNote={LOCKED}
        render={(row, setRow, disabled) => (
          <>
            <TextField
              label="Id"
              value={row.id}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, id: v })}
            />
            <TextField
              label="Name"
              value={row.name}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, name: v })}
            />
          </>
        )}
      />

      <Rows
        title="Missions"
        noun="Mission"
        rows={values.missions}
        blank={() => ({
          id: '',
          measure: 'focus_minutes',
          target: 1,
          dailyMinutes: 0,
          name: '',
          description: '',
        })}
        onChange={(rows) => set('missions', rows)}
        locked={lock}
        lockedNote={LOCKED}
        render={(row, setRow, disabled) => (
          <>
            <TextField
              label="Id"
              value={row.id}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, id: v })}
            />
            <SelectField
              label="Measure"
              value={row.measure}
              options={MEASURES}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, measure: v })}
            />
            <NumberField
              label="Target"
              value={row.target}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, target: v })}
            />
            <NumberField
              label="Daily minutes"
              value={row.dailyMinutes}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, dailyMinutes: v })}
            />
            <TextField
              label="Name"
              value={row.name}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, name: v })}
            />
            <TextField
              label="Description"
              value={row.description}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, description: v })}
            />
          </>
        )}
      />

      <Rows
        title="Milestones"
        noun="Milestone"
        rows={values.milestones}
        blank={() => ({ id: '', name: '', requiredMissions: 1, badgeId: null, trait: false })}
        onChange={(rows) => set('milestones', rows)}
        locked={lock}
        lockedNote={LOCKED}
        render={(row, setRow, disabled) => (
          <>
            <TextField
              label="Id"
              value={row.id}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, id: v })}
            />
            <TextField
              label="Name"
              value={row.name}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, name: v })}
            />
            <NumberField
              label="Missions required"
              value={row.requiredMissions}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, requiredMissions: v })}
            />
            <TextField
              label="Badge"
              value={row.badgeId ?? ''}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, badgeId: v.trim() === '' ? null : v })}
            />
            <CheckboxField
              label="Grants a trait"
              checked={row.trait}
              disabled={disabled}
              onChange={(v) => setRow({ ...row, trait: v })}
            />
          </>
        )}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Community Tree</h3>
        {lock ? <p className="text-xs text-muted">{LOCKED}</p> : null}
        <CheckboxField
          label="This event grows a Community Tree"
          checked={tree !== null}
          disabled={lock}
          onChange={(on) => setTree(on ? { name: '', artworkId: '', milestones: [] } : null)}
        />
        {tree ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Tree name"
                value={tree.name}
                disabled={lock}
                onChange={(v) => setTree({ ...tree, name: v })}
              />
              <TextField
                label="Tree artwork id"
                value={tree.artworkId}
                disabled={lock}
                onChange={(v) => setTree({ ...tree, artworkId: v })}
              />
            </div>
            <Rows
              title="Tree milestones"
              noun="Tree milestone"
              rows={tree.milestones}
              blank={() => ({ stage: 'seedling', thresholdMinutes: null, badgeId: '' })}
              onChange={(rows) => setTree({ ...tree, milestones: rows })}
              locked={lock}
              lockedNote={LOCKED}
              render={(row, setRow, disabled) => (
                <>
                  <SelectField
                    label="Stage"
                    value={row.stage}
                    options={TREE_STAGES}
                    disabled={disabled}
                    onChange={(v) => setRow({ ...row, stage: v })}
                  />
                  <NumberField
                    label="Minutes"
                    value={row.thresholdMinutes}
                    disabled={disabled}
                    onChange={(v) => setRow({ ...row, thresholdMinutes: v })}
                  />
                  <TextField
                    label="Badge"
                    value={row.badgeId}
                    disabled={disabled}
                    onChange={(v) => setRow({ ...row, badgeId: v })}
                  />
                </>
              )}
            />
          </>
        ) : null}
      </section>

      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className="block text-xs font-medium">
          Reason
        </label>
        <input
          id={`${id}-reason`}
          className="w-full rounded-lg border border-line px-2 py-1 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error ? <ErrorMessage error={error} /> : null}
      {saved ? (
        <p role="status" className="text-sm">
          Saved.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" tone="primary" disabled={busy || reason.trim().length < 3}>
          {creating ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
