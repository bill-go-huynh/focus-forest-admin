import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { Dashboard } from '../features/dashboard/Dashboard';
import { ReportDetail } from '../features/moderation/ReportDetail';
import { ReportsQueue } from '../features/moderation/ReportsQueue';
import { RoomsList } from '../features/rooms/RoomsList';
import { AdminShell } from '../features/shell/AdminShell';
import { UserDetail } from '../features/users/UserDetail';
import { UserSearch } from '../features/users/UserSearch';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import {
  ADA_DETAIL,
  ADA_ROW,
  DASHBOARD,
  REPORT,
  REPORT_DETAIL,
  ROOM,
  SESSIONS,
} from '../test/fixtures';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D5.1 Moderation and rooms (docs/09 → Reports and moderation, Focus rooms): the reports queue,
 * report detail with confirmed and reasoned decisions, block relationships, rooms with closing,
 * and the moderator role (least privilege).
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
const moderator = session('moderator');
const links = () =>
  within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('roles (D5.1)', () => {
  it('shows a moderator users, reports, and rooms, never configuration or the audit log', () => {
    renderAdmin(<AdminShell>content</AdminShell>, { fetch: api({}).fetch, signedIn: moderator });
    expect(links()).toEqual(['Dashboard', 'Users', 'Reports', 'Rooms']);
  });

  it('shows admins reports and rooms, and support neither', () => {
    const { unmount } = renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('admin'),
    });
    expect(links()).toEqual([
      'Dashboard',
      'Users',
      'Reports',
      'Rooms',
      'Checkpoint',
      'Configuration',
      'Audit log',
    ]);
    unmount();
    renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('support'),
    });
    expect(links()).toEqual(['Dashboard', 'Users', 'Checkpoint', 'Configuration']);
  });
});

describe('the dashboard (D5.1)', () => {
  it('counts the reports waiting for a moderator', async () => {
    renderAdmin(<Dashboard />, { fetch: api({ 'GET /admin/dashboard': ok(DASHBOARD) }).fetch });
    expect((await screen.findByTestId('stat-openReports')).textContent).toBe('4');
    expect(screen.getByText('Open reports')).toBeDefined();
  });
});

describe('users with moderation (D5.1)', () => {
  beforeEach(() => {
    navigation.params = { id: ADA_ROW.id };
  });
  const routes = () => ({
    [`GET /admin/users/${ADA_ROW.id}`]: ok(ADA_DETAIL),
    [`GET /admin/users/${ADA_ROW.id}/sessions`]: ok(SESSIONS),
  });

  it('shows the username in search results', async () => {
    renderAdmin(<UserSearch />, {
      fetch: api({ 'GET /admin/users': ok({ items: [ADA_ROW], nextCursor: null }) }).fetch,
    });
    expect(await screen.findByText('@ada')).toBeDefined();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Username');
  });

  it('shows the username, reports, warnings, and block relationships in user detail', async () => {
    renderAdmin(<UserDetail />, { fetch: api(routes()).fetch });
    await screen.findByRole('heading', { name: 'ada@example.com' });
    expect(screen.getByText('@ada')).toBeDefined();
    expect(screen.getByText('3 reports about this user, 2 open')).toBeDefined();
    expect(screen.getByText('1 report filed')).toBeDefined();
    expect(screen.getByText('1 warning')).toBeDefined();
    expect(screen.getByText('Blocks 0 users · blocked by 2 users')).toBeDefined();
  });

  it('never offers a moderator note reveals or account actions', async () => {
    renderAdmin(<UserDetail />, { fetch: api(routes()).fetch, signedIn: moderator });
    await screen.findByRole('heading', { name: 'ada@example.com' });
    await screen.findByText(/Counted: completed/);
    expect(screen.queryByRole('button', { name: /Reveal note/ })).toBeNull();
    expect(screen.getByText('Hidden')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Suspend account' })).toBeNull();
  });
});

describe('the reports queue (D5.1)', () => {
  it('lists the reports waiting, oldest first, each linked to its detail', async () => {
    const net = api({ 'GET /admin/reports': ok({ items: [REPORT], nextCursor: null }) });
    renderAdmin(<ReportsQueue />, { fetch: net.fetch, signedIn: moderator });
    const link = await screen.findByRole('link', { name: 'Bio' });
    expect(link.getAttribute('href')).toBe(`/reports/${REPORT.id}`);
    const row = link.closest('tr')!;
    expect(within(row).getByText('Open')).toBeDefined();
    expect(within(row).getByText('ada@example.com (@ada)')).toBeDefined();
    expect(within(row).getByText('rex@example.com (@rex)')).toBeDefined();
    expect(within(row).getByText('2')).toBeDefined();
    expect(net.requests[0]?.path).toBe('/admin/reports');
  });

  it('filters by status, says when nothing is there, and loads more', async () => {
    const net = api({
      'GET /admin/reports': ok({ items: [REPORT], nextCursor: 'c1' }),
      'GET /admin/reports?cursor=c1': ok({
        items: [{ ...REPORT, id: '88888888-8888-4888-8888-888888888888', category: 'username' }],
        nextCursor: null,
      }),
      'GET /admin/reports?status=dismissed': ok({ items: [], nextCursor: null }),
    });
    renderAdmin(<ReportsQueue />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: 'Username' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'dismissed' } });
    expect(await screen.findByText('No dismissed reports.')).toBeDefined();
    expect(net.requests.map((r) => r.path)).toContain('/admin/reports?status=dismissed');
  });

  it('says so when there is nothing waiting', async () => {
    renderAdmin(<ReportsQueue />, {
      fetch: api({ 'GET /admin/reports': ok({ items: [], nextCursor: null }) }).fetch,
      signedIn: moderator,
    });
    expect(await screen.findByText('No reports waiting.')).toBeDefined();
  });
});

