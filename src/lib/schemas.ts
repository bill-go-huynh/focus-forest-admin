import { z } from 'zod';

/**
 * The admin API's answers (focus-forest-api `src/admin/`, CR.3–CR.4), parsed at the boundary so
 * a contract drift fails loudly instead of showing wrong numbers. Strings stay strings where the
 * API may add values later.
 */

const instant = z.iso.datetime();
const localDate = z.iso.date();
const count = z.number().int().nonnegative();

export const adminRoleSchema = z.enum(['admin', 'support', 'moderator']);
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
