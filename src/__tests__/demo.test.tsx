import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { DemoPage } from '../features/demo/DemoPage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * DM.2 Demo tools (spec/demo/PLAN.md): make a demo world on one email, then drive that one
 * account with one-click actions (owner, 2026-10-22: one account on the phone, no other sign-ins). Admins only;
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
    {
      persona: 'main',
      email: 'bill.huynh@gmail.com',
      userId: 'u1',
      name: 'Bill',
      signIn: 'google',
      password: null,
    },
    {
      persona: 'comeback',
      email: 'demo3-comeback@focusforest.test',
      userId: 'u2',
      name: 'An',
      signIn: 'password',
      password: 'focus-forest-demo',
    },
    {
      persona: 'recovery',
      email: 'demo3-recovery@focusforest.test',
      userId: 'u3',
      name: 'Vy',
      signIn: 'password',
      password: 'focus-forest-demo',
    },
    {
      persona: 'friend-mai',
      email: 'demo3-friend-mai@focusforest.test',
      userId: 'u4',
      name: 'Mai',
      signIn: 'password',
      password: 'focus-forest-demo',
    },
    {
      persona: 'friend-khoa',
      email: 'demo3-friend-khoa@focusforest.test',
      userId: 'u5',
      name: 'Khoa',
      signIn: 'password',
      password: 'focus-forest-demo',
    },
    {
      persona: 'friend-linh',
      email: 'demo3-friend-linh@focusforest.test',
      userId: 'u6',
      name: 'Linh',
      signIn: 'password',
      password: 'focus-forest-demo',
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

  it('makes a world from one email, then shows that one account and how to sign in', async () => {
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
    // One field, no password (owner, 2026-10-22).
    expect(screen.queryByLabelText(/Password/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Email to seed'), {
      target: { value: ' bill.huynh@gmail.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));

    const account = await screen.findByRole('region', { name: 'Demo account' });
    expect(within(account).getByText('bill.huynh@gmail.com')).toBeTruthy();
    expect(within(account).getByText(/Continue with Google/)).toBeTruthy();
    // Only the presenter: the people around it are driven from here, never signed in to
    // (owner, 2026-10-22).
    // Linh is the one friend shown: the second phone (emulator) signs in to her.
    const second = within(account).getByRole('group', { name: 'Second phone' });
    expect(within(second).getByText('demo3-friend-linh@focusforest.test')).toBeTruthy();
    expect(within(second).getByText(/focus-forest-demo/)).toBeTruthy();
    expect(screen.queryByText(/demo3-comeback/)).toBeNull();
    expect(screen.queryByLabelText('Account')).toBeNull();
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      reason: 'Demo',
      emails: { main: 'bill.huynh@gmail.com' },
    });
  });

  it('gives the password when the world uses a demo address', async () => {
    const blank = {
      ...WORLD,
      accounts: WORLD.accounts.map((a) =>
        a.persona === 'main'
          ? {
              ...a,
              email: 'demo3@focusforest.test',
              signIn: 'password',
              password: 'focus-forest-demo',
            }
          : a,
      ),
    };
    const { fetch } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [blank] }),
    });
    renderAdmin(<DemoPage />, { fetch });
    const account = await screen.findByRole('region', { name: 'Demo account' });
    expect(within(account).getByText('demo3@focusforest.test')).toBeTruthy();
    expect(within(account).getByText(/the password focus-forest-demo/)).toBeTruthy();
  });

  it('acts on the newest world, and can switch to an older one', async () => {
    const older = {
      ...WORLD,
      id: 2,
      accounts: WORLD.accounts.map((a) =>
        a.persona === 'main' ? { ...a, email: 'old@gmail.com' } : a,
      ),
    };
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD, older] }),
      'POST /admin/demo/worlds/2/rest-today': ok({}, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    const account = await screen.findByRole('region', { name: 'Demo account' });
    expect(within(account).getByText('bill.huynh@gmail.com')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Demo world'), { target: { value: '2' } });
    expect(await within(account).findByText('old@gmail.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make today a rest day' }));
    await screen.findByText('Today is a rest day.');
    expect(requests.at(-1)?.path).toBe('/admin/demo/worlds/2/rest-today');
  });

  it('makes a world on a demo address when the email is left blank', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [] }),
      'POST /admin/demo/worlds': ok(WORLD, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByText('No demo world yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ reason: 'Demo' }),
    );
  });

  it('says when the email already has an account', async () => {
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
    fireEvent.change(screen.getByLabelText('Email to seed'), {
      target: { value: 'real@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    expect(await screen.findByText(/real@example.com already has an account/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Make a demo world' }));
    expect(await screen.findByText(/8th of the month/)).toBeTruthy();
  });

  it('opens a fresh waiting room for the presenter', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/room': ok({ opened: true }, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    fireEvent.click(await screen.findByRole('button', { name: 'Open a fresh waiting room' }));
    expect(await screen.findByText(/Mai opened a new waiting room/)).toBeTruthy();
    expect(
      requests.some((r) => r.method === 'POST' && r.path === '/admin/demo/worlds/3/room'),
    ).toBe(true);
  });

  it('sends any notification with one click and says what became of it', async () => {
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
    await screen.findByRole('region', { name: 'Demo account' });
    // One button per notification, no picker.
    expect(screen.getAllByRole('button', { name: /^Send:/ }).length).toBe(10);
    fireEvent.click(screen.getByRole('button', { name: 'Send: Monthly recap ready' }));
    expect(await screen.findByText('Sent: “Your September recap is ready”')).toBeTruthy();
    expect(requests.at(-1)?.body).toEqual({ persona: 'main', category: 'monthlyRecapReady' });

    reply = ok(
      { category: 'badgeUnlocked', status: 'skipped', reason: 'no_device', title: null },
      201,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send: Badge unlocked' }));
    expect(await screen.findByText(/No phone is registered for this account/)).toBeTruthy();
    expect(requests.at(-1)?.body).toEqual({ persona: 'main', category: 'badgeUnlocked' });
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
    await screen.findByRole('region', { name: 'Demo account' });
    fireEvent.click(screen.getByRole('button', { name: 'Khoa joins my room and is ready' }));
    expect(await screen.findByText(/Open a room in Focus Together/)).toBeTruthy();
    reply = ok({ id: 'r1' }, 201);
    fireEvent.click(screen.getByRole('button', { name: 'Khoa joins my room and is ready' }));
    expect(await screen.findByText(/Khoa is in your room and ready/)).toBeTruthy();
  });

  it('adds a session to the demo account, which the phone celebrates at once', async () => {
    let reply: Reply = ok({ id: 's1' }, 201);
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/session': () => reply,
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('region', { name: 'Demo account' });
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).value).toBe('25');
    fireEvent.click(screen.getByRole('button', { name: 'Add a finished session' }));
    expect(await screen.findByText('Added 25 minutes. The phone shows it now.')).toBeTruthy();
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

  it('makes today a rest day, and friends take turns reacting', async () => {
    const { fetch, requests } = api({
      'GET /admin/demo/status': ok({ enabled: true }),
      'GET /admin/demo/worlds': ok({ items: [WORLD] }),
      'POST /admin/demo/worlds/3/rest-today': ok({}, 201),
      'POST /admin/demo/worlds/3/react': ok({}, 201),
    });
    renderAdmin(<DemoPage />, { fetch });
    await screen.findByRole('region', { name: 'Demo account' });
    fireEvent.click(screen.getByRole('button', { name: 'Make today a rest day' }));
    expect(await screen.findByText('Today is a rest day.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'A friend reacts to the forest' }));
    expect(await screen.findByText('Linh reacted to your forest.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'A friend reacts to the forest' }));
    expect(await screen.findByText('Mai reacted to your forest.')).toBeTruthy();
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.body)).toEqual([
      { persona: 'main' },
      { persona: 'friend-linh' },
      { persona: 'friend-mai' },
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
