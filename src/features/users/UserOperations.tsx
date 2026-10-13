'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, Cell, ErrorMessage, Loading, Table } from '../../components/ui';
import { instantLabel } from '../../lib/format';
import { GRANT_KINDS, type GrantKind } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

const KIND_LABELS: Record<GrantKind, string> = {
  badge: 'Badge',
  cosmetic: 'Cosmetic',
  species: 'Species',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 mt-6 text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Why a notification did or did not reach someone (D6.3, A6.6): their devices (tokens masked),
 * the focus lease, what they turned on, and the recent notifications with why each was skipped.
 * Admins and support.
 */
export function NotificationDiagnostics({ userId }: { userId: string }) {
  const api = useAdminApi();
  const diagnostics = useQuery({
    queryKey: ['user', userId, 'notifications'],
    queryFn: () => api.notificationDiagnostics(userId),
  });

  return (
    <Section title="Notifications">
      {diagnostics.isError ? (
        <ErrorMessage error={diagnostics.error} onRetry={() => void diagnostics.refetch()} />
      ) : !diagnostics.data ? (
        <Loading label="Loading notification diagnostics" />
      ) : (
        <div className="space-y-3 text-sm">
          {diagnostics.data.devices.length === 0 ? (
            <p>No device registered.</p>
          ) : (
            <Table
              head={['Device', 'Platform', 'App version', 'Registered', 'Last seen']}
              label="Devices"
            >
              {diagnostics.data.devices.map((device) => (
                <tr key={device.token}>
                  <Cell>
                    <code>{device.token}</code>
                  </Cell>
                  <Cell>{device.platform}</Cell>
                  <Cell>{device.appVersion ?? '—'}</Cell>
                  <Cell>{instantLabel(device.registeredAt)}</Cell>
                  <Cell>{instantLabel(device.lastSeenAt)}</Cell>
                </tr>
              ))}
            </Table>
          )}
          <p>
            {diagnostics.data.focusUntil
              ? `Focusing until ${instantLabel(diagnostics.data.focusUntil)}`
              : 'Not focusing.'}
          </p>
          <p>
            {diagnostics.data.enabled.length === 0
              ? 'No notification turned on.'
              : `Turned on: ${diagnostics.data.enabled
                  .map((p) => (p.time ? `${p.category} (${p.time})` : p.category))
                  .join(', ')}`}
          </p>
          {diagnostics.data.recent.length === 0 ? (
            <p>No notification yet.</p>
          ) : (
            <Table
              head={['Due', 'Category', 'Title', 'Status', 'Why', 'Sent']}
              label="Recent notifications"
            >
              {diagnostics.data.recent.map((row, i) => (
                <tr key={`${row.notBefore}-${i}`}>
                  <Cell>{instantLabel(row.notBefore)}</Cell>
                  <Cell>{row.category}</Cell>
                  <Cell>{row.title}</Cell>
                  <Cell>{row.status}</Cell>
                  <Cell>{row.reason ?? '—'}</Cell>
                  <Cell>{row.sentAt ? instantLabel(row.sentAt) : '—'}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </Section>
  );
}

/**
 * A compensation grant after an incident (D6.3; docs/09 support actions): a badge, cosmetic, or
 * species, confirmed with a reason the API logs. Ownership is permanent. Admins only.
 */
export function CompensationGrant({ userId }: { userId: string }) {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const id = useId();
  const [kind, setKind] = useState<GrantKind>('badge');
  const [itemId, setItemId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [granted, setGranted] = useState<string | null>(null);
  const item = itemId.trim();

  return (
    <Section title="Compensation">
      <div className="flex max-w-xl items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-kind`} className="block text-xs font-medium">
            Kind
          </label>
          <select
            id={`${id}-kind`}
            className="rounded border px-2 py-1 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as GrantKind)}
          >
            {GRANT_KINDS.map((each) => (
              <option key={each} value={each}>
                {KIND_LABELS[each]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor={`${id}-item`} className="block text-xs font-medium">
            Item id
          </label>
          <input
            id={`${id}-item`}
            className="w-full rounded border px-2 py-1 text-sm"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          />
        </div>
        <Button
          disabled={item === ''}
          onClick={() => {
            setGranted(null);
            setConfirming(true);
          }}
        >
          Grant
        </Button>
      </div>
      {granted ? (
        <p role="status" className="mt-2 text-sm">
          {granted}
        </p>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={`Grant the ${kind} “${item}”?`}
          description="Use this to make up for an incident. Ownership is permanent; the grant is logged."
          action="Grant"
          tone="primary"
          onConfirm={async (reason) => {
            const result = await api.grant(userId, kind, item, reason);
            setGranted(`Granted the ${result.kind} ${result.itemId}.`);
            setItemId('');
            // The reward counts on this page change.
            void queryClient.invalidateQueries({ queryKey: ['user', userId], exact: true });
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Section>
  );
}
