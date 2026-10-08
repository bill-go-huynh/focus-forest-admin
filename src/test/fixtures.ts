export const DASHBOARD = {
  signupsLast7Days: 4,
  sessionsToday: 17,
  discardedToday: 2,
  activeUsersLast7Days: 9,
  generatedAt: '2026-10-08T12:00:00.000Z',
};

export const ADA_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.com',
  displayName: 'Ada L',
  status: 'active' as const,
  joinedAt: '2026-09-01T08:00:00.000Z',
  timezone: 'Europe/Zurich',
};

export const METRICS = {
  userId: ADA_ROW.id,
  joinedOn: '2026-09-01',
  months: [{ year: 2026, month: 9, activeDays: 6, focusDays: 4 }],
  activeDays: 6,
  gapReturns: 1,
  firstArchive: { year: 2026, month: 9 },
  secondMonthReturn: true,
  lastActiveOn: '2026-10-02',
  daysSinceLastActive: 6,
};

export const ADA_DETAIL = {
  profile: { ...ADA_ROW, bio: 'Thesis season.' },
  lifetime: {
    focusedMilliseconds: 754 * 60_000,
    sessionCount: 23,
    archivedTreeCount: 1,
    currentStreak: 3,
    longestStreak: 8,
  },
  currentTree: {
    year: 2026,
    month: 10,
    stage: 'young_tree',
    species: 'sakura',
    fullnessLevel: 2,
    blossomLevel: 1,
    richnessTier: 0,
  },
  rewards: { badges: 5, species: 3, cosmetics: 1 },
  shareUsageData: true,
  checkpoint: METRICS,
};

export const SESSIONS = {
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      startedAt: '2026-10-02T06:00:00.000Z',
      status: 'discarded' as const,
      plannedMinutes: 25,
      focusedMilliseconds: 3 * 60_000,
      pausedMilliseconds: 0,
      configVersion: 5,
      topic: { id: 't1', name: 'Thesis' },
      hasNote: false,
      explanation: {
        outcome: 'below_minimum',
        counted: false,
        text: 'Not counted: 3 min of focus, under the 5-minute minimum (configuration v5).',
      },
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      startedAt: '2026-10-01T06:00:00.000Z',
      status: 'completed' as const,
      plannedMinutes: 50,
      focusedMilliseconds: 50 * 60_000,
      pausedMilliseconds: 0,
      configVersion: 5,
      topic: { id: 't1', name: 'Thesis' },
      hasNote: true,
      explanation: {
        outcome: 'completed',
        counted: true,
        text: 'Counted: completed the planned 50 min.',
      },
    },
  ],
  nextCursor: null,
};

export const CONFIG = {
  version: 5,
  values: {
    'session.minValidMinutes': 5,
    'session.maxPauseMinutes': 30,
    'forest.areaLevels': { lake: 2 },
  },
};

export const AUDIT = {
  items: [
    {
      id: 'e1',
      admin: { id: 'admin-1', email: 'admin@example.com' },
      action: 'user.suspend',
      targetType: 'user',
      targetId: ADA_ROW.id,
      reason: 'abuse report',
      details: {},
      createdAt: '2026-10-08T11:00:00.000Z',
    },
  ],
  nextCursor: 'next-page',
};

export const CHECKPOINT = {
  from: '2026-09-01',
  to: '2026-09-30',
  cohort: {
    users: 3,
    multiDayFirstMonth: 2,
    returnedAfterGap: 1,
    secondMonth: { decided: 2, returned: 1 },
    medianFirstMonthActiveDays: 4,
  },
  users: [{ ...METRICS, email: 'ada@example.com' }],
};
