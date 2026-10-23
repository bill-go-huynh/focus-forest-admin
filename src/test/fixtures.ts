export const DASHBOARD = {
  signupsLast7Days: 4,
  sessionsToday: 17,
  discardedToday: 2,
  activeUsersLast7Days: 9,
  openReports: 4,
  totalUsers: 128,
  focusMinutesToday: 350,
  focusMinutesLast7Days: 2_275,
  openRooms: 3,
  notificationsSentToday: 21,
  days: [
    { date: '2026-09-25', sessions: 1, focusMinutes: 25 },
    { date: '2026-09-26', sessions: 2, focusMinutes: 50 },
    { date: '2026-09-27', sessions: 3, focusMinutes: 75 },
    { date: '2026-09-28', sessions: 4, focusMinutes: 100 },
    { date: '2026-09-29', sessions: 5, focusMinutes: 125 },
    { date: '2026-09-30', sessions: 6, focusMinutes: 150 },
    { date: '2026-10-01', sessions: 7, focusMinutes: 175 },
    { date: '2026-10-02', sessions: 8, focusMinutes: 200 },
    { date: '2026-10-03', sessions: 9, focusMinutes: 225 },
    { date: '2026-10-04', sessions: 10, focusMinutes: 250 },
    { date: '2026-10-05', sessions: 11, focusMinutes: 275 },
    { date: '2026-10-06', sessions: 12, focusMinutes: 300 },
    { date: '2026-10-07', sessions: 13, focusMinutes: 325 },
    { date: '2026-10-08', sessions: 14, focusMinutes: 350 },
  ],
  generatedAt: '2026-10-08T12:00:00.000Z',
};

export const ADA_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.com',
  username: 'ada' as string | null,
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
  moderation: {
    reportsAbout: 3,
    openReportsAbout: 2,
    reportsFiled: 1,
    warnings: 1,
    blocking: 0,
    blockedBy: 2,
  },
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

/** D5.1 moderation and rooms. */
export const REX = {
  id: '55555555-5555-4555-8555-555555555555',
  email: 'rex@example.com',
  username: 'rex',
  displayName: null,
};

export const REPORT = {
  id: '66666666-6666-4666-8666-666666666666',
  category: 'bio' as const,
  status: 'open' as const,
  details: 'Rude words in the bio.',
  createdAt: '2026-10-08T09:00:00.000Z',
  reporter: REX,
  target: {
    id: ADA_ROW.id,
    email: ADA_ROW.email,
    username: 'ada',
    displayName: ADA_ROW.displayName,
    status: 'active' as const,
    openReports: 2,
  },
};

export const REPORT_DETAIL = {
  ...REPORT,
  targetProfile: {
    username: 'ada',
    displayName: ADA_ROW.displayName,
    bio: 'Thesis season.',
    avatarUrl: null,
  },
  blocks: { reporterBlocksTarget: true, targetBlocksReporter: false },
  targetHistory: { reports: 3, warnings: 1, status: 'active' as const },
  reviewedBy: null,
  resolution: null,
};

export const ROOM = {
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Morning study',
  topic: 'Exams',
  visibility: 'public' as const,
  phase: 'focusing' as const,
  participants: 3,
  host: { id: REX.id, email: REX.email, username: 'rex' },
  createdAt: '2026-10-08T08:00:00.000Z',
};
