'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Button, ErrorMessage, Loading, PageTitle, SectionTitle } from '../../components/ui';
import { AdminApiError } from '../../lib/api';
import {
  DEMO_CATEGORIES,
  DEMO_PERSONAS,
  type DemoCategory,
  type DemoNotifyResult,
  type DemoPersona,
  type DemoWorld,
} from '../../lib/schemas';
import { useAdminApi } from '../../lib/session';

/**
 * DM.2 Demo tools (spec/demo/PLAN.md): make a demo world, see what each account shows, and change
 * an account so its open phone shows it at once. On only when the API runs with DEMO_TOOLS=on,
 * which belongs on a local or demo server, never where real people use the app.
 */

const PERSONA: Record<DemoPersona, { label: string; name: string; shows: string }> = {
  main: {
    label: 'Presenter',
    name: 'Bill',
    shows:
      'First open: the planting ceremony and last month’s recap. Then one 25-minute session: a Mature Tree, the 50 Hours badge with Maple, and a 7-day streak with Pine; the demo Community Tree reaches its first milestone.',
  },
  comeback: {
    label: 'Comeback',
    name: 'An',
    shows: 'The tree is Resting quietly after three days away; one session wakes it (“Waking up”).',
  },
  recovery: {
    label: 'Recovery',
    name: 'Vy',
    shows: 'Missed only yesterday after 4 days: one session today offers “Keep my streak”.',
  },
  'friend-mai': {
    label: 'Friend',
    name: 'Mai',
    shows: 'Follows the presenter back; invites to challenges and rooms.',
  },
  'friend-khoa': {
    label: 'Friend',
    name: 'Khoa',
    shows: 'Joins the presenter’s room and gets ready.',
  },
  'friend-linh': { label: 'Friend', name: 'Linh', shows: 'Reacts to the presenter’s forest.' },
};

const CATEGORY: Record<DemoCategory, string> = {
  dailyGoalReminder: 'Daily goal reminder',
  scheduledFocusReminder: 'Scheduled focus reminder',
  streakReminder: 'Streak reminder',
  eventStart: 'Event starts',
  eventEndingSoon: 'Event ending soon',
  friendInvite: 'Friend invites to a challenge',
  focusRoomInvite: 'Friend invites to a focus room',
  challengeUpdate: 'A friend joined your challenge',
  badgeUnlocked: 'Badge unlocked',
  monthlyRecapReady: 'Monthly recap ready',
};

const REASONS: Record<string, string> = {
  no_device:
    'No phone is registered for this account. Open the app on the phone, signed in to it, and allow notifications.',
  disabled: 'The category is off for this account.',
  not_relevant: 'It no longer applies (for example, today’s goal is already met).',
  daily_limit: 'The daily limit was reached.',
  PushDisabled: 'The API sends no push: set PUSH_PROVIDER=expo.',
};

const input = 'rounded border px-2 py-1 text-sm';
const messageOf = (error: unknown) =>
  error instanceof AdminApiError ? error.message : 'Something went wrong. Try again.';

export function DemoPage() {
  const api = useAdminApi();
  const status = useQuery({ queryKey: ['demo', 'status'], queryFn: () => api.demoStatus() });
  return (
    <>
      <PageTitle>Demo</PageTitle>
      {status.isError ? (
        <ErrorMessage error={status.error} onRetry={() => void status.refetch()} />
      ) : !status.data ? (
        <Loading label="Loading demo tools" />
      ) : !status.data.enabled ? (
        <p className="max-w-prose text-sm">
          Demo tools are off. Start the API with DEMO_TOOLS=on, only on a local or demo server,
          never where real people use the app.
        </p>
      ) : (
        <DemoWorlds />
      )}
    </>
  );
}

