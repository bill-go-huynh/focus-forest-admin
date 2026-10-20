import type { z } from 'zod';

import {
  demoNotifyResultSchema,
  demoStatusSchema,
  demoWorldListSchema,
  demoWorldSchema,
  type DemoCategory,
  type DemoPersona,
  adminIdentitySchema,
  adminRoomSchema,
  auditPageSchema,
  catalogItemSchema,
  catalogListSchema,
  checkpointSchema,
  clientErrorGroupsSchema,
  configDiffSchema,
  configPreviewSchema,
  configVersionListSchema,
  configVersionSchema,
  configViewSchema,
  dashboardSchema,
  exclusionListSchema,
  exclusionSchema,
  grantSchema,
  integrityListSchema,
  liveEventListSchema,
  liveEventSchema,
  rateLimitRefusalsSchema,
  notificationDiagnosticsSchema,
  reportDetailSchema,
  reportPageSchema,
  revealedNoteSchema,
  roomListSchema,
  sessionPageSchema,
  signInSchema,
  staffBoardSchema,
  themeListSchema,
  themeSchema,
  userDetailSchema,
  userPageSchema,
  userRowSchema,
  type CatalogKind,
  type GrantKind,
  type ModerationAction,
  type ReportStatus,
} from './schemas';

/** Audit log filters (D6.3): `from` inclusive, `to` exclusive, both ISO 8601 instants. */
export interface AuditFilters {
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

/** A board staff can view: global by period, or one event's. */
export type StaffBoardQuery =
  { scope: 'global'; period: 'weekly' | 'monthly' } | { scope: 'event'; eventId: string };

export type AdminApiErrorKind = 'http' | 'network' | 'invalid_response';

/** A refused or failed admin request. Branch on `status` and `code`, never on the text. */
export class AdminApiError extends Error {
  constructor(
    readonly kind: AdminApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
    /** Every problem the API named (a 422 with `problems`), to show them all at once. */
    readonly problems: readonly string[] = [],
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
      const body = (json ?? {}) as { message?: unknown; code?: unknown; problems?: unknown };
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
        Array.isArray(body.problems)
          ? body.problems.filter((p): p is string => typeof p === 'string')
          : [],
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
    auditLog: (cursor?: string, filters: AuditFilters = {}) =>
      request(`/admin/audit-log${query({ ...filters, cursor })}`, auditPageSchema),
    // D6.3: configuration versions (admins only).
    configVersions: () => request('/admin/config/versions', configVersionListSchema),
    configDiff: (version: number) =>
      request(`/admin/config/versions/${version}/diff`, configDiffSchema),
    configPreview: (version: number) =>
      request(`/admin/config/versions/${version}/preview`, configPreviewSchema),
    proposeConfig: (values: Record<string, unknown>, note: string, reason: string) =>
      request('/admin/config/versions', configVersionSchema, {
        method: 'POST',
        body: { values, note, reason },
      }),
    activateConfig: (version: number, reason: string) =>
      request(`/admin/config/versions/${version}/activate`, configVersionSchema, {
        method: 'POST',
        body: { reason },
      }),
    // D6.3: compensation grants (admins) and notification diagnostics (admins and support).
    grant: (userId: string, kind: GrantKind, itemId: string, reason: string) =>
      request(`/admin/users/${userId}/grants`, grantSchema, {
        method: 'POST',
        body: { kind, itemId, reason },
      }),
    notificationDiagnostics: (userId: string) =>
      request(`/admin/users/${userId}/notifications`, notificationDiagnosticsSchema),
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
    // D6.1: the content catalog (admins and content staff).
    catalog: (kind: CatalogKind) => request(`/admin/content/${kind}`, catalogListSchema),
    createCatalogItem: (kind: CatalogKind, body: Record<string, unknown>) =>
      request(`/admin/content/${kind}`, catalogItemSchema, { method: 'POST', body }),
    updateCatalogItem: (kind: CatalogKind, id: string, body: Record<string, unknown>) =>
      request(`/admin/content/${kind}/${encodeURIComponent(id)}`, catalogItemSchema, {
        method: 'PATCH',
        body,
      }),
    deleteCatalogItem: (kind: CatalogKind, id: string, reason: string) =>
      request(`/admin/content/${kind}/${encodeURIComponent(id)}`, null, {
        method: 'DELETE',
        body: { reason },
      }),
    // D6.2: live operations (admins and content staff).
    liveEvents: () => request('/admin/live/events', liveEventListSchema),
    liveEvent: (id: string) =>
      request(`/admin/live/events/${encodeURIComponent(id)}`, liveEventSchema),
    createLiveEvent: (body: Record<string, unknown>) =>
      request('/admin/live/events', liveEventSchema, { method: 'POST', body }),
    updateLiveEvent: (id: string, body: Record<string, unknown>) =>
      request(`/admin/live/events/${encodeURIComponent(id)}`, liveEventSchema, {
        method: 'PATCH',
        body,
      }),
    deleteLiveEvent: (id: string, reason: string) =>
      request(`/admin/live/events/${encodeURIComponent(id)}`, null, {
        method: 'DELETE',
        body: { reason },
      }),
    themes: () => request('/admin/live/themes', themeListSchema),
    createTheme: (body: Record<string, unknown>) =>
      request('/admin/live/themes', themeSchema, { method: 'POST', body }),
    updateTheme: (id: string, body: Record<string, unknown>) =>
      request(`/admin/live/themes/${encodeURIComponent(id)}`, themeSchema, {
        method: 'PATCH',
        body,
      }),
    deleteTheme: (id: string, reason: string) =>
      request(`/admin/live/themes/${encodeURIComponent(id)}`, null, {
        method: 'DELETE',
        body: { reason },
      }),
    staffBoard: (board: StaffBoardQuery) =>
      request(
        `/admin/live/leaderboards${query(
          board.scope === 'event'
            ? { scope: 'event', eventId: board.eventId }
            : { scope: 'global', period: board.period },
        )}`,
        staffBoardSchema,
      ),
    exclusions: () => request('/admin/live/leaderboard-exclusions', exclusionListSchema),
    exclude: (userId: string, reason: string) =>
      request('/admin/live/leaderboard-exclusions', exclusionSchema, {
        method: 'POST',
        body: { userId, reason },
      }),
    include: (userId: string, reason: string) =>
      request(`/admin/live/leaderboard-exclusions/${encodeURIComponent(userId)}`, null, {
        method: 'DELETE',
        body: { reason },
      }),
    // D7.1: leaderboard integrity (admins and content staff) and app errors (admins, support).
    integrityFlags: () => request('/admin/integrity/flags', integrityListSchema),
    dismissIntegrityFlag: (userId: string, key: string, reason: string) =>
      request('/admin/integrity/dismissals', null, {
        method: 'POST',
        body: { userId, key, reason },
      }),
    clientErrors: (days: number) =>
      request(`/admin/client-errors${query({ days: String(days) })}`, clientErrorGroupsSchema),
    rateLimitRefusals: () => request('/admin/rate-limits', rateLimitRefusalsSchema),
    // DM.2: demo tools (spec/demo/PLAN.md).
    demoStatus: () => request('/admin/demo/status', demoStatusSchema),
    demoWorlds: () => request('/admin/demo/worlds', demoWorldListSchema),
    makeDemoWorld: (password: string, reason: string) =>
      request('/admin/demo/worlds', demoWorldSchema, {
        method: 'POST',
        body: { password, reason },
      }),
    demoNotify: (world: number, persona: DemoPersona, category: DemoCategory) =>
      request(`/admin/demo/worlds/${world}/notify`, demoNotifyResultSchema, {
        method: 'POST',
        body: { persona, category },
      }),
    demoSession: (world: number, persona: DemoPersona, minutes: number) =>
      request(`/admin/demo/worlds/${world}/session`, null, {
        method: 'POST',
        body: { persona, minutes },
      }),
    demoRestToday: (world: number, persona: DemoPersona) =>
      request(`/admin/demo/worlds/${world}/rest-today`, null, {
        method: 'POST',
        body: { persona },
      }),
    demoReact: (world: number, persona: DemoPersona) =>
      request(`/admin/demo/worlds/${world}/react`, null, { method: 'POST', body: { persona } }),
    demoFriendReady: (world: number) =>
      request(`/admin/demo/worlds/${world}/friend-ready`, null, { method: 'POST', body: {} }),
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
