import { z } from 'zod';

/**
 * The admin API's answers (focus-forest-api `src/admin/`, CR.3–CR.4), parsed at the boundary so
 * a contract drift fails loudly instead of showing wrong numbers. Strings stay strings where the
 * API may add values later.
 */

const instant = z.iso.datetime();
const localDate = z.iso.date();
const count = z.number().int().nonnegative();

export const adminRoleSchema = z.enum(['admin', 'support', 'moderator', 'content']);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminIdentitySchema = z.object({
  id: z.string(),
  email: z.string(),
  role: adminRoleSchema,
});
export type AdminIdentity = z.infer<typeof adminIdentitySchema>;

export const signInSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: instant,
  admin: adminIdentitySchema,
});
export type AdminSession = z.infer<typeof signInSchema>;

export const dashboardSchema = z.object({
  signupsLast7Days: count,
  sessionsToday: count,
  discardedToday: count,
  activeUsersLast7Days: count,
  /** D5.1: reports waiting for a moderator (open or in review). */
  openReports: count,
  generatedAt: instant,
});
export type Dashboard = z.infer<typeof dashboardSchema>;

const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

const accountStatus = z.enum(['active', 'suspended', 'banned']);

export const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  /** A5.1: the public @username; null until chosen. */
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  status: accountStatus,
  joinedAt: instant,
  timezone: z.string().nullable(),
});
export type UserRow = z.infer<typeof userRowSchema>;
export const userPageSchema = page(userRowSchema);
export type UserPage = z.infer<typeof userPageSchema>;

const monthRef = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) });

export const userMetricsSchema = z.object({
  userId: z.string(),
  joinedOn: localDate,
  months: z.array(monthRef.extend({ activeDays: count, focusDays: count })),
  activeDays: count,
  gapReturns: count,
  firstArchive: monthRef.nullable(),
  secondMonthReturn: z.boolean().nullable(),
  lastActiveOn: localDate.nullable(),
  daysSinceLastActive: z.number().int().nullable(),
});
export type UserMetrics = z.infer<typeof userMetricsSchema>;

export const userDetailSchema = z.object({
  profile: userRowSchema.extend({ bio: z.string().nullable() }),
  lifetime: z.object({
    focusedMilliseconds: count,
    sessionCount: count,
    archivedTreeCount: count,
    currentStreak: count.nullable(),
    longestStreak: count.nullable(),
  }),
  currentTree: z
    .object({
      year: z.number().int(),
      month: z.number().int(),
      stage: z.string(),
      species: z.string(),
      fullnessLevel: count,
      blossomLevel: count,
      richnessTier: count,
    })
    .nullable(),
  rewards: z.object({ badges: count, species: count, cosmetics: count }),
  shareUsageData: z.boolean(),
  checkpoint: userMetricsSchema,
  /** Reports involving the user and block relationships, as counts (docs/09). */
  moderation: z.object({
    reportsAbout: count,
    openReportsAbout: count,
    reportsFiled: count,
    warnings: count,
    blocking: count,
    blockedBy: count,
  }),
});
export type UserDetail = z.infer<typeof userDetailSchema>;

export const sessionRowSchema = z.object({
  id: z.string(),
  startedAt: instant,
  status: z.enum(['completed', 'ended_early', 'discarded']),
  plannedMinutes: count,
  focusedMilliseconds: count,
  pausedMilliseconds: count,
  configVersion: count,
  topic: z.object({ id: z.string(), name: z.string() }),
  hasNote: z.boolean(),
  explanation: z.object({ outcome: z.string(), counted: z.boolean(), text: z.string() }),
});
export type SessionRow = z.infer<typeof sessionRowSchema>;
export const sessionPageSchema = page(sessionRowSchema);
export type SessionPage = z.infer<typeof sessionPageSchema>;

export const revealedNoteSchema = z.object({ note: z.string().nullable() });

export const configViewSchema = z.object({
  version: count,
  values: z.record(z.string(), z.unknown()),
});
export type ConfigView = z.infer<typeof configViewSchema>;

export const auditPageSchema = page(
  z.object({
    id: z.string(),
    admin: z.object({ id: z.string(), email: z.string() }),
    action: z.string(),
    targetType: z.string().nullable(),
    targetId: z.string().nullable(),
    reason: z.string().nullable(),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    createdAt: instant,
  }),
);
export type AuditPage = z.infer<typeof auditPageSchema>;

