'use client';

import { useId, useState, type FormEvent } from 'react';

import { Button, ErrorMessage } from '../../components/ui';
import type { CatalogItem, CatalogKind } from '../../lib/schemas';
import { CATALOG_FIELDS, type FieldSpec } from './catalog-fields';

type Value = string | number | boolean | null;

/**
 * Creating or editing one catalog item. A new item asks for every field; an edit shows only
 * what may change and sends only what changed, always with a reason the API audits (docs/09).
 */
export function CatalogForm({
  kind,
  title,
  item,
  onSubmit,
  onClose,
}: {
  kind: CatalogKind;
  title: string;
  item: CatalogItem | null;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const fields = CATALOG_FIELDS[kind].filter((field) => !item || field.editable);
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(
      fields.map((field) => [field.name, item ? (item[field.name] ?? null) : field.initial]),
    ),
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const changed = item
      ? fields.filter((field) => values[field.name] !== (item[field.name] ?? null))
      : fields;
    try {
      await onSubmit({
        ...Object.fromEntries(changed.map((field) => [field.name, values[field.name]])),
        reason: reason.trim(),
      });
      onClose();
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  const input = (field: FieldSpec) => {
    const fieldId = `${id}-${field.name}`;
    const value = values[field.name];
    const set = (next: Value) => setValues((old) => ({ ...old, [field.name]: next }));
    const common = { id: fieldId, className: 'w-full rounded border px-2 py-1 text-sm' };
    let control;
    if (field.type === 'select') {
      control = (
        <select {...common} value={String(value ?? '')} onChange={(e) => set(e.target.value)}>
          {field.options!.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'checkbox') {
      control = (
        <input
          id={fieldId}
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(e.target.checked)}
        />
      );
    } else if (field.type === 'textarea') {
      control = (
        <textarea {...common} value={String(value ?? '')} onChange={(e) => set(e.target.value)} />
      );
    } else if (field.type === 'number') {
      control = (
        <input
          {...common}
          type="number"
          value={String(value ?? '')}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    } else {
      // Text; an empty instant or reference means none.
      const nullable = field.type === 'instant' || field.type === 'ref';
      control = (
        <input
          {...common}
          placeholder={field.type === 'instant' ? '2026-11-01T00:00:00.000Z' : undefined}
          value={String(value ?? '')}
          onChange={(e) => set(nullable && e.target.value.trim() === '' ? null : e.target.value)}
        />
      );
    }
    return (
      <div key={field.name} className="space-y-1">
        <label htmlFor={fieldId} className="block text-xs font-medium">
          {field.label}
        </label>
        {control}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/30 p-4">
      <form
        aria-label={title}
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-lg space-y-3 rounded bg-white p-4 text-neutral-900 shadow"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="grid grid-cols-2 gap-3">{fields.map(input)}</div>
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
            {item ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
