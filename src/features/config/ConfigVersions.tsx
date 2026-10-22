'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, SectionTitle, Table } from '../../components/ui';
import { instantLabel, stageLabel, valueLabel } from '../../lib/format';
import type { SampleTree } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

/** A sample month's results, each shown as "active → proposed" when they differ. */
const SAMPLE_COLUMNS: { head: string; read: (tree: SampleTree) => string }[] = [
  { head: 'Stage', read: (tree) => stageLabel(tree.stage) },
  { head: 'Fullness', read: (tree) => String(tree.fullnessLevel) },
  { head: 'Blossoms', read: (tree) => String(tree.blossomLevel) },
  { head: 'Richness', read: (tree) => String(tree.richnessTier) },
  { head: 'Traits', read: (tree) => (tree.traitIds.length ? tree.traitIds.join(', ') : '—') },
  { head: 'Active days', read: (tree) => String(tree.activeDays) },
  { head: 'Focus minutes', read: (tree) => String(tree.focusedMinutes) },
  { head: 'Growth minutes', read: (tree) => String(tree.growthMinutes) },
];

/**
 * Configuration versions (D6.3; docs/09 → Configuration): every version, a review of one against
 * the active version (the changed keys, and sample months grown with both rules), activation
 * with a confirmed reason, and proposals. Admins only. Activation is never retroactive: trees
 * keep the version they grew under (A6.6).
 */
