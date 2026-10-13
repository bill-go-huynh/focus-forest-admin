import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { EventDetail } from '../features/live/EventDetail';
import { LivePage } from '../features/live/LivePage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D6.2 Live operations (docs/09 later admin: events and missions, Community Tree, seasonal
 * themes, leaderboards with exclusions). Content staff and admins run them; what people have
 * taken part in is locked, and the page says why.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  sessionStorage.clear();
  navigation.push.mockReset();
  navigation.params = {};
});

const ok = (body: unknown, status = 200): Reply => ({ status, body });
const api = (routes: Record<string, Reply | ((r: Recorded) => Reply)>) =>
  fakeApi((request) => {
    const route = routes[`${request.method} ${request.path}`];
    if (!route)
      return {
        status: 500,
        body: nestError(500, `Not scripted: ${request.method} ${request.path}`),
      };
    return typeof route === 'function' ? route(request) : route;
  });
const links = () =>
  within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent);

const SUMMARY = {
  id: 'autumn-focus',
  name: 'Autumn Focus',
  status: 'active',
  startsAt: '2026-10-20T00:00:00.000Z',
  endsAt: '2026-11-03T00:00:00.000Z',
  leaderboard: true,
  participants: 2,
  locked: true,
};
const OPEN_SUMMARY = {
  ...SUMMARY,
  id: 'winter-week',
  name: 'Winter Week',
  status: 'planned',
  startsAt: '2026-12-07T00:00:00.000Z',
  endsAt: '2026-12-14T00:00:00.000Z',
  leaderboard: false,
  participants: 0,
  locked: false,
};
const EVENT = {
  ...SUMMARY,
  description: 'Focus through autumn.',
  artworkId: 'autumn-focus',
  entryMinSessions: 0,
  teams: [],
  missions: [
    {
      id: 'minutes',
      measure: 'focus_minutes',
      target: 300,
      dailyMinutes: 0,
      name: '300 minutes',
      description: 'Focus for 300 minutes.',
    },
  ],
  milestones: [
    {
      id: 'done',
      name: 'Done',
      requiredMissions: 1,
      badgeId: 'autumn-badge',
      cosmeticId: null,
      traitId: null,
    },
  ],
  communityTree: {
    name: 'Autumn Grove',
    artworkId: 'grove',
    totalMinutes: 1200,
    contributors: 3,
    milestones: [
      {
        stage: 'seedling',
        thresholdMinutes: 1000,
        badgeId: 'grove-seedling',
        reachedAt: '2026-10-25T10:00:00.000Z',
      },
      { stage: 'bloom', thresholdMinutes: 5000, badgeId: 'grove-bloom', reachedAt: null },
    ],
  },
};
const OPEN_EVENT = {
  ...EVENT,
  ...OPEN_SUMMARY,
  missions: [],
  milestones: [],
  communityTree: null,
};
const THEMES = [
  {
    id: 'autumn',
    name: 'Autumn',
    description: 'Falling leaves.',
    environmentId: 'autumn',
    hemisphere: 'north',
    status: 'active',
    startsAt: '2026-09-22T00:00:00.000Z',
    endsAt: '2026-12-21T00:00:00.000Z',
    rewards: [{ id: 'leaf', badgeId: 'autumn-leaf', requiredActiveDays: 10 }],
    started: true,
  },
  {
    id: 'lunar',
    name: 'Lunar New Year',
    description: 'Lanterns.',
    environmentId: 'lantern',
    hemisphere: null,
    status: 'planned',
    startsAt: '2027-01-10T00:00:00.000Z',
    endsAt: '2027-01-24T00:00:00.000Z',
    rewards: [],
    started: false,
  },
];
const PERSON = (id: string, name: string) => ({
  id,
  username: name.toLowerCase(),
  displayName: name,
  avatarUrl: null,
});
const BOARD = {
  scope: 'global',
  period: { kind: 'weekly', startDate: '2026-10-12', endDate: '2026-10-18' },
  rows: [
    { rank: 1, person: PERSON('u-1', 'Ada'), score: 900 },
    { rank: 2, person: PERSON('u-2', 'Cheat'), score: 880 },
  ],
  teams: null,
};
const EXCLUSION = {
  user: { id: 'u-9', email: 'bot@example.com', username: 'bot', displayName: 'Bot' },
  reason: 'Scripted sessions',
  excludedAt: '2026-10-10T09:00:00.000Z',
  by: 'admin@example.com',
};

