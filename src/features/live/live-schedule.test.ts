import { changedFields, themeSchedule, type ScheduledTheme } from './live-schedule';

/** D6.2: the seasonal schedule per hemisphere, with gaps and overlaps, and an edit's changes. */

const theme = (
  id: string,
  hemisphere: 'north' | 'south' | null,
  startsAt: string,
  endsAt: string,
  status = 'active',
): ScheduledTheme => ({ id, name: id, hemisphere, startsAt, endsAt, status });

describe('themeSchedule (D6.2)', () => {
  const autumn = theme('autumn', 'north', '2026-09-22T00:00:00.000Z', '2026-12-21T00:00:00.000Z');
  const winter = theme('winter', 'north', '2026-12-21T00:00:00.000Z', '2027-03-20T00:00:00.000Z');
  const spring = theme('spring', 'south', '2026-09-22T00:00:00.000Z', '2026-12-21T00:00:00.000Z');
  const lunar = theme('lunar', null, '2027-04-01T00:00:00.000Z', '2027-04-15T00:00:00.000Z');

  it('lists the themes each hemisphere sees, in order, with the gaps between them', () => {
    const north = themeSchedule([lunar, winter, spring, autumn], 'north');
    expect(north.entries).toEqual([
      { kind: 'theme', theme: autumn },
      { kind: 'theme', theme: winter },
      { kind: 'gap', from: '2027-03-20T00:00:00.000Z', to: '2027-04-01T00:00:00.000Z' },
      { kind: 'theme', theme: lunar },
    ]);
    expect(north.overlaps).toEqual([]);
    // A theme for both hemispheres shows in each.
    expect(themeSchedule([lunar, winter, spring, autumn], 'south').entries).toEqual([
      { kind: 'theme', theme: spring },
      { kind: 'gap', from: '2026-12-21T00:00:00.000Z', to: '2027-04-01T00:00:00.000Z' },
      { kind: 'theme', theme: lunar },
    ]);
  });

  it('names overlapping themes, and leaves retired themes out', () => {
    const late = theme('late', 'north', '2026-12-01T00:00:00.000Z', '2027-01-10T00:00:00.000Z');
    const retired = theme(
      'old',
      'north',
      '2026-10-01T00:00:00.000Z',
      '2026-10-10T00:00:00.000Z',
      'retired',
    );
    const both = theme('both', null, '2026-12-20T00:00:00.000Z', '2026-12-22T00:00:00.000Z');
    const north = themeSchedule([autumn, late, retired, both], 'north');
    expect(north.entries.map((e) => (e.kind === 'theme' ? e.theme.id : 'gap'))).toEqual([
      'autumn',
      'late',
      'both',
    ]);
    expect(north.overlaps).toEqual([
      ['autumn', 'late'],
      ['autumn', 'both'],
      ['late', 'both'],
    ]);
  });
});

describe('changedFields (D6.2)', () => {
  it('sends only the fields that changed, comparing lists by value', () => {
    const before = {
      name: 'Autumn',
      startsAt: '2026-09-22T00:00:00.000Z',
      rewards: [{ id: 'leaf', badgeId: 'leaf-badge', requiredActiveDays: 5 }],
    };
    const after = {
      ...before,
      name: 'Autumn glow',
      rewards: [{ ...before.rewards[0]!, requiredActiveDays: 7 }],
    };
    expect(
      changedFields(before, { ...before, rewards: before.rewards.map((r) => ({ ...r })) }),
    ).toEqual({});
    expect(changedFields(before, after)).toEqual({ name: 'Autumn glow', rewards: after.rewards });
  });
});
