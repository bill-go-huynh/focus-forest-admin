import type { z } from 'zod';

import contract from '../../test/release-contract.json';
import { clientErrorGroupsSchema, integrityListSchema, rateLimitRefusalsSchema } from '../schemas';

/**
 * X7 release contract parity: every Phase 7 admin answer the web app reads (D7.1), captured from
 * the real API (focus-forest-api test/x7/release-journey.int-spec.ts, an identical copy of the same
 * file), parsed with the schema the app uses. The refusal is the public one the mobile app reads;
 * it is kept here by status and code so both apps agree on it.
 */

type Name = keyof typeof contract;
const ERRORS = ['rateLimited'] as const;
type Answer = Exclude<Name, (typeof ERRORS)[number]>;

const SCHEMAS: Record<Answer, z.ZodType> = {
  integrityFlags: integrityListSchema,
  clientErrors: clientErrorGroupsSchema,
  rateLimits: rateLimitRefusalsSchema,
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

describe('X7 release contract: the Phase 7 admin answers parse with the web app’s schemas', () => {
  it('covers every captured answer', () => {
    expect(Object.keys(contract).sort()).toEqual([...Object.keys(SCHEMAS), ...ERRORS].sort());
  });

  it.each(Object.keys(SCHEMAS) as Answer[])('%s', (name) => {
    const result = SCHEMAS[name].safeParse(contract[name]);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('reads every field the API answers', () => {
    for (const name of Object.keys(SCHEMAS) as Answer[]) {
      expect(unread(contract[name], SCHEMAS[name].parse(contract[name]))).toEqual([]);
    }
  });

  it('reads a refusal by status and code', () => {
    expect(contract.rateLimited).toMatchObject({ statusCode: 429, code: 'rate_limited' });
  });

  it('keeps the journey the screens bind to', () => {
    const flagged = integrityListSchema.parse(contract.integrityFlags).items;
    expect(flagged.map((item) => item.user.username)).toEqual(['bot']);
    expect(flagged[0]?.flags[0]).toMatchObject({ kind: 'overlap', detail: { overlapMinutes: 40 } });
    const errors = clientErrorGroupsSchema.parse(contract.clientErrors).items;
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).not.toContain('@');
    expect(rateLimitRefusalsSchema.parse(contract.rateLimits).items[0]).toEqual({
      name: 'signIn',
      limit: 3,
      refused: 1,
      keys: 1,
    });
  });
});