export function ConfigVersions({ activeValues }: { activeValues: Record<string, unknown> }) {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [proposing, setProposing] = useState(false);
  const versions = useQuery({
    queryKey: ['config', 'versions'],
    queryFn: () => api.configVersions(),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['config'] });

  return (
    <>
      <SectionTitle>Versions</SectionTitle>
      <div className="mb-3">
        <Button onClick={() => setProposing(true)}>Propose a version</Button>
      </div>
      {versions.isError ? (
        <ErrorMessage error={versions.error} onRetry={() => void versions.refetch()} />
      ) : !versions.data ? (
        <Loading label="Loading versions" />
      ) : (
        <Table head={['Version', 'Note', 'Created', '']} label="Versions">
          {versions.data.items.map((row) => (
            <tr key={row.version}>
              <Cell>{`v${row.version}`}</Cell>
              <Cell>{row.note}</Cell>
              <Cell>{instantLabel(row.createdAt)}</Cell>
              <Cell>
                {row.active ? (
                  'Active'
                ) : (
                  <Button
                    label={`Review v${row.version}`}
                    onClick={() => setReviewing(row.version)}
                  >
                    Review
                  </Button>
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      {proposing ? (
        <ProposalForm
          activeValues={activeValues}
          onProposed={(version) => {
            setProposing(false);
            setReviewing(version);
            refresh();
          }}
          onClose={() => setProposing(false)}
        />
      ) : null}
      {reviewing !== null &&
      !versions.data?.items.some((row) => row.version === reviewing && row.active) ? (
        <VersionReview version={reviewing} onActivated={refresh} />
      ) : null}
    </>
  );
}

function VersionReview({ version, onActivated }: { version: number; onActivated: () => void }) {
  const api = useAdminApi();
  const [activating, setActivating] = useState(false);
  const diff = useQuery({
    queryKey: ['config', 'diff', version],
    queryFn: () => api.configDiff(version),
  });
  const preview = useQuery({
    queryKey: ['config', 'preview', version],
    queryFn: () => api.configPreview(version),
  });

  return (
    <section aria-labelledby={`review-${version}`} className="mt-6">
      <h2 id={`review-${version}`} className="mb-2 text-base font-semibold">
        {`Version ${version}`}
      </h2>
      {diff.isError ? (
        <ErrorMessage error={diff.error} onRetry={() => void diff.refetch()} />
      ) : !diff.data ? (
        <Loading label="Loading the changes" />
      ) : diff.data.changes.length === 0 ? (
        <p className="text-sm">{`No changes against v${diff.data.against}.`}</p>
      ) : (
        <Table head={['Key', 'Active', 'Proposed']} label={`Changes against v${diff.data.against}`}>
          {diff.data.changes.map((change) => (
            <tr key={change.key}>
              <Cell>
                <code>{change.key}</code>
              </Cell>
              <Cell>
                <code>{change.active === null ? '—' : valueLabel(change.active)}</code>
              </Cell>
              <Cell>
                <code>{change.proposed === null ? '—' : valueLabel(change.proposed)}</code>
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <h3 className="mb-2 mt-4 text-sm font-semibold">Sample months</h3>
      <p className="mb-2 text-xs text-muted">
        Each sample month grown with the active rules, then with these (active → proposed).
      </p>
      {preview.isError ? (
        <ErrorMessage error={preview.error} onRetry={() => void preview.refetch()} />
      ) : !preview.data ? (
        <Loading label="Growing the sample months" />
      ) : (
        <Table head={['Sample', ...SAMPLE_COLUMNS.map((c) => c.head)]} label="Sample months">
          {preview.data.samples.map((sample) => (
            <tr key={sample.id}>
              <Cell>{sample.label}</Cell>
              {SAMPLE_COLUMNS.map((column) => {
                const before = column.read(sample.active);
                const after = column.read(sample.proposed);
                return (
                  <Cell key={column.head}>
                    {before === after ? before : `${before} → ${after}`}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </Table>
      )}

      <div className="mt-4">
        <Button tone="primary" onClick={() => setActivating(true)}>
          {`Activate v${version}`}
        </Button>
      </div>
      {activating ? (
        <ConfirmDialog
          title={`Activate configuration v${version}?`}
          description="New growth uses it from now on. Trees already grown keep the version they grew under."
          action="Activate"
          tone="primary"
          onConfirm={async (reason) => {
            await api.activateConfig(version, reason);
            onActivated();
          }}
          onClose={() => setActivating(false)}
        />
      ) : null}
    </section>
  );
}

/** The whole configuration as JSON, starting from the active values, with a note and reason. */
function ProposalForm({
  activeValues,
  onProposed,
  onClose,
}: {
  activeValues: Record<string, unknown>;
  onProposed: (version: number) => void;
  onClose: () => void;
}) {
  const api = useAdminApi();
  const id = useId();
  const [values, setValues] = useState(() =>
    JSON.stringify(
      Object.fromEntries(Object.entries(activeValues).sort(([a], [b]) => a.localeCompare(b))),
      null,
      2,
    ),
  );
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setJsonError(null);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(values);
    } catch {
      // Not JSON: refused below with the same words.
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setJsonError('Values must be valid JSON: one object, key by key.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.proposeConfig(
        parsed as Record<string, unknown>,
        note.trim(),
        reason.trim(),
      );
      onProposed(created.version);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  const label = 'block text-xs font-medium';
  const input = 'w-full rounded-lg border border-line px-2 py-1 text-sm';
  return (
    <form
      aria-label="Propose a version"
      onSubmit={(e) => void submit(e)}
      className="my-4 max-w-3xl space-y-3 rounded-lg border border-line p-4"
    >
      <h3 className="text-sm font-semibold">Propose a version</h3>
      <p className="text-xs text-muted">
        The whole configuration, key by key. It is checked when proposed and changes nothing until
        activated.
      </p>
      <div className="space-y-1">
        <label htmlFor={`${id}-values`} className={label}>
          Values (JSON)
        </label>
        <textarea
          id={`${id}-values`}
          className={`${input} font-mono`}
          rows={16}
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-note`} className={label}>
          Note
        </label>
        <input
          id={`${id}-note`}
          className={input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className={label}>
          Reason
        </label>
        <input
          id={`${id}-reason`}
          className={input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {jsonError ? (
        <p
          role="alert"
          className="rounded-lg border border-line border-danger bg-danger-soft p-3 text-sm text-danger"
        >
          {jsonError}
        </p>
      ) : null}
      {error ? <ErrorMessage error={error} /> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" tone="primary" disabled={busy}>
          Propose
        </Button>
      </div>
    </form>
  );
}
