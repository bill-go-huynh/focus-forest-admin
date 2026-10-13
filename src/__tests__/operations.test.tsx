import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { AuditLog } from '../features/audit/AuditLog';
import { ConfigView } from '../features/config/ConfigView';
import { UserDetail } from '../features/users/UserDetail';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { ADA_DETAIL, ADA_ROW, AUDIT, CONFIG, SESSIONS } from '../test/fixtures';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D6.3 Configuration & operations (docs/09 → Configuration: versions, diff, sample-month
 * preview, activation with confirmation; support actions: compensation grants; audit log
 * filters; notification diagnostics). Configuration versions and grants are admins' only.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  sessionStorage.clear();
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

const V5 = { version: 5, note: 'Launch values.', createdAt: '2026-10-01T09:00:00.000Z' };
const V6 = { version: 6, note: 'A lower daily soft cap.', createdAt: '2026-10-12T09:00:00.000Z' };
const tree = (stage: string, fullnessLevel: number, growthMinutes: number) => ({
  stage,
  fullnessLevel,
  blossomLevel: 1,
  richnessTier: 0,
  traitIds: [],
  activeDays: 20,
  focusedMinutes: 3600,
  growthMinutes,
});

describe('configuration versions (D6.3)', { timeout: 15_000 }, () => {
  it('stays read only for support, who never see versions', async () => {
    const { fetch, requests } = api({ 'GET /admin/config': ok(CONFIG) });
    renderAdmin(<ConfigView />, { fetch, signedIn: session('support') });
    await screen.findByText('Configuration v5 (active)');
    expect(screen.queryByRole('table', { name: 'Versions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose a version' })).toBeNull();
    expect(requests.map((r) => r.path)).toEqual(['/admin/config']);
  });

  it('reviews a version against the active one, then activates it with a reason', async () => {
    let active = 5;
    const { fetch, requests } = api({
      'GET /admin/config': () => ok({ ...CONFIG, version: active }),
      'GET /admin/config/versions': () =>
        ok({
          items: [
            { ...V6, active: active === 6 },
            { ...V5, active: active === 5 },
          ],
        }),
      'GET /admin/config/versions/6/diff': ok({
        against: 5,
        changes: [
          { key: 'growth.dailySoftCapMinutes', active: 240, proposed: 120 },
          { key: 'forest.areaLevels', active: { lake: 2 }, proposed: null },
        ],
      }),
      'GET /admin/config/versions/6/preview': ok({
        against: 5,
        samples: [
          {
            id: 'light',
            label: 'Light',
            active: tree('sprout', 1, 80),
            proposed: tree('sprout', 1, 80),
          },
          {
            id: 'deep',
            label: 'Deep',
            active: tree('blooming_tree', 4, 3600),
            proposed: tree('mature_tree', 3, 2400),
          },
        ],
      }),
      'POST /admin/config/versions/6/activate': () => {
        active = 6;
        return ok({ ...V6, active: true });
      },
    });
    renderAdmin(<ConfigView />, { fetch, signedIn: session('admin') });

    const versions = await screen.findByRole('table', { name: 'Versions' });
    const v5 = within(versions).getByText('v5').closest('tr')!;
    expect(within(v5).getByText('Active')).toBeDefined();
    expect(within(v5).queryByRole('button')).toBeNull();
    fireEvent.click(within(versions).getByRole('button', { name: 'Review v6' }));

    const changes = await screen.findByRole('table', { name: 'Changes against v5' });
    expect(
      within(changes)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['growth.dailySoftCapMinutes240120', 'forest.areaLevels{"lake":2}—']);

    const samples = await screen.findByRole('table', { name: 'Sample months' });
    const deep = within(samples).getByText('Deep').closest('tr')!;
    // Each cell shows the active result, then the proposed one when it differs.
    expect(within(deep).getByText('Blooming tree → Mature tree')).toBeDefined();
    expect(within(deep).getByText('4 → 3')).toBeDefined();
    expect(within(deep).getByText('3600 → 2400')).toBeDefined();
    const light = within(samples).getByText('Light').closest('tr')!;
    expect(within(light).getByText('Sprout')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Activate v6' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Trees already grown keep the version they grew under/),
    ).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Long days grew trees too fast' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await screen.findByText('Configuration v6 (active)');
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      reason: 'Long days grew trees too fast',
    });
    await waitFor(() =>
      expect(within(screen.getByText('v6').closest('tr')!).getByText('Active')).toBeDefined(),
    );
    expect(screen.queryByRole('button', { name: 'Activate v6' })).toBeNull();
  });

  it('proposes a version from the active values, refusing what is not JSON', async () => {
    let attempts = 0;
    const { fetch, requests } = api({
      'GET /admin/config': ok(CONFIG),
      'GET /admin/config/versions': ok({ items: [{ ...V5, active: true }] }),
      'POST /admin/config/versions': () => {
        attempts += 1;
        return attempts === 1
          ? ok(
              {
                ...nestError(422, 'The configuration is not valid.', 'invalid_config'),
                problems: [
                  'session.minValidMinutes must be a whole number from 1 to 60.',
                  'note must say what changes, in 3 to 200 characters.',
                ],
              },
              422,
            )
          : ok({ ...V6, active: false }, 201);
      },
      'GET /admin/config/versions/6/diff': ok({ against: 5, changes: [] }),
      'GET /admin/config/versions/6/preview': ok({ against: 5, samples: [] }),
    });
    renderAdmin(<ConfigView />, { fetch, signedIn: session('admin') });
    await screen.findByRole('table', { name: 'Versions' });

    fireEvent.click(screen.getByRole('button', { name: 'Propose a version' }));
    const form = screen.getByRole('form', { name: 'Propose a version' });
    const values = within(form).getByLabelText('Values (JSON)') as HTMLTextAreaElement;
    // It starts from the active configuration.
    expect(JSON.parse(values.value)).toEqual(CONFIG.values);
    fireEvent.change(values, { target: { value: '{ "session.minValidMinutes": ' } });
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'No' } });
    fireEvent.change(within(form).getByLabelText('Reason'), { target: { value: 'Testing' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Propose' }));
    expect(within(form).getByRole('alert').textContent).toContain('Values must be valid JSON');
    expect(requests.some((r) => r.method === 'POST')).toBe(false);

    const proposed = { ...CONFIG.values, 'session.minValidMinutes': 0 };
    fireEvent.change(values, { target: { value: JSON.stringify(proposed) } });
    fireEvent.click(within(form).getByRole('button', { name: 'Propose' }));
    const alert = await within(form).findByRole('alert');
    await waitFor(() =>
      expect(
        within(alert)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        'session.minValidMinutes must be a whole number from 1 to 60.',
        'note must say what changes, in 3 to 200 characters.',
      ]),
    );

    fireEvent.change(within(form).getByLabelText('Note'), {
      target: { value: 'A lower daily soft cap.' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Propose' }));
    expect(await screen.findByText('No changes against v5.')).toBeDefined();
    expect(screen.queryByRole('form', { name: 'Propose a version' })).toBeNull();
    expect(requests.filter((r) => r.method === 'POST').at(-1)!.body).toEqual({
      values: proposed,
      note: 'A lower daily soft cap.',
      reason: 'Testing',
    });
  });
});

const DIAGNOSTICS = {
  devices: [
    {
      token: 'ExponentPushToken[abc…456]',
      platform: 'ios',
      appVersion: '1.4.0',
      registeredAt: '2026-10-01T08:00:00.000Z',
      lastSeenAt: '2026-10-12T19:00:00.000Z',
    },
  ],
  focusUntil: '2026-10-13T10:25:00.000Z',
  enabled: [
    { category: 'daily_goal', time: '20:00' },
    { category: 'event_start', time: null },
  ],
  recent: [
    {
      category: 'daily_goal',
      title: 'A little time for your tree?',
      status: 'skipped',
      reason: 'focusing',
      notBefore: '2026-10-12T20:00:00.000Z',
      sentAt: null,
    },
    {
      category: 'event_start',
      title: 'Autumn Focus has begun',
      status: 'sent',
      reason: null,
      notBefore: '2026-10-12T09:00:00.000Z',
      sentAt: '2026-10-12T09:00:05.000Z',
    },
  ],
};

describe('a user’s operations (D6.3)', { timeout: 15_000 }, () => {
  const routes = (extra: Record<string, Reply | ((r: Recorded) => Reply)> = {}) => ({
    [`GET /admin/users/${ADA_ROW.id}`]: ok(ADA_DETAIL),
    [`GET /admin/users/${ADA_ROW.id}/sessions`]: ok(SESSIONS),
    [`GET /admin/users/${ADA_ROW.id}/notifications`]: ok(DIAGNOSTICS),
    ...extra,
  });
  beforeEach(() => {
    navigation.params = { id: ADA_ROW.id };
  });

  it('shows notification diagnostics to admins and support, never moderators', async () => {
    const { fetch } = api(routes());
    const view = renderAdmin(<UserDetail />, { fetch, signedIn: session('support') });
    const section = await screen.findByRole('region', { name: 'Notifications' });
    const devices = await within(section).findByRole('table', { name: 'Devices' });
    expect(within(devices).getByText('ExponentPushToken[abc…456]')).toBeDefined();
    expect(within(devices).getByText('ios')).toBeDefined();
    expect(within(section).getByText('Focusing until 2026-10-13 10:25 UTC')).toBeDefined();
    expect(within(section).getByText('Turned on: daily_goal (20:00), event_start')).toBeDefined();
    const recent = within(section).getByRole('table', { name: 'Recent notifications' });
    const skipped = within(recent).getByText('A little time for your tree?').closest('tr')!;
    expect(within(skipped).getByText('skipped')).toBeDefined();
    expect(within(skipped).getByText('focusing')).toBeDefined();
    // Support never grants.
    expect(screen.queryByRole('region', { name: 'Compensation' })).toBeNull();
    view.unmount();

    const moderator = api({
      [`GET /admin/users/${ADA_ROW.id}`]: ok(ADA_DETAIL),
      [`GET /admin/users/${ADA_ROW.id}/sessions`]: ok(SESSIONS),
    });
    renderAdmin(<UserDetail />, { fetch: moderator.fetch, signedIn: session('moderator') });
    await screen.findByText(ADA_ROW.email);
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
    expect(moderator.requests.some((r) => r.path.endsWith('/notifications'))).toBe(false);
  });

  it('says plainly when nothing is registered or turned on', async () => {
    const { fetch } = api(
      routes({
        [`GET /admin/users/${ADA_ROW.id}/notifications`]: ok({
          devices: [],
          focusUntil: null,
          enabled: [],
          recent: [],
        }),
      }),
    );
    renderAdmin(<UserDetail />, { fetch, signedIn: session('admin') });
    const section = await screen.findByRole('region', { name: 'Notifications' });
    expect(await within(section).findByText('No device registered.')).toBeDefined();
    expect(within(section).getByText('Not focusing.')).toBeDefined();
    expect(within(section).getByText('No notification turned on.')).toBeDefined();
    expect(within(section).getByText('No notification yet.')).toBeDefined();
  });

  it('grants a reward as compensation, confirmed with a reason, and shows refusals', async () => {
    let grants = 0;
    const { fetch, requests } = api(
      routes({
        [`POST /admin/users/${ADA_ROW.id}/grants`]: () => {
          grants += 1;
          return grants === 1
            ? ok(nestError(409, 'They already own it.', 'already_owned'), 409)
            : ok(
                { kind: 'badge', itemId: 'night-owl', grantedAt: '2026-10-13T10:00:00.000Z' },
                201,
              );
        },
      }),
    );
    renderAdmin(<UserDetail />, { fetch, signedIn: session('admin') });
    const section = await screen.findByRole('region', { name: 'Compensation' });
    fireEvent.change(within(section).getByLabelText('Kind'), { target: { value: 'badge' } });
    fireEvent.change(within(section).getByLabelText('Item id'), { target: { value: 'night-owl' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Grant' }));

    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Grant the badge “night-owl”?')).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Missed by the outage' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Grant' }));
    expect(await within(dialog).findByText('They already own it.')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(section).getByRole('button', { name: 'Grant' }));
    dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Missed by the outage' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Grant' }));
    expect(await within(section).findByText('Granted the badge night-owl.')).toBeDefined();
    expect(requests.filter((r) => r.method === 'POST').at(-1)!.body).toEqual({
      kind: 'badge',
      itemId: 'night-owl',
      reason: 'Missed by the outage',
    });
  });
});

describe('audit log filters (D6.3)', { timeout: 15_000 }, () => {
  it('filters by admin, action, target, and time, and clears', async () => {
    const { fetch, requests } = api({
      'GET /admin/audit-log': ok(AUDIT),
      'GET /admin/audit-log?action=user.grant&targetType=user&targetId=abc&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-14T00%3A00%3A00.000Z':
        ok({ items: [], nextCursor: null }),
      'GET /admin/audit-log?adminId=admin-1': ok(AUDIT),
      'GET /admin/audit-log?adminId=admin-1&cursor=next-page': ok({ items: [], nextCursor: null }),
    });
    renderAdmin(<AuditLog />, { fetch, signedIn: session('admin') });
    await screen.findByText('abuse report');

    const filters = screen.getByRole('search', { name: 'Filter the audit log' });
    const field = (label: string) => within(filters).getByLabelText(label);
    fireEvent.change(field('Action'), { target: { value: 'user.grant' } });
    fireEvent.change(field('Target type'), { target: { value: 'user' } });
    // Stray spaces are trimmed.
    fireEvent.change(field('Target id'), { target: { value: '  abc ' } });
    fireEvent.change(field('From'), { target: { value: '2026-10-01T00:00:00.000Z' } });
    fireEvent.change(field('Before'), { target: { value: '2026-10-14T00:00:00.000Z' } });
    fireEvent.submit(filters);
    expect(await screen.findByText('No entries match.')).toBeDefined();

    // Clearing shows everything again, and empties the fields.
    fireEvent.click(within(filters).getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText('abuse report')).toBeDefined();
    expect((field('Action') as HTMLInputElement).value).toBe('');
    fireEvent.change(field('Admin id'), { target: { value: 'admin-1' } });
    fireEvent.submit(filters);
    expect(await screen.findByText('abuse report')).toBeDefined();
    // More pages keep the filters.
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() =>
      expect(requests.map((r) => r.path)).toContain(
        '/admin/audit-log?adminId=admin-1&cursor=next-page',
      ),
    );
  });
});
