import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { CatalogPage } from '../features/content/CatalogPage';
import { AdminShell } from '../features/shell/AdminShell';
import { fakeApi, nestError, type Recorded, type Reply } from '../test/fake-api';
import { navigation, renderAdmin, session } from '../test/render';

/**
 * D6.1 Content catalog (docs/09 later admin: badges and achievements, tree variants, cosmetics;
 * tables, detail, edit forms with validation, activate and retire with confirmation and reason,
 * previews). Content staff see the catalog and nothing about users.
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
const links = () =>
  within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent);

const BADGE = {
  id: 'first-session',
  category: 'focus',
  rarity: 'common',
  source: 'achievement',
  availability: 'permanent',
  availableFrom: null,
  availableUntil: null,
  status: 'active',
  name: 'First Session',
  description: 'Your first counted focus session.',
  artworkId: 'first-session',
  sortOrder: 10,
  owners: 3,
};
const UNOWNED = {
  ...BADGE,
  id: 'deep-diver',
  name: 'Deep Diver',
  artworkId: 'deep-diver',
  owners: 0,
};
const COSMETIC = {
  id: 'meadow',
  type: 'background',
  rarity: 'common',
  source: 'system',
  achievementId: null,
  availability: 'permanent',
  availableFrom: null,
  availableUntil: null,
  status: 'active',
  name: 'Meadow',
  description: 'Soft green hills.',
  artworkId: 'meadow',
  sortOrder: 10,
  owners: 0,
};

describe('roles (D6.1)', () => {
  it('shows content staff the dashboard and the catalog only', () => {
    renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('content'),
    });
    expect(links()).toEqual(['Dashboard', 'Content']);
  });

  it('shows admins the catalog among everything else', () => {
    renderAdmin(<AdminShell>content</AdminShell>, {
      fetch: api({}).fetch,
      signedIn: session('admin'),
    });
    expect(links()).toContain('Content');
  });
});

describe('the catalog (D6.1)', () => {
  it('lists each kind with a preview, its status, and how many own it', async () => {
    const { fetch } = api({
      'GET /admin/content/badges': ok({ items: [BADGE, UNOWNED] }),
      'GET /admin/content/cosmetics': ok({ items: [COSMETIC] }),
    });
    renderAdmin(<CatalogPage />, { fetch, signedIn: session('content') });

    const row = (await screen.findByText('First Session')).closest('tr')!;
    expect(within(row).getByText('first-session', { selector: 'code' })).toBeDefined();
    expect(within(row).getByText('Active')).toBeDefined();
    expect(within(row).getByText('3')).toBeDefined();
    // Art ships with the app: the preview names the artwork until the art pass (decision 7).
    expect(within(row).getByLabelText('Artwork first-session (placeholder)')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Cosmetics' }));
    expect(await screen.findByText('Meadow')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cosmetics' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('creates an item, showing every problem the API names', async () => {
    let attempts = 0;
    const { fetch, requests } = api({
      'GET /admin/content/badges': ok({ items: [BADGE] }),
      'POST /admin/content/badges': () => {
        attempts += 1;
        return attempts === 1
          ? ok(
              {
                ...nestError(422, 'id must be lowercase words joined by "-".', 'invalid_content'),
                problems: [
                  'id must be lowercase words joined by "-".',
                  'availableUntil is required for limited content.',
                ],
              },
              422,
            )
          : ok({ ...UNOWNED }, 201);
      },
    });
    renderAdmin(<CatalogPage />, { fetch, signedIn: session('content') });
    await screen.findByText('First Session');

    fireEvent.click(screen.getByRole('button', { name: 'New badge' }));
    const form = screen.getByRole('form', { name: 'New badge' });
    const field = (label: string) => within(form).getByLabelText(label);
    fireEvent.change(field('Id'), { target: { value: 'Deep Diver' } });
    fireEvent.change(field('Name'), { target: { value: 'Deep Diver' } });
    fireEvent.change(field('Description'), { target: { value: 'Twenty long sessions.' } });
    fireEvent.change(field('Artwork id'), { target: { value: 'deep-diver' } });
    fireEvent.change(field('Category'), { target: { value: 'focus' } });
    fireEvent.change(field('Rarity'), { target: { value: 'rare' } });
    fireEvent.change(field('Source'), { target: { value: 'achievement' } });
    fireEvent.change(field('Sort order'), { target: { value: '200' } });
    fireEvent.change(field('Reason'), { target: { value: 'New long-session badge' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'id must be lowercase words joined by "-".',
      'availableUntil is required for limited content.',
    ]);

    fireEvent.change(field('Id'), { target: { value: 'deep-diver' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'New badge' })).toBeNull());
    expect(await screen.findByText('Deep Diver')).toBeDefined();
    expect(requests.filter((r) => r.method === 'POST').at(-1)!.body).toEqual({
      id: 'deep-diver',
      category: 'focus',
      rarity: 'rare',
      source: 'achievement',
      availability: 'permanent',
      availableFrom: null,
      availableUntil: null,
      status: 'planned',
      name: 'Deep Diver',
      description: 'Twenty long sessions.',
      artworkId: 'deep-diver',
      sortOrder: 200,
      reason: 'New long-session badge',
    });
  });

  it('edits only what can change, sending just the changes and a reason', async () => {
    const { fetch, requests } = api({
      'GET /admin/content/badges': ok({ items: [BADGE] }),
      'PATCH /admin/content/badges/first-session': ok({ ...BADGE, status: 'retired' }),
    });
    renderAdmin(<CatalogPage />, { fetch, signedIn: session('content') });
    const row = (await screen.findByText('First Session')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit First Session' });
    // The id and the source never change once created.
    expect(within(form).queryByLabelText('Id')).toBeNull();
    expect(within(form).queryByLabelText('Source')).toBeNull();
    fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'retired' } });
    fireEvent.change(within(form).getByLabelText('Reason'), { target: { value: 'Season over' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(within(row).getByText('Retired')).toBeDefined());
    expect(requests.find((r) => r.method === 'PATCH')!.body).toEqual({
      status: 'retired',
      reason: 'Season over',
    });
  });

  it('deletes only what nobody owns, after a confirmed reason', async () => {
    const { fetch, requests } = api({
      'GET /admin/content/badges': ok({ items: [BADGE, UNOWNED] }),
      'DELETE /admin/content/badges/deep-diver': { status: 204 },
    });
    renderAdmin(<CatalogPage />, { fetch, signedIn: session('content') });
    const owned = (await screen.findByText('First Session')).closest('tr')!;
    expect(within(owned).queryByRole('button', { name: 'Delete' })).toBeNull();

    const unowned = screen.getByText('Deep Diver').closest('tr')!;
    fireEvent.click(within(unowned).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (logged)'), {
      target: { value: 'Created by mistake' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Deep Diver')).toBeNull());
    expect(requests.find((r) => r.method === 'DELETE')).toMatchObject({
      path: '/admin/content/badges/deep-diver',
      body: { reason: 'Created by mistake' },
    });
  });

  it('encodes ids with a part in the path', async () => {
    const streak = { ...BADGE, id: 'focus-streak:7', name: '7-Day Streak' };
    const { fetch, requests } = api({
      'GET /admin/content/badges': ok({ items: [streak] }),
      'PATCH /admin/content/badges/focus-streak%3A7': ok({ ...streak, name: 'Seven Days' }),
    });
    renderAdmin(<CatalogPage />, { fetch, signedIn: session('content') });
    const row = (await screen.findByText('7-Day Streak')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit 7-Day Streak' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Seven Days' } });
    fireEvent.change(within(form).getByLabelText('Reason'), { target: { value: 'Shorter name' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Seven Days')).toBeDefined();
    expect(requests.find((r) => r.method === 'PATCH')!.path).toBe(
      '/admin/content/badges/focus-streak%3A7',
    );
  });
});