export const checkpointSchema = z.object({
  from: localDate,
  to: localDate,
  cohort: z.object({
    users: count,
    multiDayFirstMonth: count,
    returnedAfterGap: count,
    secondMonth: z.object({ decided: count, returned: count }),
    medianFirstMonthActiveDays: z.number().nullable(),
  }),
  users: z.array(userMetricsSchema.extend({ email: z.string() })),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

/** D5.1 Reports and moderation (focus-forest-api `src/moderation/`, A5.3). */
export const reportStatusSchema = z.enum(['open', 'in_review', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export const moderationActionSchema = z.enum([
  'none',
  'warn',
  'reset_username',
  'reset_bio',
  'reset_avatar',
  'suspend',
  'ban',
]);
export type ModerationAction = z.infer<typeof moderationActionSchema>;

const reportPerson = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
});
export type ReportPerson = z.infer<typeof reportPerson>;

export const reportQueueItemSchema = z.object({
  id: z.string(),
  /** A string: the API may add categories. */
  category: z.string(),
  status: reportStatusSchema,
  details: z.string().nullable(),
  createdAt: instant,
  /** Null once the reporter deleted their account. */
  reporter: reportPerson.nullable(),
  target: reportPerson.extend({ status: accountStatus, openReports: count }),
});
export type ReportQueueItem = z.infer<typeof reportQueueItemSchema>;
export const reportPageSchema = page(reportQueueItemSchema);

export const reportDetailSchema = reportQueueItemSchema.extend({
  targetProfile: z.object({
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  blocks: z.object({ reporterBlocksTarget: z.boolean(), targetBlocksReporter: z.boolean() }),
  targetHistory: z.object({ reports: count, warnings: count, status: accountStatus }),
  reviewedBy: z.string().nullable(),
  resolution: z
    .object({
      action: moderationActionSchema.nullable(),
      reason: z.string(),
      resolvedBy: z.string().nullable(),
      resolvedAt: instant,
    })
    .nullable(),
});
export type ReportDetail = z.infer<typeof reportDetailSchema>;

/** D5.1 Focus rooms (focus-forest-api `src/rooms/`, A5.4). */
export const adminRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string().nullable(),
  visibility: z.enum(['public', 'private']),
  phase: z.string(),
  participants: count,
  host: z.object({ id: z.string(), email: z.string(), username: z.string().nullable() }).nullable(),
  createdAt: instant,
});
export type AdminRoom = z.infer<typeof adminRoomSchema>;
export const roomListSchema = z.object({ items: z.array(adminRoomSchema) });

// D6.1: the content catalog (focus-forest-api A6.4 `/admin/content/:kind`).
export const CATALOG_KINDS = ['badges', 'achievements', 'species', 'cosmetics'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const catalogValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
/** An item as the catalog lists it: its fields (by kind) and how many people own it. */
export const catalogItemSchema = z.object({ id: z.string(), owners: count }).catchall(catalogValue);
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export const catalogListSchema = z.object({ items: z.array(catalogItemSchema) });

// D6.2: live operations (focus-forest-api A6.5 `/admin/live`).
export const liveStatusSchema = z.enum(['planned', 'active', 'retired']);

export const themeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  environmentId: z.string(),
  hemisphere: z.enum(['north', 'south']).nullable(),
  status: liveStatusSchema,
  startsAt: instant,
  endsAt: instant,
  rewards: z.array(z.object({ id: z.string(), badgeId: z.string(), requiredActiveDays: count })),
  started: z.boolean(),
});
export type Theme = z.infer<typeof themeSchema>;
export const themeListSchema = z.object({ items: z.array(themeSchema) });

export const staffBoardSchema = z.object({
  // Global boards only (event boards were removed, owner 2026-10-22).
  scope: z.string(),
  period: z.object({ kind: z.string(), startDate: localDate, endDate: localDate }),
  rows: z.array(
    z.object({
      rank: count,
      person: z.object({
        id: z.string(),
        username: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }),
      score: z.number(),
    }),
  ),
});
export type StaffBoard = z.infer<typeof staffBoardSchema>;

export const exclusionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  reason: z.string(),
  excludedAt: instant,
  by: z.string(),
});
export type Exclusion = z.infer<typeof exclusionSchema>;
export const exclusionListSchema = z.object({ items: z.array(exclusionSchema) });

// D6.3: configuration versions, grants, and notification diagnostics (focus-forest-api A6.6).
export const configVersionSchema = z.object({
  version: count,
  note: z.string(),
  createdAt: instant,
  active: z.boolean(),
});
export type ConfigVersion = z.infer<typeof configVersionSchema>;
export const configVersionListSchema = z.object({ items: z.array(configVersionSchema) });

export const configDiffSchema = z.object({
  against: count,
  changes: z.array(z.object({ key: z.string(), active: z.unknown(), proposed: z.unknown() })),
});