describe('report detail (D5.1)', () => {
  const path = `/admin/reports/${REPORT.id}`;
  beforeEach(() => {
    navigation.params = { id: REPORT.id };
  });

  it('shows the report, the profile as it is now, blocks, and history', async () => {
    renderAdmin(<ReportDetail />, {
      fetch: api({ [`GET ${path}`]: ok(REPORT_DETAIL) }).fetch,
      signedIn: moderator,
    });
    expect(await screen.findByRole('heading', { name: 'Bio report' })).toBeDefined();
    expect(screen.getByText('Rude words in the bio.')).toBeDefined();
    expect(screen.getByText('Thesis season.')).toBeDefined();
    expect(screen.getByText('The reporter blocks this user')).toBeDefined();
    expect(screen.getByText('3 reports, 1 warning, Active')).toBeDefined();
    expect(screen.getByRole('link', { name: 'ada@example.com' }).getAttribute('href')).toBe(
      `/users/${ADA_ROW.id}`,
    );
  });

  it('starts a review', async () => {
    const net = api({
      [`GET ${path}`]: ok(REPORT_DETAIL),
      [`POST ${path}/review`]: ok({
        ...REPORT_DETAIL,
        status: 'in_review',
        reviewedBy: 'moderator@example.com',
      }),
    });
    renderAdmin(<ReportDetail />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.click(await screen.findByRole('button', { name: 'Start review' }));
    expect(await screen.findByText('In review by moderator@example.com')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start review' })).toBeNull();
  });

  it('resolves with an action, a message for a warning, and a confirmed reason', async () => {
    const net = api({
      [`GET ${path}`]: ok({ ...REPORT_DETAIL, status: 'in_review' }),
      [`POST ${path}/resolve`]: ok({
        ...REPORT_DETAIL,
        status: 'resolved',
        resolution: {
          action: 'warn',
          reason: 'Bio breaks the rules',
          resolvedBy: 'moderator@example.com',
          resolvedAt: '2026-10-08T10:00:00.000Z',
        },
      }),
    });
    renderAdmin(<ReportDetail />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'warn' } });
    const resolve = screen.getByRole('button', { name: 'Resolve…' }) as HTMLButtonElement;
    // A warning needs the words the user will read.
    expect(resolve.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Message to the user'), {
      target: { value: 'Please keep your bio kind.' },
    });
    expect(resolve.disabled).toBe(false);
    fireEvent.click(resolve);
    const dialog = screen.getByRole('dialog', { name: 'Warn this user and resolve the report?' });
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Bio breaks the rules' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve report' }));
    expect(await screen.findByText('Resolved: Warn the user')).toBeDefined();
    expect(net.requests.at(-1)).toMatchObject({
      method: 'POST',
      path: `${path}/resolve`,
      body: {
        action: 'warn',
        reason: 'Bio breaks the rules',
        message: 'Please keep your bio kind.',
      },
    });
    // Closed: no more decisions.
    expect(screen.queryByLabelText('Action')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss…' })).toBeNull();
  });

  it('confirms account actions as such, and sends no message for them', async () => {
    const net = api({
      [`GET ${path}`]: ok(REPORT_DETAIL),
      [`POST ${path}/resolve`]: ok({ ...REPORT_DETAIL, status: 'resolved' }),
    });
    renderAdmin(<ReportDetail />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'ban' } });
    expect(screen.queryByLabelText('Message to the user')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve…' }));
    const dialog = screen.getByRole('dialog', { name: 'Ban this user and resolve the report?' });
    expect(within(dialog).getByText(/signed out everywhere/)).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Repeated abuse' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve report' }));
    await waitFor(() =>
      expect(net.requests.at(-1)).toMatchObject({
        body: { action: 'ban', reason: 'Repeated abuse' },
      }),
    );
    expect(net.requests.at(-1)?.body).not.toHaveProperty('message');
  });

  it('dismisses with a confirmed reason, and shows a refusal', async () => {
    const net = api({
      [`GET ${path}`]: ok(REPORT_DETAIL),
      [`POST ${path}/dismiss`]: {
        status: 409,
        body: nestError(409, 'This report is already resolved or dismissed.', 'report_closed'),
      },
    });
    renderAdmin(<ReportDetail />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss…' }));
    const dialog = screen.getByRole('dialog', { name: 'Dismiss this report?' });
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Not a violation' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dismiss report' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'This report is already resolved or dismissed.',
    );
    expect(net.requests.at(-1)).toMatchObject({ body: { reason: 'Not a violation' } });
  });

  it('shows a closed report with its decision and no actions', async () => {
    renderAdmin(<ReportDetail />, {
      fetch: api({
        [`GET ${path}`]: ok({
          ...REPORT_DETAIL,
          status: 'dismissed',
          reporter: null,
          resolution: {
            action: null,
            reason: 'Not a violation',
            resolvedBy: 'admin@example.com',
            resolvedAt: '2026-10-08T10:00:00.000Z',
          },
        }),
      }).fetch,
      signedIn: moderator,
    });
    expect(await screen.findByText('Dismissed: Not a violation')).toBeDefined();
    expect(screen.getByText('Deleted account')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Dismiss…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start review' })).toBeNull();
  });
});

