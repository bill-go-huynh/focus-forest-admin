import type { z } from 'zod';

import contract from '../../test/operations-contract.json';
import {
  auditPageSchema,
  catalogListSchema,
  configDiffSchema,
  configPreviewSchema,
  configVersionListSchema,
  configVersionSchema,
  exclusionListSchema,
  grantSchema,
  notificationDiagnosticsSchema,
  staffBoardSchema,
  themeListSchema,
} from '../schemas';

/**
 * X6 operations contract parity: every Phase 6 admin answer the web app reads (D6.1–D6.3),
 * captured from the real API (focus-forest-api test/x6/operations-journey.int-spec.ts, an
 * identical copy of the same file), parsed with the schema the app uses. Fields the app does not
 * read are listed exactly (the values an activation answers).
 */

type Name = keyof typeof contract;
/**
 * Events and the Community Tree were removed (owner, 2026-10-22). The capture is byte-identical
 * with focus-forest-api and still carries the event answers until the API regenerates it; the
 * web app reads none of them, so they are skipped here (and may be absent).
 */
const RETIRED: readonly string[] = ['event', 'eventLocked'];
type Answer = Exclude<Name, 'event' | 'eventLocked'>;

const SCHEMAS: Record<Answer, z.ZodType> = {
  catalog: catalogListSchema,
  themes: themeListSchema,
  board: staffBoardSchema,
  exclusions: exclusionListSchema,
  versions: configVersionListSchema,
  diff: configDiffSchema,
  preview: configPreviewSchema,
  activated: configVersionSchema,
  granted: grantSchema,
  diagnostics: notificationDiagnosticsSchema,
  auditFiltered: auditPageSchema,
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

describe('X6 operations contract: the Phase 6 admin answers parse with the web app’s schemas', () => {
  it('covers every captured answer', () => {
    const captured = Object.keys(contract).filter((name) => !RETIRED.includes(name));
    expect(captured.sort()).toEqual(Object.keys(SCHEMAS).sort());
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
    // Activation answers the version with its values; the page reads the active configuration
    // again instead. An event board's teams (in a capture from before 2026-10-22) are not read.
    const board = contract.board as Record<string, unknown>;
    expect(
      Object.fromEntries(Object.entries(ignored).filter(([, keys]) => keys.length > 0)),
    ).toEqual({ activated: ['.values'], ...('teams' in board ? { board: ['.teams'] } : {}) });
  });

  it('keeps the journey the screens bind to', () => {
    expect(configDiffSchema.parse(contract.diff).changes).toEqual([
      { key: 'growth.dailySoftCap', active: 240, proposed: 120 },
    ]);
    expect(configPreviewSchema.parse(contract.preview).samples).toHaveLength(4);
    expect(configVersionSchema.parse(contract.activated).active).toBe(true);
    expect(grantSchema.parse(contract.granted)).toMatchObject({
      kind: 'badge',
      itemId: 'october-marathon',
    });
    expect(notificationDiagnosticsSchema.parse(contract.diagnostics).devices[0]?.token).toBe(
      'ExponentPushToken[ana…234]',
    );
  });
});