function DemoWorlds() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const worlds = useQuery({ queryKey: ['demo', 'worlds'], queryFn: () => api.demoWorlds() });
  const passwordId = useId();
  const [password, setPassword] = useState('');
  const [emails, setEmails] = useState<Partial<Record<DemoPersona, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async (event?: FormEvent) => {
    event?.preventDefault();
    if (password.length < 8) return setProblem('Use at least 8 characters.');
    setProblem(null);
    setBusy(true);
    try {
      // Blank ones are left out: the API gives those accounts demoN…@focusforest.test.
      const entered = Object.fromEntries(
        DEMO_PERSONAS.flatMap((p) => (emails[p]?.trim() ? [[p, emails[p].trim()]] : [])),
      );
      await api.makeDemoWorld(
        password,
        'Demo',
        Object.keys(entered).length > 0 ? entered : undefined,
      );
      setEmails({});
      await queryClient.invalidateQueries({ queryKey: ['demo', 'worlds'] });
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => void make(e)} className="max-w-xl space-y-2">
        <SectionTitle>New demo world</SectionTitle>
        <p className="text-sm text-neutral-700">
          Six accounts with history, and a demo event. Each demo uses a fresh world: what it shows
          happens once, as in the app. Enter the emails you want to sign in with, or leave them
          blank; an email that already has an account is refused.
        </p>
        <label htmlFor={passwordId} className="block text-sm">
          Password for the demo accounts
        </label>
        <input
          id={passwordId}
          type="text"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <EmailField
          persona="main"
          value={emails.main ?? ''}
          onChange={(main) => setEmails((all) => ({ ...all, main }))}
        />
        <details className="text-sm">
          <summary className="cursor-pointer">Emails for the other accounts</summary>
          <div className="mt-2 space-y-2">
            {DEMO_PERSONAS.filter((p) => p !== 'main').map((p) => (
              <EmailField
                key={p}
                persona={p}
                value={emails[p] ?? ''}
                onChange={(email) => setEmails((all) => ({ ...all, [p]: email }))}
              />
            ))}
          </div>
        </details>
        {problem ? (
          <p role="alert" className="text-sm text-red-800">
            {problem}
          </p>
        ) : null}
        <Button tone="primary" type="submit" disabled={busy}>
          Make a demo world
        </Button>
      </form>

      {worlds.isError ? (
        <ErrorMessage error={worlds.error} onRetry={() => void worlds.refetch()} />
      ) : !worlds.data ? (
        <Loading label="Loading demo worlds" />
      ) : worlds.data.items.length === 0 ? (
        <p className="text-sm">No demo world yet.</p>
      ) : (
        worlds.data.items.map((world) => <World key={world.id} world={world} />)
      )}
    </div>
  );
}

/**
 * The address to sign in with on the phone. Optional: left blank, the account gets
 * demoN…@focusforest.test. An address that already has an account is refused, so a real
 * account is never changed.
 */
