import {
  changedFields,
  eventCalendar,
  eventFormValues,
  themeSchedule,
  type ScheduledTheme,
} from './live-schedule';

/** D6.2: the events calendar and the seasonal schedule per hemisphere, with gaps and overlaps. */

const event = (id: string, startsAt: string, endsAt: string) => ({
  id,
  name: id,
  status: 'active',
  startsAt,
  endsAt,
});

describe('eventCalendar (D6.2)', () => {
  it('places each event in every UTC month it runs in, with its days there', () => {
    const months = eventCalendar([
      event('autumn', '2026-10-20T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
      event('focus-week', '2026-11-10T00:00:00.000Z', '2026-11-17T00:00:00.000Z'),
    ]);
    expect(months).toEqual([
      {
        key: '2026-10',
        label: 'Oct 2026',
        events: [{ id: 'autumn', name: 'autumn', days: '20–31' }],
      },
      {
        key: '2026-11',
        label: 'Nov 2026',
        events: [
          { id: 'autumn', name: 'autumn', days: '1–2' },
          { id: 'focus-week', name: 'focus-week', days: '10–16' },
        ],
      },
    ]);
  });

  it('ends at the end instant, which is not part of the event', () => {
    const months = eventCalendar([
      event('one-day', '2026-12-01T00:00:00.000Z', '2026-12-02T00:00:00.000Z'),
      event('year-end', '2026-12-31T00:00:00.000Z', '2027-01-01T00:00:00.000Z'),
    ]);
    expect(months.map((m) => m.key)).toEqual(['2026-12']);
    expect(months[0]!.events.map((e) => e.days)).toEqual(['1', '31']);
  });

  it('is empty without events', () => {
    expect(eventCalendar([])).toEqual([]);
  });
});

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

describe('the event form (D6.2)', () => {
  const rendered = {
    id: 'autumn',
    name: 'Autumn Focus',
    description: 'Focus through autumn.',
    artworkId: 'autumn',
    status: 'active',
    startsAt: '2026-10-20T00:00:00.000Z',
    endsAt: '2026-11-03T00:00:00.000Z',
    entryMinSessions: 0,
    leaderboard: true,
    participants: 2,
    locked: true,
    teams: [],
    missions: [
      {
        id: 'minutes',
        measure: 'focus_minutes',
        target: 300,
        dailyMinutes: 0,
        name: '300 minutes',
        description: 'Focus for 300 minutes.',
      },
    ],
    milestones: [
      {
        id: 'done',
        name: 'Done',
        requiredMissions: 1,
        badgeId: 'autumn-badge',
        cosmeticId: null,
        traitId: 'autumn-leaf',
      },
      {
        id: 'old',
        name: 'Old',
        requiredMissions: 1,
        badgeId: null,
        cosmeticId: 'lantern',
        traitId: null,
      },
    ],
    communityTree: {
      name: 'Grove',
      artworkId: 'grove',
      totalMinutes: 1200,
      contributors: 3,
      milestones: [
        {
          stage: 'seedling',
          thresholdMinutes: 1000,
          badgeId: 'grove-badge',
          reachedAt: '2026-10-25T10:00:00.000Z',
        },
      ],
    },
  };

  it('reads an event as the body the API takes back', () => {
    expect(eventFormValues(rendered)).toEqual({
      id: 'autumn',
      name: 'Autumn Focus',
      description: 'Focus through autumn.',
      artworkId: 'autumn',
      status: 'active',
      startsAt: '2026-10-20T00:00:00.000Z',
      endsAt: '2026-11-03T00:00:00.000Z',
      entryMinSessions: 0,
      leaderboard: true,
      teams: [],
      missions: rendered.missions,
      milestones: [
        { id: 'done', name: 'Done', requiredMissions: 1, badgeId: 'autumn-badge', trait: true },
        // An older pack's cosmetic reward stays as it was.
        { id: 'old', name: 'Old', requiredMissions: 1, badgeId: 'lantern', trait: false },
      ],
      communityTree: {
        name: 'Grove',
        artworkId: 'grove',
        milestones: [{ stage: 'seedling', thresholdMinutes: 1000, badgeId: 'grove-badge' }],
      },
    });
  });

  it('sends only the fields that changed, comparing lists by value', () => {
    const before = eventFormValues(rendered);
    const after = {
      ...before,
      name: 'Autumn',
      missions: before.missions.map((m) => ({ ...m })),
      milestones: [{ ...before.milestones[0]!, name: 'Finished' }, before.milestones[1]!],
    };
    expect(changedFields(before, after)).toEqual({
      name: 'Autumn',
      milestones: after.milestones,
    });
  });
});
