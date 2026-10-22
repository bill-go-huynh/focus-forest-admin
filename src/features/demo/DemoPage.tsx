'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Button, ErrorMessage, Loading, PageTitle, Panel } from '../../components/ui';
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

/** What a fresh world gives the demo account (seeded by the API, spec/demo/PLAN.md). */
const SEEDED = [
  'Last month’s tree: the planting ceremony and the recap on first open',
  'This month’s tree, a 6-day streak and two earlier months in the forest',
  'Friends Mai, Khoa and Linh, followers, and reactions on the forest',
  'A waiting room from Mai with Khoa ready, and a demo event with a Community Tree',
];

/** Friends who react in turn, so each click shows a new face. */
const REACTORS = ['friend-linh', 'friend-mai', 'friend-khoa'] as const;

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
          <h2 className="text-lg font-semibold">Seed a demo account</h2>
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
        <World worlds={worlds.data.items} />
      )}
    </div>
  );
}

function World({ worlds }: { worlds: DemoWorld[] }) {
  const pickId = useId();
  const [chosen, setChosen] = useState<number | null>(null);
  const world = worlds.find((w) => w.id === chosen) ?? worlds[0]!;
  const main = world.accounts.find((a) => a.persona === 'main');
  const linh = world.accounts.find((a) => a.persona === 'friend-linh');
  return (
    <div className="space-y-4">
      <section aria-label="Demo account">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Demo account</h2>
              <p className="font-mono text-sm">{main?.email}</p>
              <p className="text-sm text-ink-2">
                {main?.signIn === 'google'
                  ? 'On the phone: Sign in, then Continue with Google with this email.'
                  : `On the phone: Sign in with this email and the password ${main?.password ?? ''}.`}
              </p>
            </div>
            {worlds.length > 1 ? (
              <div>
                <label htmlFor={pickId} className="block text-xs">
                  Demo world
                </label>
                <select
                  id={pickId}
                  className={input}
                  value={world.id}
                  onChange={(e) => setChosen(Number(e.target.value))}
                >
                  {worlds.map((w) => (
                    <option key={w.id} value={w.id}>{`World ${w.id}: ${
                      w.accounts.find((a) => a.persona === 'main')?.email ?? ''
                    }`}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {linh ? (
            <div
              role="group"
              aria-label="Second phone"
              className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-sm"
            >
              <p className="font-medium">{`Second phone (emulator): ${linh.name}, a friend`}</p>
              <p className="font-mono text-xs">{linh.email}</p>
              <p className="text-xs text-ink-2">{`Password ${linh.password ?? ''}`}</p>
            </div>
          ) : null}
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
            {SEEDED.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Keep the app open on the phone, signed in to this account: every button below shows
            there at once. Friends are driven from here; never sign in to them.
          </p>
        </Panel>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <TreeActions key={world.id} world={world} />
        </Panel>
        <Panel>
          <FriendActions key={world.id} world={world} />
        </Panel>
        <Panel>
          <NotifyActions key={world.id} world={world} />
        </Panel>
      </div>
    </div>
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

function TreeActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const id = useId();
  const [minutes, setMinutes] = useState('25');
  const { run, busy, line } = useOutcome();
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Tree and streak</h3>
      <p className="text-xs text-muted">
        A finished session grows the tree and the streak, with the celebration on the phone.
      </p>
      <div className="flex flex-wrap items-end gap-3">
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
          tone="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const m = Number(minutes);
              if (!Number.isInteger(m) || m < 5 || m > 180)
                throw new AdminApiError('http', 'Minutes are 5 to 180.');
              await api.demoSession(world.id, 'main', m);
              return `Added ${m} minutes. The phone shows it now.`;
            })
          }
        >
          Add a finished session
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.demoRestToday(world.id, 'main');
              return 'Today is a rest day.';
            })
          }
        >
          Make today a rest day
        </Button>
      </div>
      {line}
    </div>
  );
}

function FriendActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const [turn, setTurn] = useState(0);
  const { run, busy, line } = useOutcome();
  const name = (p: DemoPersona) => world.accounts.find((a) => a.persona === p)?.name ?? p;
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Friends and Focus Together</h3>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const friend = REACTORS[turn % REACTORS.length]!;
              await api.demoReact(world.id, friend);
              setTurn((t) => t + 1);
              return `${name(friend)} reacted to your forest.`;
            })
          }
        >
          A friend reacts to the forest
        </Button>
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
      </div>
      <p className="text-xs text-muted">
        The waiting room lasts 2 hours: open a fresh one just before the demo. Or create a room on
        the phone and have Khoa join it.
      </p>
      {line}
    </div>
  );
}

function NotifyActions({ world }: { world: DemoWorld }) {
  const api = useAdminApi();
  const { run, busy, line } = useOutcome();
  const describe = (r: DemoNotifyResult) =>
    r.status === 'sent'
      ? `Sent: “${r.title ?? ''}”`
      : `Not sent: ${REASONS[r.reason ?? ''] ?? r.reason ?? r.status}`;
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Send a notification now</h3>
      <p className="text-xs text-muted">
        Arrives on the phone in a few seconds; tapping it opens the matching screen.
      </p>
      <div className="flex flex-wrap gap-2">
        {DEMO_CATEGORIES.map((c) => (
          <Button
            key={c}
            disabled={busy}
            label={`Send: ${CATEGORY[c]}`}
            onClick={() =>
              void run(async () => describe(await api.demoNotify(world.id, 'main', c)))
            }
          >
            {CATEGORY[c]}
          </Button>
        ))}
      </div>
      {line}
    </div>
  );
}
