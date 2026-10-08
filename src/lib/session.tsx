'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { createAdminApi, type AdminApi } from './api';
import { signInSchema, type AdminSession } from './schemas';

/** The admin session lives in this browser tab only (sessionStorage), never in localStorage. */
export const SESSION_KEY = 'focus-forest-admin/session';

/**
 * The stored session as an external store: the server snapshot is `undefined` (not read yet), so
 * the server render and the first client render agree and hydration never mismatches. When the
 * tab's storage is unavailable, the session is kept in memory until reload.
 */
const listeners = new Set<() => void>();
let memory: string | null = null;

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return memory;
  }
}

function writeRaw(value: string | null): void {
  memory = value;
  try {
    if (value === null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    // Kept in memory instead.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parse(raw: string | null | undefined): AdminSession | null {
  if (!raw) return null;
  try {
    const parsed = signInSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface SessionValue {
  session: AdminSession | null;
  /** False until the stored session was read: nothing redirects before then. */
  ready: boolean;
  api: AdminApi;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function AdminSessionProvider({
  children,
  baseUrl,
  fetch,
}: {
  children: ReactNode;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}) {
  const queryClient = useQueryClient();
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  const session = useMemo(() => parse(raw), [raw]);
  const accessToken = session?.accessToken ?? null;

  const signOut = useCallback(() => {
    writeRaw(null);
    queryClient.clear();
  }, [queryClient]);

  const api = useMemo(
    () =>
      createAdminApi({
        baseUrl,
        fetch,
        getToken: () => accessToken,
        onUnauthorized: signOut,
      }),
    [baseUrl, fetch, accessToken, signOut],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      writeRaw(JSON.stringify(await api.signIn(email, password)));
    },
    [api],
  );

  const value = useMemo(
    () => ({ session, ready: raw !== undefined, api, signIn, signOut }),
    [session, raw, api, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useAdminSession needs an AdminSessionProvider.');
  return value;
}

/** The admin API of the signed-in session. */
export function useAdminApi(): AdminApi {
  return useAdminSession().api;
}
