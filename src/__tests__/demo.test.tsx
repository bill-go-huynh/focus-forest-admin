import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { DemoPage } from '../features/demo/DemoPage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * DM.2 Demo tools (spec/demo/PLAN.md): make a demo world, see its accounts and what each one
 * shows, send any notification now, and let a friend join the presenter's room. Admins only;
 * the page says when the API runs without them.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  sessionStorage.clear();
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

const WORLD = {
  id: 3,
  eventId: 'demo-world-3',
  accounts: [
    { persona: 'main', email: 'demo3@focusforest.test', userId: 'u1', name: 'Bill' },
    { persona: 'comeback', email: 'demo3-comeback@focusforest.test', userId: 'u2', name: 'An' },
    { persona: 'recovery', email: 'demo3-recovery@focusforest.test', userId: 'u3', name: 'Vy' },
    {
      persona: 'friend-mai',
      email: 'demo3-friend-mai@focusforest.test',
      userId: 'u4',
      name: 'Mai',
    },
    {
      persona: 'friend-khoa',
      email: 'demo3-friend-khoa@focusforest.test',
      userId: 'u5',
      name: 'Khoa',
    },
    {
      persona: 'friend-linh',
      email: 'demo3-friend-linh@focusforest.test',
      userId: 'u6',
      name: 'Linh',
    },
  ],
};

