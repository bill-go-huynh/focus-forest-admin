import type { z } from 'zod';

import {
  adminIdentitySchema,
  adminRoomSchema,
  auditPageSchema,
  checkpointSchema,
  configViewSchema,
  dashboardSchema,
  reportDetailSchema,
  reportPageSchema,
  revealedNoteSchema,
  roomListSchema,
  sessionPageSchema,
  signInSchema,
  userDetailSchema,
  userPageSchema,
  userRowSchema,
  type ModerationAction,
  type ReportStatus,
} from './schemas';

export type AdminApiErrorKind = 'http' | 'network' | 'invalid_response';

/** A refused or failed admin request. Branch on `status` and `code`, never on the text. */
export class AdminApiError extends Error {
  constructor(
    readonly kind: AdminApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export interface AdminApiOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called on a 401 for a signed-in request: the admin token expired or the admin was disabled. */
  onUnauthorized?: () => void;
  fetch?: typeof globalThis.fetch;
}

/**
 * The admin web app's only way to product data (AGENTS.md: admin-scoped API endpoints, never the
 * database). Every answer is parsed with its schema.
 */
export function createAdminApi(options: AdminApiOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(
    path: string,
    schema: z.ZodType<T> | null,
    init: { method?: string; body?: unknown; signedIn?: boolean } = {},
  ): Promise<T> {
    const signedIn = init.signedIn ?? true;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const token = signedIn ? options.getToken() : null;
    if (token) headers['authorization'] = `Bearer ${token}`;
    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new AdminApiError('network', "The admin API can't be reached right now.");
    }
    const text = await response.text();
    const json: unknown = text ? safeJson(text) : undefined;
    if (!response.ok) {
      if (response.status === 401 && signedIn) options.onUnauthorized?.();
      const body = (json ?? {}) as { message?: unknown; code?: unknown };
      const message = Array.isArray(body.message)
        ? body.message.join(' ')
        : typeof body.message === 'string'
          ? body.message
          : `The admin API answered ${response.status}.`;
      throw new AdminApiError(
        'http',
        message,
        response.status,
        typeof body.code === 'string' ? body.code : null,
      );
    }
    if (!schema) return undefined as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AdminApiError('invalid_response', 'The admin API sent an unexpected answer.');
    }
    return parsed.data;
  }

  const query = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]),
    ).toString();
    return search ? `?${search}` : '';
  };

  return {
    signIn: (email: string, password: string) =>
      request('/admin/auth/sign-in', signInSchema, {
        method: 'POST',
        body: { email, password },
        signedIn: false,
      }),
    me: () => request('/admin/auth/me', adminIdentitySchema),
    dashboard: () => request('/admin/dashboard', dashboardSchema),
    searchUsers: (q?: string, cursor?: string) =>
      request(`/admin/users${query({ q, cursor })}`, userPageSchema),
    user: (id: string) => request(`/admin/users/${id}`, userDetailSchema),
    sessions: (id: string, cursor?: string) =>
      request(`/admin/users/${id}/sessions${query({ cursor })}`, sessionPageSchema),
    revealNote: (userId: string, sessionId: string, reason: string) =>
      request(`/admin/users/${userId}/sessions/${sessionId}/note-reveal`, revealedNoteSchema, {
        method: 'POST',
        body: { reason },
      }),
    suspendUser: (id: string, reason: string) =>
      request(`/admin/users/${id}/suspend`, userRowSchema, { method: 'POST', body: { reason } }),
    reactivateUser: (id: string, reason: string) =>
      request(`/admin/users/${id}/reactivate`, userRowSchema, {
        method: 'POST',
        body: { reason },
      }),
    deleteUser: (id: string, reason: string, confirmEmail: string) =>
      request(`/admin/users/${id}`, null, { method: 'DELETE', body: { reason, confirmEmail } }),
    config: () => request('/admin/config', configViewSchema),
    auditLog: (cursor?: string) => request(`/admin/audit-log${query({ cursor })}`, auditPageSchema),
    checkpoint: (from: string, to: string) =>
      request(`/admin/analytics/checkpoint${query({ from, to })}`, checkpointSchema),
    // D5.1: reports and moderation (admins and moderators).
    reports: (status?: ReportStatus, cursor?: string) =>
      request(`/admin/reports${query({ status, cursor })}`, reportPageSchema),
    report: (id: string) => request(`/admin/reports/${id}`, reportDetailSchema),
    reviewReport: (id: string) =>
      request(`/admin/reports/${id}/review`, reportDetailSchema, { method: 'POST', body: {} }),
    resolveReport: (id: string, action: ModerationAction, reason: string, message?: string) =>
      request(`/admin/reports/${id}/resolve`, reportDetailSchema, {
        method: 'POST',
        body: { action, reason, ...(message !== undefined && { message }) },
      }),
    dismissReport: (id: string, reason: string) =>
      request(`/admin/reports/${id}/dismiss`, reportDetailSchema, {
        method: 'POST',
        body: { reason },
      }),
    // D5.1: focus rooms.
    rooms: () => request('/admin/rooms', roomListSchema),
    closeRoom: (id: string, reason: string) =>
      request(`/admin/rooms/${id}/close`, adminRoomSchema, { method: 'POST', body: { reason } }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
