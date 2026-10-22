'use client';

import { useId, type ReactNode } from 'react';

import { Button } from '../../components/ui';

/**
 * The live forms' fields (D6.2): a label over one control, disabled when the API would refuse a
 * change (locked), and lists of rows (teams, missions, milestones, rewards) that can grow and
 * shrink until they lock. Values stay as typed; the API judges them and names every problem.
 */

const INPUT = 'w-full rounded-lg border border-line px-2 py-1 text-sm disabled:bg-paper-2';

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  disabled,
  hint,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <Labelled label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            className={INPUT}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id={id}
            className={INPUT}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Labelled>
  );
}

/** An ISO 8601 UTC instant, typed as the API takes it. */
export function InstantField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return <TextField {...props} placeholder="2026-11-01T00:00:00.000Z" />;
}

/** A whole number; empty means none, which the API names as a problem. */
export function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <Labelled label={label}>
      {(id) => (
        <input
          id={id}
          type="number"
          className={INPUT}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )}
    </Labelled>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  /** `[value, label]` pairs. */
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Labelled label={label}>
      {(id) => (
        <select
          id={id}
          className={INPUT}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(([option, text]) => (
            <option key={option} value={option}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Labelled>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
    </div>
  );
}

/**
 * A list of rows, each a group named "<noun> <n>". While `locked`, rows are read only and the
 * list neither grows nor shrinks; `lockedNote` says why.
 */
export function Rows<T>({
  title,
  noun,
  rows,
  blank,
  onChange,
  locked,
  lockedNote,
  render,
}: {
  title: string;
  noun: string;
  rows: readonly T[];
  blank: () => T;
  onChange: (rows: T[]) => void;
  locked: boolean;
  lockedNote: string;
  render: (row: T, set: (row: T) => void, disabled: boolean) => ReactNode;
}) {
  const lower = noun.toLowerCase();
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {locked ? <p className="text-xs text-muted">{lockedNote}</p> : null}
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{`No ${title.toLowerCase()}.`}</p>
      ) : null}
      {rows.map((row, i) => (
        <fieldset
          key={i}
          aria-label={`${noun} ${i + 1}`}
          className="grid grid-cols-3 gap-2 rounded-lg border border-line p-2"
        >
          {render(row, (next) => onChange(rows.map((r, j) => (j === i ? next : r))), locked)}
          {locked ? null : (
            <div className="flex items-end">
              <Button onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                {`Remove ${lower} ${i + 1}`}
              </Button>
            </div>
          )}
        </fieldset>
      ))}
      {locked ? null : (
        <Button onClick={() => onChange([...rows, blank()])}>{`Add ${lower}`}</Button>
      )}
    </section>
  );
}