describe('rooms (D5.1)', () => {
  it('lists active rooms with their phase, host, and size', async () => {
    renderAdmin(<RoomsList />, {
      fetch: api({ 'GET /admin/rooms': ok({ items: [ROOM] }) }).fetch,
      signedIn: moderator,
    });
    const row = (await screen.findByText('Morning study')).closest('tr')!;
    expect(within(row).getByText('Focusing')).toBeDefined();
    expect(within(row).getByText('rex@example.com (@rex)')).toBeDefined();
    expect(within(row).getByText('3')).toBeDefined();
    expect(within(row).getByText('Public')).toBeDefined();
  });

  it('closes a room after a confirmed reason', async () => {
    const net = api({
      'GET /admin/rooms': ok({ items: [ROOM] }),
      [`POST /admin/rooms/${ROOM.id}/close`]: ok({ ...ROOM, phase: 'closed' }),
    });
    renderAdmin(<RoomsList />, { fetch: net.fetch, signedIn: moderator });
    fireEvent.click(await screen.findByRole('button', { name: 'Close room' }));
    const dialog = screen.getByRole('dialog', { name: 'Close “Morning study”?' });
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Spam room name' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close room' }));
    const row = (await screen.findByText('Closed')).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Close room' })).toBeNull();
    expect(net.requests.at(-1)).toMatchObject({ body: { reason: 'Spam room name' } });
  });

  it('says so when no room is open', async () => {
    renderAdmin(<RoomsList />, {
      fetch: api({ 'GET /admin/rooms': ok({ items: [] }) }).fetch,
      signedIn: moderator,
    });
    expect(await screen.findByText('No open rooms.')).toBeDefined();
  });
});
