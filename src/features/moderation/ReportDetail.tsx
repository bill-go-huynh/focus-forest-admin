'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useId, useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, ErrorMessage, Loading, PageTitle, SectionTitle } from '../../components/ui';
import {
  actionLabel,
  categoryLabel,
  instantLabel,
  personLabel,
  plural,
  reportStatusLabel,
  statusLabel,
} from '../../lib/format';
import type { ModerationAction, ReportDetail as Detail } from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

const ACTIONS: ModerationAction[] = [
  'none',
  'warn',
  'reset_username',
  'reset_bio',
  'reset_avatar',
  'suspend',
  'ban',
];

/** What confirming each decision asks, and what it does to the account. */
const CONFIRM: Record<ModerationAction, { title: string; description: string }> = {
  none: {
    title: 'Resolve the report without action?',
    description: 'The report is closed; the account is not changed.',
  },
  warn: {
    title: 'Warn this user and resolve the report?',
    description: 'The user reads your message in the app and acknowledges it.',
  },
  reset_username: {
    title: "Reset this user's username and resolve the report?",
    description: 'Their username is removed; they choose a new one.',
  },
  reset_bio: {
    title: "Reset this user's bio and resolve the report?",
    description: 'Their bio is cleared.',
  },
  reset_avatar: {
    title: "Reset this user's avatar and resolve the report?",
    description: 'Their avatar is removed.',
  },
  suspend: {
    title: 'Suspend this user and resolve the report?',
    description:
      "The user is signed out everywhere and can't sign in until an admin reactivates them.",
  },
  ban: {
    title: 'Ban this user and resolve the report?',
    description:
      "The user is signed out everywhere and can't sign in. Only an admin can lift a ban.",
  },
};

type Dialog = 'resolve' | 'dismiss' | null;

/**
 * One report (docs/09 → Reports and moderation): the report, the reported profile as it is now,
 * blocks between the two people, the reported user's history, and the decision. Every decision is
 * confirmed with a reason the API audits; a warning also needs the words the user will read.
 */
export function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const formId = useId();
  const [action, setAction] = useState<ModerationAction | ''>('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reviewError, setReviewError] = useState<unknown>(null);
  const report = useQuery({ queryKey: ['report', id], queryFn: () => api.report(id) });

  if (report.isError) {
    return <ErrorMessage error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <Loading label="Loading the report" />;
  const detail = report.data;
  const open = detail.status === 'open' || detail.status === 'in_review';

  const show = (next: Detail): void => {
    queryClient.setQueryData(['report', id], next);
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };
  const review = async () => {
    setReviewError(null);
    try {
      show(await api.reviewReport(id));
    } catch (error) {
      setReviewError(error);
    }
  };
  const ready = action !== '' && (action !== 'warn' || message.trim().length > 0);

  return (
    <>
      <PageTitle>{`${categoryLabel(detail.category)} report`}</PageTitle>
      <dl className="grid max-w-3xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Status</dt>
        <dd>{statusText(detail)}</dd>
        {detail.resolution ? (
          <>
            <dt>Decided</dt>
            <dd>{`${instantLabel(detail.resolution.resolvedAt)} by ${detail.resolution.resolvedBy ?? 'a removed admin'}`}</dd>
            {detail.status === 'resolved' ? (
              <>
                <dt>Reason</dt>
                <dd>{detail.resolution.reason}</dd>
              </>
            ) : null}
          </>
        ) : null}
        <dt>Filed</dt>
        <dd>{instantLabel(detail.createdAt)}</dd>
        <dt>Details</dt>
        <dd>{detail.details ?? '—'}</dd>
        <dt>Reporter</dt>
        <dd>{detail.reporter ? personLabel(detail.reporter) : 'Deleted account'}</dd>
        <dt>Reported user</dt>
        <dd>
          <Link href={`/users/${detail.target.id}`} className="underline">
            {detail.target.email}
          </Link>
        </dd>
      </dl>

      <SectionTitle>Reported profile, as it is now</SectionTitle>
      <dl className="grid max-w-3xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Username</dt>
        <dd>{detail.targetProfile.username ? `@${detail.targetProfile.username}` : '—'}</dd>
        <dt>Name</dt>
        <dd>{detail.targetProfile.displayName ?? '—'}</dd>
        <dt>Bio</dt>
        <dd>{detail.targetProfile.bio ?? '—'}</dd>
        <dt>Avatar</dt>
        <dd>{detail.targetProfile.avatarUrl ? 'Custom avatar' : 'None'}</dd>
        <dt>Blocks</dt>
        <dd>{blocksText(detail.blocks)}</dd>
        <dt>History</dt>
        <dd>{`${plural(detail.targetHistory.reports, 'report')}, ${plural(detail.targetHistory.warnings, 'warning')}, ${statusLabel(detail.targetHistory.status)}`}</dd>
      </dl>

      {open ? (
        <>
          <SectionTitle>Decision</SectionTitle>
          {detail.status === 'open' ? (
            <div className="mb-3">
              <Button onClick={() => void review()}>Start review</Button>
              {reviewError ? <ErrorMessage error={reviewError} /> : null}
            </div>
          ) : null}
          <div className="max-w-xl space-y-2 text-sm">
            <label htmlFor={`${formId}-action`} className="block font-medium">
              Action
            </label>
            <select
              id={`${formId}-action`}
              value={action}
              onChange={(event) => setAction(event.target.value as ModerationAction | '')}
              className="rounded border p-1.5"
            >
              <option value="">Choose an action</option>
              {ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {actionLabel(value)}
                </option>
              ))}
            </select>
            {action === 'warn' ? (
              <>
                <label htmlFor={`${formId}-message`} className="block font-medium">
                  Message to the user
                </label>
                <textarea
                  id={`${formId}-message`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded border p-2"
                />
              </>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button tone="danger" disabled={!ready} onClick={() => setDialog('resolve')}>
                Resolve…
              </Button>
              <Button onClick={() => setDialog('dismiss')}>Dismiss…</Button>
            </div>
          </div>
        </>
      ) : null}

      {dialog === 'resolve' && action !== '' ? (
        <ConfirmDialog
          title={CONFIRM[action].title}
          description={CONFIRM[action].description}
          action="Resolve report"
          tone={action === 'none' ? 'primary' : 'danger'}
          onConfirm={async (reason) =>
            show(
              await api.resolveReport(
                id,
                action,
                reason,
                action === 'warn' ? message.trim() : undefined,
              ),
            )
          }
          onClose={() => setDialog(null)}
        />
      ) : dialog === 'dismiss' ? (
        <ConfirmDialog
          title="Dismiss this report?"
          description="The report is closed without action."
          action="Dismiss report"
          tone="primary"
          onConfirm={async (reason) => show(await api.dismissReport(id, reason))}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function statusText(detail: Detail): string {
  if (detail.status === 'in_review') {
    return detail.reviewedBy ? `In review by ${detail.reviewedBy}` : 'In review';
  }
  if (detail.status === 'resolved' && detail.resolution) {
    return `Resolved: ${actionLabel(detail.resolution.action ?? 'none')}`;
  }
  if (detail.status === 'dismissed' && detail.resolution) {
    return `Dismissed: ${detail.resolution.reason}`;
  }
  return reportStatusLabel(detail.status);
}

function blocksText(blocks: Detail['blocks']): string {
  if (blocks.reporterBlocksTarget && blocks.targetBlocksReporter) return 'They block each other';
  if (blocks.reporterBlocksTarget) return 'The reporter blocks this user';
  if (blocks.targetBlocksReporter) return 'This user blocks the reporter';
  return 'No blocks between them';
}
