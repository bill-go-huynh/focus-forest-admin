import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { LivePage } from '../features/live/LivePage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D6.2 Live operations (docs/09 later admin: seasonal themes, leaderboards with exclusions).
 * Content staff and admins run them; a started theme is locked, and the page says why. Events,
 * missions, teams and the Community Tree were removed from the product (owner, 2026-10-22).
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
    expect(links()).toEqual(['Dashboard', 'Content', 'Live', 'Integrity']);
  });
});

describe('seasonal themes (D6.2)', { timeout: 15_000 }, () => {
  it('shows each hemisphere’s schedule with its gaps', async () => {
    const { fetch } = api({
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

  it('offers global boards only, by week or month (no event boards, owner 2026-10-22)', async () => {
    const { fetch, requests } = api({
      'GET /admin/live/leaderboards?scope=global&period=weekly': ok(BOARD),
      'GET /admin/live/leaderboards?scope=global&period=monthly': ok({
        ...BOARD,
        period: { kind: 'monthly', startDate: '2026-10-01', endDate: '2026-10-31' },
      }),
      'GET /admin/live/leaderboard-exclusions': ok({ items: [] }),
    });
    renderAdmin(<LivePage />, { fetch, signedIn: session('admin') });
    fireEvent.click(screen.getByRole('tab', { name: 'Leaderboards' }));
    await screen.findByRole('table', { name: 'Global weekly board' });

    const board = screen.getByLabelText('Board');
    expect(
      within(board)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Global, weekly', 'Global, monthly']);
    fireEvent.change(board, { target: { value: 'global:monthly' } });
    await screen.findByRole('table', { name: 'Global monthly board' });
    expect(screen.queryByRole('table', { name: 'Teams' })).toBeNull();
    expect(requests.map((r) => r.path)).toContain(
      '/admin/live/leaderboards?scope=global&period=monthly',
    );
    expect(requests.some((r) => r.path.includes('/admin/live/events'))).toBe(false);
  });
});

describe('no events (owner, 2026-10-22)', { timeout: 15_000 }, () => {
  it('opens on seasonal themes, with no Events tab', async () => {
    const { fetch, requests } = api({ 'GET /admin/live/themes': ok({ items: THEMES }) });
    renderAdmin(<LivePage />, { fetch, signedIn: session('admin') });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Seasonal themes',
      'Leaderboards',
    ]);
    await screen.findByRole('region', { name: 'Northern hemisphere' });
    expect(screen.queryByRole('button', { name: 'New event' })).toBeNull();
    expect(requests.some((r) => r.path.includes('/admin/live/events'))).toBe(false);
  });
});
