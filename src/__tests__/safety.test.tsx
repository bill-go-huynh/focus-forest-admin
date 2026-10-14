import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { ClientErrorsPage } from '../features/safety/ClientErrorsPage';
import { IntegrityPage } from '../features/safety/IntegrityPage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D7.1 Safety and health views (Phase 7): the leaderboard integrity queue (A7.3: staff decide,
 * flags change nothing on their own) and the apps' crash and error reports (A7.4).
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

beforeEach(() => sessionStorage.clear());

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
const links = (role: 'admin' | 'support' | 'moderator' | 'content') => {
  const view = renderAdmin(<AdminShell>x</AdminShell>, {
    fetch: api({}).fetch,
    signedIn: session(role),
  });
  const names = within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent);
  view.unmount();
  return names;
};

const ANA = { id: 'u-ana', email: 'ana@example.com', username: 'ana', displayName: 'Ana' };
const FLAGS = {
  items: [
    {
      user: ANA,
      flags: [
        {
          kind: 'overlap',
          key: 'overlap:s1:s2',
          detail: { sessionIds: ['s1', 's2'], overlapMinutes: 30 },
        },
        {
          kind: 'day_total',
          key: 'day:2026-11-04',
          detail: { localDate: '2026-11-04', focusMinutes: 1020 },
        },
        { kind: 'late', key: 'late:s3', detail: { sessionId: 's3', hoursLate: 120 } },
        {
          kind: 'spike',
          key: 'spike:2026-11-02',
          detail: { weekStart: '2026-11-02', focusMinutes: 700, usualMinutes: 120 },
        },
      ],
    },
  ],
};
const ERRORS = {
  items: [
    {
      kind: 'crash',
      message: 'TypeError: undefined is not an object',
      platform: 'ios',
      appVersion: '1.3.0',
      screen: 'home',
      count: 4,
      firstSeen: '2026-11-02T10:00:00.000Z',
      lastSeen: '2026-11-02T11:00:00.000Z',
      stack: 'at TreeScene (Tree.tsx:12)',
    },
  ],
};

describe('roles (D7.1)', () => {
  it('shows Integrity to admins and content staff, App errors to admins and support', () => {
    expect(links('admin')).toEqual(expect.arrayContaining(['Integrity', 'App errors']));
    expect(links('content')).toEqual(['Dashboard', 'Content', 'Live', 'Integrity']);
    expect(links('support')).toContain('App errors');
    expect(links('support')).not.toContain('Integrity');
    expect(links('moderator')).not.toContain('Integrity');
    expect(links('moderator')).not.toContain('App errors');
  });
});

