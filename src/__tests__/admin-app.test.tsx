import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { AdminShell } from '../features/shell/AdminShell';
import { AuditLog } from '../features/audit/AuditLog';
import { CheckpointReport } from '../features/checkpoint/CheckpointReport';
import { ConfigView } from '../features/config/ConfigView';
import { Dashboard } from '../features/dashboard/Dashboard';
import { SignInForm } from '../features/sign-in/SignInForm';
import { UserDetail } from '../features/users/UserDetail';
import { UserSearch } from '../features/users/UserSearch';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import {
  ADA_DETAIL,
  ADA_ROW,
  AUDIT,
  CHECKPOINT,
  CONFIG,
  DASHBOARD,
  SESSIONS,
} from '../test/fixtures';
import { navigation, renderAdmin, session } from '../test/render';

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
  navigation.push.mockReset();
  navigation.replace.mockReset();
  sessionStorage.clear();
});

const ok = (body: unknown): Reply => ({ status: 200, body });
const api = (routes: Record<string, Reply | ((r: Recorded) => Reply)>) =>
  fakeApi((request) => {
    const key = `${request.method} ${request.path}`;
    const route = routes[key] ?? routes[`${request.method} ${request.path.split('?')[0]}`];
    if (!route) return { status: 500, body: nestError(500, `Not scripted: ${key}`) };
    return typeof route === 'function' ? route(request) : route;
  });

describe('signing in (CR.5)', () => {
  it('signs in, keeps the session for the tab, and opens the dashboard', async () => {
    const net = api({
      'POST /admin/auth/sign-in': ok(session('support')),
    });
    renderAdmin(<SignInForm />, { fetch: net.fetch, signedIn: null });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'support@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
    expect(
      JSON.parse(sessionStorage.getItem('focus-forest-admin/session') ?? 'null'),
    ).toMatchObject({
      admin: { role: 'support' },
    });
  });

  it('says calmly when the credentials are wrong, and keeps the fields', async () => {
    const net = api({
      'POST /admin/auth/sign-in': {
        status: 401,
        body: nestError(401, 'Email or password is incorrect.'),
      },
    });
    renderAdmin(<SignInForm />, { fetch: net.fetch, signedIn: null });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Email or password is incorrect.',
    );
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ops@example.com');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('the shell (CR.5)', () => {
  it('sends a signed-out visitor to sign-in', async () => {
    renderAdmin(<AdminShell>secret</AdminShell>, { fetch: api({}).fetch, signedIn: null });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/sign-in'));
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('shows only what a role can use, and who is signed in', () => {
    const { unmount } = renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('support'),
    });
    const nav = screen.getByRole('navigation');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Users', 'Checkpoint', 'Configuration']);
    expect(screen.getByText('support@example.com (support)')).toBeDefined();
    unmount();
    renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('admin'),
    });
    expect(
      within(screen.getByRole('navigation')).getByRole('link', { name: 'Audit log' }),
    ).toBeDefined();
  });

  it('signs out, and returns to sign-in when the API says the session ended', async () => {
    const net = api({
      'GET /admin/dashboard': { status: 401, body: nestError(401, 'Sign in again.') },
    });
    renderAdmin(
      <AdminShell>
        <Dashboard />
      </AdminShell>,
      { fetch: net.fetch },
    );
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/sign-in'));
    expect(sessionStorage.getItem('focus-forest-admin/session')).toBeNull();
  });
});