function EmailField({
  persona,
  value,
  onChange,
}: {
  persona: DemoPersona;
  value: string;
  onChange: (email: string) => void;
}) {
  const id = useId();
  const { label, name } = PERSONA[persona];
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm">
        Email for {label} ({name})
      </label>
      <input
        id={id}
        type="email"
        className={`${input} w-full`}
        placeholder="Leave blank for a demo…@focusforest.test address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function World({ world }: { world: DemoWorld }) {
  const title = `Demo world ${world.id}`;
  return (
    <section className="space-y-4 border-t pt-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto">
        <table aria-label={title} className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-1 pr-4">Account</th>
              <th className="py-1 pr-4">Sign in with</th>
              <th className="py-1">What it shows</th>
            </tr>
          </thead>
          <tbody>
            {world.accounts.map((a) => (
              <tr key={a.userId} className="border-t align-top">
                <td className="py-1 pr-4">{`${PERSONA[a.persona].label}: ${a.name}`}</td>
                <td className="py-1 pr-4 font-mono">{a.email}</td>
                <td className="py-1">{PERSONA[a.persona].shows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-600">
        Keep the app open on the phone, signed in to the account: what you do below shows there at
        once.
      </p>
      <AccountActions world={world} />
      <NotifyActions world={world} />
      <TogetherActions world={world} />
    </section>
  );
}

/** Runs an action and keeps its outcome as one line, the API's own words on failure. */
function useOutcome() {
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      setOutcome({ ok: true, text: await action() });
    } catch (error) {
      setOutcome({ ok: false, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };
  const line: ReactNode = outcome ? (
    <p role="status" className={`text-sm ${outcome.ok ? 'text-green-800' : 'text-red-800'}`}>
      {outcome.text}
    </p>
  ) : null;
  return { run, busy, line };
}

function PersonaSelect({
  id,
  value,
  onChange,
  options,
  world,
}: {
  id: string;
  value: DemoPersona;
  onChange: (p: DemoPersona) => void;
  options: readonly DemoPersona[];
  world: DemoWorld;
}) {
  const name = (p: DemoPersona) => world.accounts.find((a) => a.persona === p)?.name ?? p;
  return (
    <select
      id={id}
      className={input}
      value={value}
      onChange={(e) => onChange(e.target.value as DemoPersona)}
    >
      {options.map((p) => (
        <option key={p} value={p}>{`${name(p)} (${PERSONA[p].label})`}</option>
      ))}
    </select>
  );
}

const PRESENTERS = ['main', 'comeback', 'recovery'] as const;
const FRIENDS = ['friend-mai', 'friend-khoa', 'friend-linh'] as const;

function AccountActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const id = useId();
  const [persona, setPersona] = useState<DemoPersona>('main');
  const [minutes, setMinutes] = useState('25');
  const [friend, setFriend] = useState<DemoPersona>('friend-mai');
  const { run, busy, line } = useOutcome();
  const name = (p: DemoPersona) => world.accounts.find((a) => a.persona === p)?.name ?? p;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Change an account</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-who`} className="block text-xs">
            Account
          </label>
          <PersonaSelect
            id={`${id}-who`}
            value={persona}
            onChange={setPersona}
            options={PRESENTERS}
            world={world}
          />
        </div>
        <div>
          <label htmlFor={`${id}-min`} className="block text-xs">
            Minutes
          </label>
          <input
            id={`${id}-min`}
            className={`${input} w-20`}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const m = Number(minutes);
              if (!Number.isInteger(m) || m < 5 || m > 180)
                throw new AdminApiError('http', 'Minutes are 5 to 180.');
              await api.demoSession(world.id, persona, m);
              return `Added ${m} minutes for ${name(persona)}. The phone shows it now.`;
            })
          }
        >
          Add a finished session
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.demoRestToday(world.id, persona);
              return `Today is a rest day for ${name(persona)}.`;
            })
          }
        >
          Make today a rest day
        </Button>
        <div>
          <label htmlFor={`${id}-friend`} className="block text-xs">
            Friend
          </label>
          <PersonaSelect
            id={`${id}-friend`}
            value={friend}
            onChange={setFriend}
            options={FRIENDS}
            world={world}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.demoReact(world.id, friend);
              return `${name(friend)} reacted to ${name('main')}’s forest.`;
            })
          }
        >
          Friend reacts to the forest
        </Button>
      </div>
      {line}
    </div>
  );
}

function NotifyActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const id = useId();
  const [category, setCategory] = useState<DemoCategory>('monthlyRecapReady');
  const [persona, setPersona] = useState<DemoPersona>('main');
  const { run, busy, line } = useOutcome();
  const describe = (r: DemoNotifyResult) =>
    r.status === 'sent'
      ? `Sent: “${r.title ?? ''}”`
      : `Not sent: ${REASONS[r.reason ?? ''] ?? r.reason ?? r.status}`;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Send a notification now</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-cat`} className="block text-xs">
            Notification
          </label>
          <select
            id={`${id}-cat`}
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value as DemoCategory)}
          >
            {DEMO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="block text-xs">
            To
          </label>
          <PersonaSelect
            id={`${id}-to`}
            value={persona}
            onChange={setPersona}
            options={PRESENTERS}
            world={world}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => describe(await api.demoNotify(world.id, persona, category)))
          }
        >
          Send now
        </Button>
      </div>
      {line}
    </div>
  );
}

function TogetherActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const { run, busy, line } = useOutcome();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Focus Together</h3>
      <p className="text-xs text-neutral-600">
        Open a room on the phone first (Together, Create a room).
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await api.demoFriendReady(world.id);
            return 'Khoa is in your room and ready: when you are ready too, the countdown starts.';
          })
        }
      >
        Khoa joins my room and is ready
      </Button>
      {line}
    </div>
  );
}