describe('leaderboard integrity (D7.1)', () => {
  it('lists each person’s flags in plain words', async () => {
    const { fetch } = api({ 'GET /admin/integrity/flags': ok(FLAGS) });
    renderAdmin(<IntegrityPage />, { fetch, signedIn: session('content') });
    const card = (await screen.findByText('ana@example.com (@ana)')).closest('section')!;
    expect(
      within(card)
        .getAllByRole('listitem')
        .map((item) => item.firstChild?.textContent),
    ).toEqual([
      'Two sessions at once (30 min overlap)',
      '1020 minutes of focus on 2026-11-04',
      'A session stored 120 hours after it ended',
      'Week of 2026-11-02: 700 minutes, usually 120',
    ]);
    expect(screen.getByText(/Flags change nothing on their own/)).toBeDefined();
  });

  it('says when there is nothing to look at', async () => {
    const { fetch } = api({ 'GET /admin/integrity/flags': ok({ items: [] }) });
    renderAdmin(<IntegrityPage />, { fetch, signedIn: session('admin') });
    expect(await screen.findByText('Nothing looks unusual.')).toBeDefined();
  });

  it('dismisses a flag with a reason', async () => {
    let dismissed = false;
    const { fetch, requests } = api({
      'GET /admin/integrity/flags': () =>
        ok(dismissed ? { items: [{ user: ANA, flags: FLAGS.items[0]!.flags.slice(1) }] } : FLAGS),
      'POST /admin/integrity/dismissals': () => {
        dismissed = true;
        return { status: 201 };
      },
    });
    renderAdmin(<IntegrityPage />, { fetch, signedIn: session('content') });
    await screen.findByText('ana@example.com (@ana)');
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss: Two sessions at once (30 min overlap)' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Two devices, same person' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(screen.queryByText('Two sessions at once (30 min overlap)')).toBeNull(),
    );
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      userId: 'u-ana',
      key: 'overlap:s1:s2',
      reason: 'Two devices, same person',
    });
  });

  it('excludes the account from boards with a reason', async () => {
    let excluded = false;
    const { fetch, requests } = api({
      'GET /admin/integrity/flags': () => ok(excluded ? { items: [] } : FLAGS),
      'POST /admin/live/leaderboard-exclusions': () => {
        excluded = true;
        return ok(
          {
            user: ANA,
            reason: 'Scripted sessions',
            excludedAt: '2026-11-06T12:00:00.000Z',
            by: 'content@example.com',
          },
          201,
        );
      },
    });
    renderAdmin(<IntegrityPage />, { fetch, signedIn: session('content') });
    await screen.findByText('ana@example.com (@ana)');
    fireEvent.click(screen.getByRole('button', { name: 'Exclude ana@example.com from boards' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Scripted sessions' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exclude' }));
    expect(await screen.findByText('Nothing looks unusual.')).toBeDefined();
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      userId: 'u-ana',
      reason: 'Scripted sessions',
    });
  });
});

describe('app errors (D7.1)', () => {
  it('lists reports grouped, for a chosen number of days, with the stack on request', async () => {
    const { fetch, requests } = api({
      'GET /admin/client-errors?days=7': ok(ERRORS),
      'GET /admin/client-errors?days=30': ok({ items: [] }),
      'GET /admin/rate-limits': ok({ since: '2026-11-05T12:00:00.000Z', items: [] }),
    });
    renderAdmin(<ClientErrorsPage />, { fetch, signedIn: session('support') });
    const row = (await screen.findByText('TypeError: undefined is not an object')).closest('tr')!;
    expect(within(row).getByText('4')).toBeDefined();
    expect(within(row).getByText('ios 1.3.0')).toBeDefined();
    expect(within(row).getByText('home')).toBeDefined();
    expect(within(row).getByText('Crash')).toBeDefined();
    expect(screen.queryByText('at TreeScene (Tree.tsx:12)')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Show stack' }));
    expect(screen.getByText('at TreeScene (Tree.tsx:12)')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '30' } });
    expect(await screen.findByText('No errors reported in the last 30 days.')).toBeDefined();
    expect(requests.map((r) => r.path)).toContain('/admin/client-errors?days=30');
  });
});

describe('rate limits (D7.1)', () => {
  it('shows refusals per limit over the last day', async () => {
    const { fetch } = api({
      'GET /admin/client-errors?days=7': ok({ items: [] }),
      'GET /admin/rate-limits': ok({
        since: '2026-11-05T12:00:00.000Z',
        items: [
          { name: 'signIn', limit: 10, refused: 37, keys: 3 },
          { name: 'reports', limit: 20, refused: 0, keys: 0 },
        ],
      }),
    });
    renderAdmin(<ClientErrorsPage />, { fetch, signedIn: session('admin') });
    const table = await screen.findByRole('table', { name: 'Rate limits' });
    const signIn = within(table).getByText('Sign-in attempts').closest('tr')!;
    expect(within(signIn).getByText('37')).toBeDefined();
    expect(within(signIn).getByText('3')).toBeDefined();
    expect(within(signIn).getByText('10')).toBeDefined();
    expect(
      screen.getByText('Since 2026-11-05 12:00 UTC. Counts only: nothing says who.'),
    ).toBeDefined();
  });
});
