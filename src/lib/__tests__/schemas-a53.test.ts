import contract from '../../test/admin-contract.json';
import { adminIdentitySchema, userRowSchema } from '../schemas';

/** A5.3 added a role and an account status the web app must not choke on. */
describe('A5.3 values the web app reads', () => {
  it('reads a banned user', () => {
    const row = { ...contract.suspended, status: 'banned' };
    expect(userRowSchema.parse(row).status).toBe('banned');
  });

  it('reads a moderator', () => {
    expect(adminIdentitySchema.parse({ ...contract.me, role: 'moderator' }).role).toBe('moderator');
  });
});

describe('account status labels (A5.3)', () => {
  it('names each status', async () => {
    const { statusLabel } = await import('../format');
    expect(['active', 'suspended', 'banned'].map((s) => statusLabel(s as 'active'))).toEqual([
      'Active',
      'Suspended',
      'Banned',
    ]);
  });
});