describe('demo tools (DM.2)', { timeout: 15_000 }, () => {
  it('says when the API runs without them', async () => {
    const { fetch } = api({ 'GET /admin/demo/status': ok({ enabled: false }) });
    renderAdmin(<DemoPage />, { fetch });
    expect(await screen.findByText(/Demo tools are off/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make a demo world' })).toBeNull();
  });

  it('makes a world with a password, then lists its accounts and what each shows', async () => {
    let worlds: unknown[] = [];
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': () => ok({ items: worlds }),
      'POST /admin/demo/worlds': () => {
        worlds = [WORLD];
        return ok(WORLD, 201);
      },
    });
    renderAdmin(<DemoPage />, { fetch });
    expect(await screen.findByText('No demo world yet.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Password for the demo accounts'), {
      target: { value: 'demo-password-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));

    const table = await screen.findByRole('table', { name: 'Demo world 3' });
    expect(within(table).getByText('demo3@focusforest.test')).toBeTruthy();
    expect(within(table).getByText(/planting ceremony/)).toBeTruthy();
    expect(within(table).getByText(/Resting quietly/)).toBeTruthy();
    expect(within(table).getByText(/Keep my streak/)).toBeTruthy();
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      password: 'demo-password-1',
      reason: 'Demo',
    });
  });

  it('makes the accounts with the emails entered, leaving the blank ones to the API', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [] }),
      'POST /admin/demo/worlds': ok(WORLD, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByText('No demo world yet.');
    fireEvent.change(screen.getByLabelText('Password for the demo accounts'), {
      target: { value: 'demo-password-1' },
    });
    fireEvent.change(screen.getByLabelText('Email for Presenter (Bill)'), {
      target: { value: ' bill.presenter@gmail.com ' },
    });
    fireEvent.change(screen.getByLabelText('Email for Friend (Khoa)'), {
      target: { value: 'khoa@team.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
        password: 'demo-password-1',
        reason: 'Demo',
        emails: { main: 'bill.presenter@gmail.com', 'friend-khoa': 'khoa@team.dev' },
      }),
    );
  });

  it('says when an email entered already has an account', async () => {
    const { fetch } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [] }),
      'POST /admin/demo/worlds': ok(
        nestError(
          409,
          'real@example.com already has an account. A demo world only makes new accounts.',
          'email_taken',
        ),
        409,
      ),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByText('No demo world yet.');
    fireEvent.change(screen.getByLabelText('Password for the demo accounts'), {
      target: { value: 'demo-password-1' },
    });
    fireEvent.change(screen.getByLabelText('Email for Presenter (Bill)'), {
      target: { value: 'real@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    expect(await screen.findByText(/real@example.com already has an account/)).toBeTruthy();
  });

  it('refuses a short password before sending', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [] }),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByText('No demo world yet.');
    fireEvent.change(screen.getByLabelText('Password for the demo accounts'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('shows the API’s reason when a world cannot be made yet', async () => {
    const { fetch } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [] }),
      'POST /admin/demo/worlds': ok(
        nestError(422, 'A demo world needs the 8th of the month or later.', 'demo_too_early'),
        422,
      ),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByText('No demo world yet.');
    fireEvent.change(screen.getByLabelText('Password for the demo accounts'), {
      target: { value: 'demo-password-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    expect(await screen.findByText(/8th of the month/)).toBeTruthy();
  });

  it('sends a notification now and says what became of it', async () => {
    let reply: Reply = ok(
      {
        category: 'monthlyRecapReady',
        status: 'sent',
        reason: null,
        title: 'Your September recap is ready',
      },
      201,
    );
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/notify': () => reply,
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('table', { name: 'Demo world 3' });
    fireEvent.change(screen.getByLabelText('Notification'), {
      target: { value: 'monthlyRecapReady' },
    });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Sent: “Your September recap is ready”')).toBeTruthy();
    expect(requests.at(-1)?.body).toEqual({ persona: 'main', category: 'monthlyRecapReady' });

    reply = ok(
      { category: 'badgeUnlocked', status: 'skipped', reason: 'no_device', title: null },
      201,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText(/No phone is registered for this account/)).toBeTruthy();
  });

  it('lets a friend join the presenter’s room, and says to open one first', async () => {
    let reply: Reply = ok(
      nestError(409, 'Open a room in Focus Together on the phone first.', 'no_lobby'),
      409,
    );
    const { fetch } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/friend-ready': () => reply,
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('table', { name: 'Demo world 3' });
    fireEvent.click(screen.getByRole('button', { name: 'Khoa joins my room and is ready' }));
    expect(await screen.findByText(/Open a room in Focus Together/)).toBeTruthy();
    reply = ok({ id: 'r1' }, 201);
    fireEvent.click(screen.getByRole('button', { name: 'Khoa joins my room and is ready' }));
    expect(await screen.findByText(/Khoa is in your room and ready/)).toBeTruthy();
  });

  it('adds a session for an account, which the phone celebrates at once', async () => {
    let reply: Reply = ok({ id: 's1' }, 201);
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/session': () => reply,
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('table', { name: 'Demo world 3' });
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a finished session' }));
    expect(
      await screen.findByText('Added 25 minutes for Bill. The phone shows it now.'),
    ).toBeTruthy();
    expect(requests.at(-1)?.body).toEqual({ persona: 'main', minutes: 25 });

    reply = ok(
      nestError(
        409,
        'The last session ended moments ago: wait 24 more minutes, or add a shorter one.',
        'too_soon',
      ),
      409,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a finished session' }));
    expect(await screen.findByText(/wait 24 more minutes/)).toBeTruthy();
  });

  it('makes today a rest day and has a friend react', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/rest-today': ok({}, 201),
      'POST /admin/demo/worlds/3/react': ok({}, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('table', { name: 'Demo world 3' });
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make today a rest day' }));
    expect(await screen.findByText('Today is a rest day for Bill.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Friend'), { target: { value: 'friend-linh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Friend reacts to the forest' }));
    expect(await screen.findByText('Linh reacted to Bill’s forest.')).toBeTruthy();
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.body)).toEqual([
      { persona: 'main' },
      { persona: 'friend-linh' },
    ]);
  });

  it('shows the Demo link to admins only', async () => {
    const { fetch } = api({});
    renderAdmin(<AdminShell>{null}</AdminShell>, { fetch, signedIn: session('admin') });
    expect(await screen.findByRole('link', { name: 'Demo' })).toBeTruthy();
    sessionStorage.clear();
  });

  it('hides the Demo link from support', async () => {
    const { fetch } = api({});
    renderAdmin(<AdminShell>{null}</AdminShell>, { fetch, signedIn: session('support') });
    await screen.findByRole('link', { name: 'Users' });
    expect(screen.queryByRole('link', { name: 'Demo' })).toBeNull();
    await waitFor(() => expect(true).toBe(true));
  });
});
