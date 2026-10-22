'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Button, ErrorMessage, Loading, PageTitle, Panel, SectionTitle } from '../../components/ui';
import { AdminApiError } from '../../lib/api';
import {
  DEMO_CATEGORIES,
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

const input = 'px-3 py-1.5 text-sm';
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
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async (event?: FormEvent) => {
    event?.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      await api.makeDemoWorld('Demo', email.trim() || undefined);
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['demo', 'worlds'] });
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <Panel>
        <form onSubmit={(e) => void make(e)} className="max-w-2xl space-y-3">
          <h2 className="text-lg font-semibold">New demo world</h2>
          <p className="text-sm text-ink-2">
            One account with months of history, friends, followers, a waiting room and a demo event,
            ready to show every step. Each demo uses a fresh world: what it shows happens once, as
            in the app.
          </p>
          <label htmlFor={emailId} className="block text-sm font-medium">
            Email to seed
          </label>
          <input
            id={emailId}
            type="email"
            className={`${input} w-full`}
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted">
            Sign in on the phone with Google using this email. Leave it blank for a demo address
            (password focus-forest-demo). An email that already has an account is refused.
          </p>
          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          ) : null}
          <Button tone="primary" type="submit" disabled={busy}>
            Make a demo world
          </Button>
        </form>
      </Panel>

      {worlds.isError ? (
        <ErrorMessage error={worlds.error} onRetry={() => void worlds.refetch()} />
      ) : !worlds.data ? (
        <Loading label="Loading demo worlds" />
      ) : worlds.data.items.length === 0 ? (
        <p className="text-sm text-muted">No demo world yet.</p>
      ) : (
        worlds.data.items.map((world) => <World key={world.id} world={world} />)
      )}
    </div>
  );
}

function World({ world }: { world: DemoWorld }) {
  const title = `Demo world ${world.id}`;
  return (
    <section className="space-y-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table aria-label={title} className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2.5">Account</th>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Sign in</th>
              <th className="px-3 py-2.5">What it shows</th>
            </tr>
          </thead>
          <tbody>
            {world.accounts.map((a) => (
              <tr key={a.userId} className="border-t border-line align-top">
                <td className="px-3 py-2.5 font-medium">{`${PERSONA[a.persona].label}: ${a.name}`}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{a.email}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.signIn === 'google'
                        ? 'bg-forest-soft text-forest-deep'
                        : 'bg-amber-soft text-amber'
                    }`}
                  >
                    {a.signIn === 'google' ? 'Google' : `Password: ${a.password ?? ''}`}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ink-2">{PERSONA[a.persona].shows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Keep the app open on the phone, signed in to the account: what you do below shows there at
        once.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <AccountActions world={world} />
        </Panel>
        <Panel>
          <NotifyActions world={world} />
        </Panel>
        <Panel>
          <TogetherActions world={world} />
        </Panel>
      </div>
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
    <p role="status" className={`text-sm ${outcome.ok ? 'text-forest-strong' : 'text-danger'}`}>
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
      <h3 className="text-base font-semibold">Change an account</h3>
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
      <h3 className="text-base font-semibold">Send a notification now</h3>
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
      <h3 className="text-base font-semibold">Focus Together</h3>
      <p className="text-xs text-muted">
        The world starts with a waiting room Mai opened, the presenter invited and Khoa ready. A
        waiting room lasts 2 hours: open a fresh one before the demo.
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await api.demoRoom(world.id);
            return 'Mai opened a new waiting room and invited you; Khoa is ready in it.';
          })
        }
      >
        Open a fresh waiting room
      </Button>
      <p className="text-xs text-muted">
        Or open a room on the phone (Together, Create a room), then:
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
