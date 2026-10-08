import { vi } from 'vitest';

/** One scripted answer of the fake admin API: a status and a JSON body, or a network failure. */
export type Reply = { status: number; body?: unknown } | Error;

export interface Recorded {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * The admin API at the network boundary (AGENTS.md: mock the admin API there). `handler` answers
 * each request by method and path (with its query); every request is recorded.
 */
export function fakeApi(handler: (request: Recorded) => Reply | Promise<Reply>) {
  const requests: Recorded[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const request: Recorded = {
      method: init.method ?? 'GET',
      path: url.pathname + url.search,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    requests.push(request);
    const reply = await handler(request);
    if (reply instanceof Error) throw reply;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, requests };
}

export const nestError = (statusCode: number, message: string, code?: string) => ({
  statusCode,
  message,
  error: 'Error',
  ...(code ? { code } : {}),
});