describe('dashboard (CR.5)', () => {
  it('shows plain operational counts', async () => {
    renderAdmin(<Dashboard />, { fetch: api({ 'GET /admin/dashboard': ok(DASHBOARD) }).fetch });
    expect(await screen.findByText('Sessions today')).toBeDefined();
    expect(screen.getByTestId('stat-sessionsToday').textContent).toContain('17');
    expect(screen.getByTestId('stat-discardedToday').textContent).toContain('2');
    expect(screen.getByTestId('stat-activeUsersLast7Days').textContent).toContain('9');
  });

  it('shows an error with a retry', async () => {
    let calls = 0;
    const net = api({
      'GET /admin/dashboard': () => (++calls === 1 ? new TypeError('down') : ok(DASHBOARD)),
    });
    renderAdmin(<Dashboard />, { fetch: net.fetch });
    expect((await screen.findByRole('alert')).textContent).toContain(
      "The admin API can't be reached right now.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findByTestId('stat-sessionsToday')).textContent).toContain('17');
  });
});

describe('users (CR.5)', () => {
  it('searches users and links each to its detail', async () => {
    const net = api({
      'GET /admin/users': ok({ items: [ADA_ROW], nextCursor: null }),
      'GET /admin/users?q=ada': ok({ items: [ADA_ROW], nextCursor: null }),
      'GET /admin/users?q=nobody': ok({ items: [], nextCursor: null }),
    });
    renderAdmin(<UserSearch />, { fetch: net.fetch });
    expect(
      (await screen.findByRole('link', { name: 'ada@example.com' })).getAttribute('href'),
    ).toBe(`/users/${ADA_ROW.id}`);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search users' }), {
      target: { value: 'nobody' },
    });
    fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('No users match “nobody”.')).toBeDefined();
    expect(net.requests.map((r) => r.path)).toContain('/admin/users?q=nobody');
  });

  it('loads more users page by page', async () => {
    const second = {
      ...ADA_ROW,
      id: '44444444-4444-4444-8444-444444444444',
      email: 'bob@example.com',
    };
    const net = api({
      'GET /admin/users': ok({ items: [ADA_ROW], nextCursor: 'c1' }),
      'GET /admin/users?cursor=c1': ok({ items: [second], nextCursor: null }),
    });
    renderAdmin(<UserSearch />, { fetch: net.fetch });
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: 'bob@example.com' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'ada@example.com' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('user detail (CR.5)', () => {
  const routes = () => ({
    [`GET /admin/users/${ADA_ROW.id}`]: ok(ADA_DETAIL),
    [`GET /admin/users/${ADA_ROW.id}/sessions`]: ok(SESSIONS),
  });
  beforeEach(() => {
    navigation.params = { id: ADA_ROW.id };
  });

  it('shows the profile, lifetime, the tree in numbers, rewards, and checkpoint activity', async () => {
    renderAdmin(<UserDetail />, { fetch: api(routes()).fetch });
    expect(await screen.findByRole('heading', { name: 'ada@example.com' })).toBeDefined();
    expect(screen.getByText('12 h 34 min')).toBeDefined();
    expect(
      screen.getByText('Young tree · Sakura · fullness 2, blossoms 1, richness 0 (Oct 2026)'),
    ).toBeDefined();
    expect(screen.getByText('5 badges · 3 species · 1 cosmetic')).toBeDefined();
    expect(screen.getByText('Returned in the month after the first archive')).toBeDefined();
  });

  it('lists sessions with why each counted, notes hidden', async () => {
    renderAdmin(<UserDetail />, { fetch: api(routes()).fetch });
    expect(
      await screen.findByText(
        'Not counted: 3 min of focus, under the 5-minute minimum (configuration v5).',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/chapter two/)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Reveal note/ })).toHaveLength(1);
  });

  it('reveals a note only with a reason, after confirming', async () => {
    const net = api({
      ...routes(),
      [`POST /admin/users/${ADA_ROW.id}/sessions/${SESSIONS.items[1]!.id}/note-reveal`]: ok({
        note: 'Thesis chapter two, finally.',
      }),
    });
    renderAdmin(<UserDetail />, { fetch: net.fetch });
    fireEvent.click(await screen.findByRole('button', { name: /Reveal note/ }));
    const dialog = screen.getByRole('dialog', { name: 'Reveal this note?' });
    const confirm = within(dialog).getByRole('button', { name: 'Reveal note' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Ticket 42' },
    });
    fireEvent.click(confirm);
    expect(await screen.findByText('Thesis chapter two, finally.')).toBeDefined();
    expect(net.requests.at(-1)).toMatchObject({ method: 'POST', body: { reason: 'Ticket 42' } });
  });

  it('offers account actions to admins only', async () => {
    renderAdmin(<UserDetail />, { fetch: api(routes()).fetch, signedIn: session('support') });
    await screen.findByRole('heading', { name: 'ada@example.com' });
    expect(screen.queryByRole('button', { name: 'Suspend account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
  });

  it('suspends with a confirmed reason and shows the new status', async () => {
    const net = api({
      ...routes(),
      [`POST /admin/users/${ADA_ROW.id}/suspend`]: ok({ ...ADA_ROW, status: 'suspended' }),
    });
    renderAdmin(<UserDetail />, { fetch: net.fetch });
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend account' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend this account?' });
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'abuse report' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend account' }));
    await waitFor(() =>
      expect(net.requests.at(-1)).toMatchObject({
        method: 'POST',
        path: `/admin/users/${ADA_ROW.id}/suspend`,
        body: { reason: 'abuse report' },
      }),
    );
    expect(await screen.findByText('Suspended')).toBeDefined();
  });

  it('deletes only after the email is typed again, then returns to the users', async () => {
    const net = api({ ...routes(), [`DELETE /admin/users/${ADA_ROW.id}`]: { status: 204 } });
    renderAdmin(<UserDetail />, { fetch: net.fetch });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this account and all its data?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'GDPR request' },
    });
    fireEvent.change(within(dialog).getByLabelText('Type the email to confirm'), {
      target: { value: 'ada@exampl' },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Type the email to confirm'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/users'));
    expect(net.requests.at(-1)).toMatchObject({
      method: 'DELETE',
      body: { reason: 'GDPR request', confirmEmail: 'ada@example.com' },
    });
  });

  it('says so when the user does not exist', async () => {
    const net = api({
      [`GET /admin/users/${ADA_ROW.id}`]: {
        status: 404,
        body: nestError(404, 'This user does not exist.', 'user_not_found'),
      },
      [`GET /admin/users/${ADA_ROW.id}/sessions`]: {
        status: 404,
        body: nestError(404, 'x', 'user_not_found'),
      },
    });
    renderAdmin(<UserDetail />, { fetch: net.fetch });
    expect(await screen.findByText('This user does not exist.')).toBeDefined();
  });
});

