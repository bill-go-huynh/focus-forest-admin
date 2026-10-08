import { fakeApi, nestError } from '../../test/fake-api';
import { AdminApiError, createAdminApi } from '../api';

const BASE = 'https://api.example.com';

describe('the admin API client (CR.5)', () => {
  it('signs in without a token, then sends the admin token on every request', async () => {
    const net = fakeApi(({ path }) =>
      path === '/admin/auth/sign-in'
        ? {
            status: 200,
            body: {
              accessToken: 'admin-token',
              accessTokenExpiresAt: '2026-10-08T12:30:00.000Z',
              admin: { id: 'a1', email: 'ops@example.com', role: 'admin' },
            },
          }
        : { status: 200, body: { id: 'a1', email: 'ops@example.com', role: 'admin' } },
    );
    let token: string | null = null;
    const api = createAdminApi({ baseUrl: BASE, fetch: net.fetch, getToken: () => token });
    const session = await api.signIn('ops@example.com', 'secret password');
    expect(session.admin.role).toBe('admin');
    expect(net.requests[0]).toMatchObject({
      method: 'POST',
      path: '/admin/auth/sign-in',
      body: { email: 'ops@example.com', password: 'secret password' },
    });
    expect(net.requests[0]?.headers['authorization']).toBeUndefined();
    token = session.accessToken;
    await api.me();
    expect(net.requests[1]?.headers['authorization']).toBe('Bearer admin-token');
  });

  it('turns refusals into errors with their status and code, and reports a lost session', async () => {
    const onUnauthorized = vi.fn();
    const net = fakeApi(({ path }) =>
      path.startsWith('/admin/users/u1/suspend')
        ? { status: 403, body: nestError(403, "Your role can't do this.", 'admin_role_forbidden') }
        : { status: 401, body: nestError(401, 'Sign in to the admin to continue.') },
    );
    const api = createAdminApi({
      baseUrl: BASE,
      fetch: net.fetch,
      getToken: () => 't',
      onUnauthorized,
    });
    await expect(api.suspendUser('u1', 'reason')).rejects.toMatchObject({
      status: 403,
      code: 'admin_role_forbidden',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(api.dashboard()).rejects.toBeInstanceOf(AdminApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('refuses an answer that does not match the admin contract', async () => {
    const net = fakeApi(() => ({ status: 200, body: { signupsLast7Days: 'many' } }));
    const api = createAdminApi({ baseUrl: BASE, fetch: net.fetch, getToken: () => 't' });
    await expect(api.dashboard()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('calls each admin route with the right method, path, and body', async () => {
    const net = fakeApi(({ method }) => (method === 'DELETE' ? { status: 204 } : { status: 599 }));
    const api = createAdminApi({ baseUrl: BASE, fetch: net.fetch, getToken: () => 't' });
    await api.deleteUser('u1', 'GDPR request', 'ada@example.com');
    expect(net.requests[0]).toMatchObject({
      method: 'DELETE',
      path: '/admin/users/u1',
      body: { reason: 'GDPR request', confirmEmail: 'ada@example.com' },
    });
    await expect(api.searchUsers('ada l', 'c1')).rejects.toBeInstanceOf(AdminApiError);
    expect(net.requests[1]?.path).toBe('/admin/users?q=ada+l&cursor=c1');
    await expect(api.checkpoint('2026-09-01', '2026-09-30')).rejects.toBeInstanceOf(AdminApiError);
    expect(net.requests[2]?.path).toBe('/admin/analytics/checkpoint?from=2026-09-01&to=2026-09-30');
  });

  it('says the server is unreachable as a network error', async () => {
    const net = fakeApi(() => new TypeError('fetch failed'));
    const api = createAdminApi({ baseUrl: BASE, fetch: net.fetch, getToken: () => 't' });
    await expect(api.dashboard()).rejects.toMatchObject({ kind: 'network' });
  });
});