const sampleTreeSchema = z.object({
  stage: z.string(),
  fullnessLevel: z.number(),
  blossomLevel: z.number(),
  richnessTier: z.number(),
  traitIds: z.array(z.string()),
  activeDays: count,
  focusedMinutes: z.number(),
  growthMinutes: z.number(),
});
export type SampleTree = z.infer<typeof sampleTreeSchema>;
export const configPreviewSchema = z.object({
  against: count,
  samples: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      active: sampleTreeSchema,
      proposed: sampleTreeSchema,
    }),
  ),
});

export const GRANT_KINDS = ['badge', 'cosmetic', 'species'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];
export const grantSchema = z.object({
  kind: z.enum(GRANT_KINDS),
  itemId: z.string(),
  grantedAt: instant,
});

export const notificationDiagnosticsSchema = z.object({
  devices: z.array(
    z.object({
      token: z.string(),
      platform: z.string(),
      appVersion: z.string().nullable(),
      registeredAt: instant,
      lastSeenAt: instant,
    }),
  ),
  focusUntil: instant.nullable(),
  enabled: z.array(z.object({ category: z.string(), time: z.string().nullable() })),
  recent: z.array(
    z.object({
      category: z.string(),
      title: z.string(),
      status: z.string(),
      reason: z.string().nullable(),
      notBefore: instant,
      sentAt: instant.nullable(),
    }),
  ),
});
export type NotificationDiagnostics = z.infer<typeof notificationDiagnosticsSchema>;

// D7.1: leaderboard integrity (focus-forest-api A7.3) and app error reports (A7.4).
const integrityFlagSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('overlap'),
    key: z.string(),
    detail: z.object({ sessionIds: z.tuple([z.string(), z.string()]), overlapMinutes: count }),
  }),
  z.object({
    kind: z.literal('day_total'),
    key: z.string(),
    detail: z.object({ localDate: localDate, focusMinutes: count }),
  }),
  z.object({
    kind: z.literal('late'),
    key: z.string(),
    detail: z.object({ sessionId: z.string(), hoursLate: count }),
  }),
  z.object({
    kind: z.literal('spike'),
    key: z.string(),
    detail: z.object({ weekStart: localDate, focusMinutes: count, usualMinutes: count }),
  }),
]);
export type IntegrityFlag = z.infer<typeof integrityFlagSchema>;
export const integrityListSchema = z.object({
  items: z.array(
    z.object({
      user: z.object({
        id: z.string(),
        email: z.string(),
        username: z.string().nullable(),
        displayName: z.string().nullable(),
      }),
      flags: z.array(integrityFlagSchema),
    }),
  ),
});

export const clientErrorGroupsSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(['crash', 'error']),
      message: z.string(),
      platform: z.string(),
      appVersion: z.string(),
      screen: z.string().nullable(),
      count: count,
      firstSeen: instant,
      lastSeen: instant,
      stack: z.string().nullable(),
    }),
  ),
});
export type ClientErrorGroup = z.infer<typeof clientErrorGroupsSchema>['items'][number];

/** D7.1: rate-limit refusals over the last day (A7.2). */
export const rateLimitRefusalsSchema = z.object({
  since: instant,
  items: z.array(z.object({ name: z.string(), limit: count, refused: count, keys: count })),
});

// DM.2 Demo tools (spec/demo/PLAN.md): local or demo-server only.
export const demoStatusSchema = z.object({ enabled: z.boolean() });
export const DEMO_PERSONAS = [
  'main',
  'comeback',
  'recovery',
  'friend-mai',
  'friend-khoa',
  'friend-linh',
] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];
export const demoWorldSchema = z.object({
  id: z.number(),
  accounts: z.array(
    z.object({
      persona: z.enum(DEMO_PERSONAS),
      email: z.string(),
      userId: z.string(),
      name: z.string(),
      /** An entered email signs in with Google; a demo address with the shared password. */
      signIn: z.enum(['google', 'password']),
      password: z.string().nullable(),
    }),
  ),
});
export type DemoWorld = z.infer<typeof demoWorldSchema>;
export const demoWorldListSchema = z.object({ items: z.array(demoWorldSchema) });
export const DEMO_CATEGORIES = [
  'dailyGoalReminder',
  'scheduledFocusReminder',
  'streakReminder',
  'friendInvite',
  'focusRoomInvite',
  'challengeUpdate',
  'badgeUnlocked',
  'monthlyRecapReady',
] as const;
export type DemoCategory = (typeof DEMO_CATEGORIES)[number];
export const demoNotifyResultSchema = z.object({
  category: z.string(),
  status: z.enum(['sent', 'skipped', 'failed', 'pending']),
  reason: z.string().nullable(),
  title: z.string().nullable(),
});
export type DemoNotifyResult = z.infer<typeof demoNotifyResultSchema>;
