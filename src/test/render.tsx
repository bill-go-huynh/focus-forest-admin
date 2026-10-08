import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { AdminSessionProvider, SESSION_KEY } from '../lib/session';
import type { AdminSession } from '../lib/schemas';

/** The router calls a test can read (next/navigation is mocked in each test file). */
export const navigation = {
  push: vi.fn(),
  replace: vi.fn(),
  params: {} as Record<string, string>,
  pathname: '/',
};

export function session(role: 'admin' | 'support' = 'admin'): AdminSession {
  return {
    accessToken: `${role}-token`,
    accessTokenExpiresAt: '2026-10-08T12:30:00.000Z',
    admin: { id: `${role}-1`, email: `${role}@example.com`, role },
  };
}

/** Renders inside the app's providers, with the admin API answered by `fetch`. */
export function renderAdmin(
  ui: ReactNode,
  {
    fetch,
    signedIn = session(),
  }: { fetch: typeof globalThis.fetch; signedIn?: AdminSession | null },
) {
  if (signedIn) sessionStorage.setItem(SESSION_KEY, JSON.stringify(signedIn));
  else sessionStorage.removeItem(SESSION_KEY);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider baseUrl="https://api.example.com" fetch={fetch}>
        {ui}
      </AdminSessionProvider>
    </QueryClientProvider>,
  );
}
