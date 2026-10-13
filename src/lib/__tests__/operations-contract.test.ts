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
  liveEventSchema,
  notificationDiagnosticsSchema,
  staffBoardSchema,
  themeListSchema,
} from '../schemas';

/**
 * X6 operations contract parity: every Phase 6 admin answer the web app reads (D6.1–D6.3),
 * captured from the real API (focus-forest-api test/x6/operations-journey.int-spec.ts, an
 * identical copy of the same file), parsed with the schema the app uses. Fields the app does not
 * read are listed exactly (the values an activation answers); refusals are read by status, code, and their problems.
 */

type Name = keyof typeof contract;
const ERRORS = ['eventLocked'] as const;
type Answer = Exclude<Name, (typeof ERRORS)[number]>;

const SCHEMAS: Record<Answer, z.ZodType> = {
  catalog: catalogListSchema,
  themes: themeListSchema,
  event: liveEventSchema,
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
    // Activation answers the version with its values; the page reads the active configuration
    // again instead.
    expect(
      Object.fromEntries(Object.entries(ignored).filter(([, keys]) => keys.length > 0)),
    ).toEqual({ activated: ['.values'] });
  });

  it('reads a locked edit by status and code, with every problem', () => {
    expect(contract.eventLocked).toMatchObject({
      statusCode: 422,
      code: 'invalid_content',
      problems: ['missions is locked: people have taken part.'],
    });
  });

  it('keeps the journey the screens bind to', () => {
    const event = liveEventSchema.parse(contract.event);
    expect(event).toMatchObject({ locked: true, participants: 1 });
    expect(event.communityTree).toMatchObject({ totalMinutes: 300, contributors: 1 });
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