describe('roles (D6.2)', { timeout: 15_000 }, () => {
  it('shows content staff and admins Live; support and moderators never', () => {
    const { fetch } = api({});
    const shown = (role: 'admin' | 'support' | 'moderator' | 'content') => {
      const view = renderAdmin(<AdminShell>live</AdminShell>, { fetch, signedIn: session(role) });
      const names = links();
      view.unmount();
      return names.includes('Live');
    };
    expect(shown('content')).toBe(true);
    expect(shown('admin')).toBe(true);
    expect(shown('support')).toBe(false);
    expect(shown('moderator')).toBe(false);
  });

  it('places Live right after Content', () => {
    renderAdmin(<AdminShell>live</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('content'),
    });
    expect(links()).toEqual(['Dashboard', 'Content', 'Live']);
  });
});

describe('events (D6.2)', { timeout: 15_000 }, () => {
  it('lists events with their window, people, and lock, and a calendar by month', async () => {
    const { fetch } = api({ 'GET /admin/live/events': ok({ items: [OPEN_SUMMARY, SUMMARY] }) });
    renderAdmin(<LivePage />, { fetch, signedIn: session('content') });

    const row = (await screen.findByRole('link', { name: 'Autumn Focus' })).closest('tr')!;
    expect(screen.getByRole('link', { name: 'Autumn Focus' }).getAttribute('href')).toBe(
      '/live/events/autumn-focus',
    );
    expect(within(row).getByText('Active')).toBeDefined();
    expect(within(row).getByText('2026-10-20 00:00 UTC – 2026-11-03 00:00 UTC')).toBeDefined();
    expect(within(row).getByText('2')).toBeDefined();
    expect(within(row).getByText('Locked')).toBeDefined();
    const open = screen.getByRole('link', { name: 'Winter Week' }).closest('tr')!;
    expect(within(open).queryByText('Locked')).toBeNull();

    const calendar = screen.getByRole('region', { name: 'Calendar' });
    expect(
      within(calendar)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Oct 2026', 'Nov 2026', 'Dec 2026']);
    expect(within(calendar).getByText('Autumn Focus · 1–2')).toBeDefined();
  });

  it('creates an event with missions, showing every problem the API names', async () => {
    let attempts = 0;
    const { fetch, requests } = api({
      'GET /admin/live/events': ok({ items: [] }),
      'POST /admin/live/events': () => {
        attempts += 1;
        return attempts === 1
          ? ok(
              {
                ...nestError(422, 'missions[0].target must be a whole number.', 'invalid_content'),
                problems: [
                  'missions[0].target must be a whole number from 1 to 1000000.',
                  'The event winter-week ends before it starts.',
                ],
              },
              422,
            )
          : ok(OPEN_EVENT, 201);
      },
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('content') });
    await screen.findByText('No events yet.');

    fireEvent.click(screen.getByRole('button', { name: 'New event' }));
    const form = screen.getByRole('form', { name: 'New event' });
    const field = (label: string) => within(form).getByLabelText(label);
    fireEvent.change(field('Id'), { target: { value: 'winter-week' } });
    fireEvent.change(field('Event name'), { target: { value: 'Winter Week' } });
    fireEvent.change(field('Description'), { target: { value: 'A week of winter focus.' } });
    fireEvent.change(field('Artwork id'), { target: { value: 'winter-week' } });
    fireEvent.change(field('Starts at'), { target: { value: '2026-12-07T00:00:00.000Z' } });
    fireEvent.change(field('Ends at'), { target: { value: '2026-12-14T00:00:00.000Z' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add mission' }));
    const mission = within(form).getByRole('group', { name: 'Mission 1' });
    fireEvent.change(within(mission).getByLabelText('Id'), { target: { value: 'sessions' } });
    fireEvent.change(within(mission).getByLabelText('Measure'), {
      target: { value: 'sessions' },
    });
    fireEvent.change(within(mission).getByLabelText('Target'), { target: { value: '' } });
    fireEvent.change(within(mission).getByLabelText('Name'), {
      target: { value: 'Five sessions' },
    });
    fireEvent.change(within(mission).getByLabelText('Description'), {
      target: { value: 'Five counted sessions.' },
    });
    fireEvent.change(field('Reason'), { target: { value: 'December event' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'missions[0].target must be a whole number from 1 to 1000000.',
      'The event winter-week ends before it starts.',
    ]);

    fireEvent.change(within(mission).getByLabelText('Target'), { target: { value: '5' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/live/events/winter-week'));
    expect(requests.filter((r) => r.method === 'POST').at(-1)!.body).toEqual({
      id: 'winter-week',
      name: 'Winter Week',
      description: 'A week of winter focus.',
      artworkId: 'winter-week',
      status: 'planned',
      startsAt: '2026-12-07T00:00:00.000Z',
      endsAt: '2026-12-14T00:00:00.000Z',
      entryMinSessions: 0,
      leaderboard: false,
      teams: [],
      missions: [
        {
          id: 'sessions',
          measure: 'sessions',
          target: 5,
          dailyMinutes: 0,
          name: 'Five sessions',
          description: 'Five counted sessions.',
        },
      ],
      milestones: [],
      communityTree: null,
      reason: 'December event',
    });
  });
});

describe('an event (D6.2)', { timeout: 15_000 }, () => {
  it('monitors the Community Tree', async () => {
    navigation.params = { id: 'autumn-focus' };
    const { fetch } = api({ 'GET /admin/live/events/autumn-focus': ok(EVENT) });
    renderAdmin(<EventDetail />, { fetch, signedIn: session('content') });

    const monitor = await screen.findByRole('region', { name: 'Community Tree' });
    expect(within(monitor).getByText('Autumn Grove')).toBeDefined();
    expect(within(monitor).getByText('1,200 minutes from 3 people')).toBeDefined();
    const rows = within(monitor).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Seedling1,000grove-seedlingReached 2026-10-25 10:00 UTC',
      'Bloom5,000grove-bloom3,800 minutes to go',
    ]);
  });

  it('locks what people took part in, says why, and saves only what changed', async () => {
    navigation.params = { id: 'autumn-focus' };
    const { fetch, requests } = api({
      'GET /admin/live/events/autumn-focus': ok(EVENT),
      'PATCH /admin/live/events/autumn-focus': ok({ ...EVENT, name: 'Autumn' }),
    });
    renderAdmin(<EventDetail />, { fetch, signedIn: session('content') });
    const form = await screen.findByRole('form', { name: 'Edit Autumn Focus' });

    expect(within(form).getAllByText('Locked: people have taken part.').length).toBeGreaterThan(0);
    expect((within(form).getByLabelText('Starts at') as HTMLInputElement).disabled).toBe(true);
    expect(
      (within(form).getByLabelText('Entry: counted sessions') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(within(form).queryByRole('button', { name: 'Add mission' })).toBeNull();
    expect((within(form).getByLabelText('Event name') as HTMLInputElement).disabled).toBe(false);
    expect(within(form).getByText('The end can only move later.')).toBeDefined();
    // Nobody can delete what people have joined.
    expect(screen.queryByRole('button', { name: 'Delete event' })).toBeNull();

    fireEvent.change(within(form).getByLabelText('Event name'), { target: { value: 'Autumn' } });
    fireEvent.change(within(form).getByLabelText('Reason'), { target: { value: 'Shorter name' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(requests.find((r) => r.method === 'PATCH')!.body).toEqual({
      name: 'Autumn',
      reason: 'Shorter name',
    });
  });

  it('deletes an event nobody joined, after a confirmed reason', async () => {
    navigation.params = { id: 'winter-week' };
    const { fetch, requests } = api({
      'GET /admin/live/events/winter-week': ok(OPEN_EVENT),
      'DELETE /admin/live/events/winter-week': { status: 204 },
    });
    renderAdmin(<EventDetail />, { fetch, signedIn: session('content') });
    const form = await screen.findByRole('form', { name: 'Edit Winter Week' });
    expect(within(form).queryByText('Locked: people have taken part.')).toBeNull();
    expect(within(form).getByRole('button', { name: 'Add mission' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Community Tree' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Planned twice' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/live'));
    expect(requests.find((r) => r.method === 'DELETE')!.body).toEqual({ reason: 'Planned twice' });
  });
});

describe('seasonal themes (D6.2)', { timeout: 15_000 }, () => {
  it('shows each hemisphere’s schedule with its gaps', async () => {
    const { fetch } = api({
      'GET /admin/live/events': ok({ items: [] }),
      'GET /admin/live/themes': ok({ items: THEMES }),
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('content') });
    fireEvent.click(screen.getByRole('tab', { name: 'Seasonal themes' }));

    const north = await screen.findByRole('region', { name: 'Northern hemisphere' });
    expect(
      within(north)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Autumn · 2026-09-22 00:00 UTC – 2026-12-21 00:00 UTC · Active · Started',
      'No theme · 2026-12-21 00:00 UTC – 2027-01-10 00:00 UTC',
      'Lunar New Year · 2027-01-10 00:00 UTC – 2027-01-24 00:00 UTC · Planned · Both hemispheres',
    ]);
    const south = screen.getByRole('region', { name: 'Southern hemisphere' });
    expect(within(south).getAllByRole('listitem')).toHaveLength(1);
  });

  it('creates a theme with a reward, and locks a started theme', async () => {
    const { fetch, requests } = api({
      'GET /admin/live/events': ok({ items: [] }),
      'GET /admin/live/themes': ok({ items: THEMES }),
      'POST /admin/live/themes': ok({ ...THEMES[1], id: 'spring' }, 201),
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('content') });
    fireEvent.click(screen.getByRole('tab', { name: 'Seasonal themes' }));
    await screen.findByRole('region', { name: 'Northern hemisphere' });

    // A started theme keeps its window and rewards, and can no longer be deleted.
    fireEvent.click(screen.getByRole('button', { name: 'Edit Autumn' }));
    const edit = screen.getByRole('form', { name: 'Edit Autumn' });
    expect((within(edit).getByLabelText('Starts at') as HTMLInputElement).disabled).toBe(true);
    expect((within(edit).getByLabelText('Hemisphere') as HTMLSelectElement).disabled).toBe(true);
    expect(within(edit).getByText('Locked: the theme has started.')).toBeDefined();
    fireEvent.click(within(edit).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Delete Autumn' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Lunar New Year' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'New theme' }));
    const form = screen.getByRole('form', { name: 'New theme' });
    const field = (label: string) => within(form).getByLabelText(label);
    fireEvent.change(field('Id'), { target: { value: 'spring' } });
    fireEvent.change(field('Name'), { target: { value: 'Spring' } });
    fireEvent.change(field('Description'), { target: { value: 'Blossoms.' } });
    fireEvent.change(field('Environment'), { target: { value: 'spring' } });
    fireEvent.change(field('Hemisphere'), { target: { value: 'south' } });
    fireEvent.change(field('Starts at'), { target: { value: '2026-09-22T00:00:00.000Z' } });
    fireEvent.change(field('Ends at'), { target: { value: '2026-12-21T00:00:00.000Z' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add reward' }));
    const reward = within(form).getByRole('group', { name: 'Reward 1' });
    fireEvent.change(within(reward).getByLabelText('Id'), { target: { value: 'blossom' } });
    fireEvent.change(within(reward).getByLabelText('Badge'), {
      target: { value: 'spring-blossom' },
    });
    fireEvent.change(within(reward).getByLabelText('Active days'), { target: { value: '7' } });
    fireEvent.change(field('Reason'), { target: { value: 'Southern spring' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'New theme' })).toBeNull());
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      id: 'spring',
      name: 'Spring',
      description: 'Blossoms.',
      environmentId: 'spring',
      hemisphere: 'south',
      status: 'planned',
      startsAt: '2026-09-22T00:00:00.000Z',
      endsAt: '2026-12-21T00:00:00.000Z',
      rewards: [{ id: 'blossom', badgeId: 'spring-blossom', requiredActiveDays: 7 }],
      reason: 'Southern spring',
    });
  });
});

describe('leaderboards (D6.2)', { timeout: 15_000 }, () => {
  it('excludes an abusive account with a reason, and restores one', async () => {
    let excluded = false;
    const { fetch, requests } = api({
      'GET /admin/live/events': ok({ items: [SUMMARY, OPEN_SUMMARY] }),
      'GET /admin/live/leaderboards?scope=global&period=weekly': () =>
        ok(excluded ? { ...BOARD, rows: BOARD.rows.slice(0, 1) } : BOARD),
      'GET /admin/live/leaderboard-exclusions': () =>
        ok({
          items: excluded
            ? [EXCLUSION, { ...EXCLUSION, user: { ...EXCLUSION.user, id: 'u-2' } }]
            : [EXCLUSION],
        }),
      'POST /admin/live/leaderboard-exclusions': () => {
        excluded = true;
        return ok({ ...EXCLUSION, user: { ...EXCLUSION.user, id: 'u-2' } }, 201);
      },
      'DELETE /admin/live/leaderboard-exclusions/u-9': { status: 204 },
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('content') });
    fireEvent.click(screen.getByRole('tab', { name: 'Leaderboards' }));

    const board = await screen.findByRole('table', { name: 'Global weekly board' });
    expect(screen.getByText('2026-10-12 – 2026-10-18')).toBeDefined();
    const cheat = within(board).getByText('Cheat (@cheat)').closest('tr')!;
    expect(within(cheat).getByText('880')).toBeDefined();
    fireEvent.click(within(cheat).getByRole('button', { name: 'Exclude' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Impossible hours' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exclude' }));
    await waitFor(() => expect(within(board).queryByText('Cheat (@cheat)')).toBeNull());
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      userId: 'u-2',
      reason: 'Impossible hours',
    });

    const exclusions = screen.getByRole('table', { name: 'Excluded accounts' });
    const bot = within(exclusions).getAllByText('bot@example.com (@bot)')[0]!.closest('tr')!;
    expect(within(bot).getByText('Scripted sessions')).toBeDefined();
    expect(within(bot).getByText('admin@example.com')).toBeDefined();
    fireEvent.click(within(bot).getByRole('button', { name: 'Restore' }));
    const restore = screen.getByRole('dialog');
    fireEvent.change(within(restore).getByLabelText('Reason (logged)'), {
      target: { value: 'Appeal accepted' },
    });
    fireEvent.click(within(restore).getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(requests.find((r) => r.method === 'DELETE')!.body).toEqual({
        reason: 'Appeal accepted',
      }),
    );
  });

  it('shows an event board with its teams, for events with a board only', async () => {
    const { fetch, requests } = api({
      'GET /admin/live/events': ok({ items: [SUMMARY, OPEN_SUMMARY] }),
      'GET /admin/live/leaderboards?scope=global&period=weekly': ok(BOARD),
      'GET /admin/live/leaderboard-exclusions': ok({ items: [] }),
      'GET /admin/live/leaderboards?scope=event&eventId=autumn-focus': ok({
        ...BOARD,
        scope: 'event',
        period: { kind: 'event', startDate: '2026-10-20', endDate: '2026-11-02' },
        teams: [{ id: 'owls', name: 'Owls', rank: 1, score: 870, members: 4 }],
      }),
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('admin') });
    fireEvent.click(screen.getByRole('tab', { name: 'Leaderboards' }));
    await screen.findByRole('table', { name: 'Global weekly board' });

    const board = screen.getByLabelText('Board');
    expect(
      within(board)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Global, weekly', 'Global, monthly', 'Event: Autumn Focus']);
    fireEvent.change(board, { target: { value: 'event:autumn-focus' } });
    const teams = await screen.findByRole('table', { name: 'Teams' });
    expect(within(teams).getByText('Owls')).toBeDefined();
    expect(requests.map((r) => r.path)).toContain(
      '/admin/live/leaderboards?scope=event&eventId=autumn-focus',
    );
    expect(screen.getByRole('table', { name: 'Autumn Focus board' })).toBeDefined();
  });
});