describe('configuration, audit log, checkpoint (CR.5)', () => {
  it('shows the active configuration read only', async () => {
    renderAdmin(<ConfigView />, { fetch: api({ 'GET /admin/config': ok(CONFIG) }).fetch });
    expect(await screen.findByRole('heading', { name: 'Configuration v5 (active)' })).toBeDefined();
    expect(screen.getByRole('row', { name: /session\.minValidMinutes 5/ })).toBeDefined();
    expect(screen.getByRole('row', { name: /forest\.areaLevels \{"lake":2\}/ })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('lists the audit log, newest first, with more on demand', async () => {
    const net = api({
      'GET /admin/audit-log': ok(AUDIT),
      'GET /admin/audit-log?cursor=next-page': ok({ items: [], nextCursor: null }),
    });
    renderAdmin(<AuditLog />, { fetch: net.fetch });
    expect(await screen.findByRole('row', { name: /user\.suspend .* abuse report/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull());
  });

  it('reads the checkpoint for a join range, in counts', async () => {
    const net = api({
      'GET /admin/analytics/checkpoint?from=2026-09-01&to=2026-09-30': ok(CHECKPOINT),
    });
    renderAdmin(<CheckpointReport />, { fetch: net.fetch });
    fireEvent.change(screen.getByLabelText('Joined from'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Joined to'), { target: { value: '2026-09-30' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    });
    expect((await screen.findByTestId('cohort-multiDayFirstMonth')).textContent).toContain(
      '2 of 3',
    );
    expect(screen.getByTestId('cohort-secondMonth').textContent).toContain('1 of 2 decided');
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByRole('row', { name: /ada@example\.com/ })).toBeDefined();
  });
});
