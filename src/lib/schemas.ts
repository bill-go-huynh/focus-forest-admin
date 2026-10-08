import { z } from 'zod';

/**
 * The admin API's answers (focus-forest-api `src/admin/`, CR.3–CR.4), parsed at the boundary so
 * a contract drift fails loudly instead of showing wrong numbers. Strings stay strings where the
 * API may add values later.
 */

const instant = z.iso.datetime();
const localDate = z.iso.date();
const count = z.number().int().nonnegative();

export const adminRoleSchema = z.enum(['admin', 'support']);
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
  generatedAt: instant,
});
export type Dashboard = z.infer<typeof dashboardSchema>;

const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  status: z.enum(['active', 'suspended']),
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
