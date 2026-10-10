import type { z } from 'zod';

import contract from '../../test/admin-contract.json';
import {
  adminIdentitySchema,
  auditPageSchema,
  checkpointSchema,
  configViewSchema,
  dashboardSchema,
  revealedNoteSchema,
  sessionPageSchema,
  signInSchema,
  userDetailSchema,
  userPageSchema,
  userRowSchema,
} from '../schemas';

/**
 * CR.X admin contract parity: every admin answer the web app reads, captured from the real API
 * (focus-forest-api test/cr/checkpoint-journey.int-spec.ts, an identical copy of the same file),
 * parsed with the schema the app uses. Fields the API sends that the app does not read are listed
 * exactly, so a new one is a deliberate decision. Refusals are read by status and code.
 */

type Name = keyof typeof contract;
const ERRORS = ['suspendForbidden', 'deleteMismatch', 'userNotFound'] as const;
type Answer = Exclude<Name, (typeof ERRORS)[number]>;

const SCHEMAS: Record<Answer, z.ZodType> = {
  signIn: signInSchema,
  me: adminIdentitySchema,
  dashboard: dashboardSchema,
  users: userPageSchema,
  user: userDetailSchema,
  sessions: sessionPageSchema,
  noteRevealed: revealedNoteSchema,
  suspended: userRowSchema,
  reactivated: userRowSchema,
  config: configViewSchema,
  checkpoint: checkpointSchema,
  auditLog: auditPageSchema,
};

function unread(input: unknown, parsed: unknown, path = ''): string[] {
  if (Array.isArray(input) && Array.isArray(parsed)) {
    return [...new Set(input.flatMap((item, i) => unread(item, parsed[i], `${path}[]`)))];
  }
  if (input && typeof input === 'object' && parsed && typeof parsed === 'object') {
    return Object.entries(input).flatMap(([key, value]) =>
      key in parsed
        ? unread(value, (parsed as Record<string, unknown>)[key], `${path}.${key}`)
        : [`${path}.${key}`],
    );
  }
  return [];
}

describe('CR.X admin contract: the captured admin answers parse with the web app’s schemas', () => {
  it('covers every captured answer', () => {
    expect(Object.keys(contract).sort()).toEqual([...Object.keys(SCHEMAS), ...ERRORS].sort());
  });

  it.each(Object.keys(SCHEMAS) as Answer[])('%s', (name) => {
    const result = SCHEMAS[name].safeParse(contract[name]);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('lists exactly the fields the web app does not read', () => {
    const ignored = Object.fromEntries(
      (Object.keys(SCHEMAS) as Answer[]).map((name) => [
        name,
        unread(contract[name], SCHEMAS[name].parse(contract[name])),
      ]),
    );
    // A5.3 added usernames, moderation counts, and open reports; the web app reads them from D5.1
    // (moderation), so they are the known drift until then.
    expect(
      Object.fromEntries(Object.entries(ignored).filter(([, keys]) => keys.length > 0)),
    ).toEqual({
      dashboard: ['.openReports'],
      reactivated: ['.username'],
      suspended: ['.username'],
      user: ['.profile.username', '.moderation'],
      users: ['.items[].username'],
    });
  });

  it('reads refusals by status and code', () => {
    expect(ERRORS.map((name) => [name, contract[name].statusCode, contract[name].code])).toEqual([
      ['suspendForbidden', 403, 'admin_role_forbidden'],
      ['deleteMismatch', 422, 'confirm_email_mismatch'],
      ['userNotFound', 404, 'user_not_found'],
    ]);
  });

  it('keeps the semantics the screens bind to', () => {
    const sessions = sessionPageSchema.parse(contract.sessions);
    expect(sessions.items.map((s) => [s.status, s.hasNote, s.explanation.counted])).toEqual([
      ['discarded', false, false],
      ['completed', true, true],
    ]);
    expect(JSON.stringify(contract.sessions)).not.toContain('A good start.');
    expect(userRowSchema.parse(contract.suspended).status).toBe('suspended');
    const audit = auditPageSchema.parse(contract.auditLog);
    expect(audit.items.map((item) => item.action)).toEqual([
      'user.reactivate',
      'user.suspend',
      'session.note_reveal',
      'admin.sign_in',
      'admin.sign_in',
    ]);
    const checkpoint = checkpointSchema.parse(contract.checkpoint);
    expect(checkpoint.cohort.users).toBe(1);
    expect(checkpoint.users[0]?.email).toBe('tester@example.com');
  });
});
