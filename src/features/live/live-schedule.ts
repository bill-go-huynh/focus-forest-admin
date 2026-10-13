import { monthLabel } from '../../lib/format';

/**
 * Live operations views (D6.2), pure: the events calendar, the seasonal schedule per hemisphere,
 * and the event form's values. Instants are UTC (the admin's one clock); an end is exclusive.
 */

const monthKey = (at: Date) =>
  `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

export interface CalendarEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface CalendarMonth {
  key: string;
  label: string;
  events: { id: string; name: string; days: string }[];
}

/** Every UTC month an event runs in, with the days it covers there ("20–31", or "5"). */
export function eventCalendar(events: readonly CalendarEvent[]): CalendarMonth[] {
  const months = new Map<string, CalendarMonth>();
  const sorted = [...events].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
  );
  for (const event of sorted) {
    const start = new Date(event.startsAt);
    const last = new Date(Date.parse(event.endsAt) - 1);
    if (last < start) continue;
    const lastKey = monthKey(last);
    for (let year = start.getUTCFullYear(), month = start.getUTCMonth(); ; month += 1) {
      const at = new Date(Date.UTC(year, month, 1));
      const key = monthKey(at);
      const firstDay = key === monthKey(start) ? start.getUTCDate() : 1;
      const lastDay =
        key === lastKey ? last.getUTCDate() : new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const entry = months.get(key) ?? {
        key,
        label: monthLabel({ year: at.getUTCFullYear(), month: at.getUTCMonth() + 1 }),
        events: [],
      };
      entry.events.push({
        id: event.id,
        name: event.name,
        days: firstDay === lastDay ? `${firstDay}` : `${firstDay}–${lastDay}`,
      });
      months.set(key, entry);
      if (key === lastKey) break;
    }
  }
  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface ScheduledTheme {
  id: string;
  name: string;
  hemisphere: 'north' | 'south' | null;
  startsAt: string;
  endsAt: string;
  status: string;
}

export type ScheduleEntry<T extends ScheduledTheme> =
  { kind: 'theme'; theme: T } | { kind: 'gap'; from: string; to: string };

/**
 * What one hemisphere sees, in order: its themes and the ones for both, with the gaps between
 * them, and every pair that overlaps (the API refuses overlaps; older data may still hold one).
 * Retired themes make room and are left out.
 */
export function themeSchedule<T extends ScheduledTheme>(
  themes: readonly T[],
  hemisphere: 'north' | 'south',
): { entries: ScheduleEntry<T>[]; overlaps: [string, string][] } {
  const seen = themes
    .filter((t) => t.status !== 'retired' && (t.hemisphere === null || t.hemisphere === hemisphere))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const entries: ScheduleEntry<T>[] = [];
  const overlaps: [string, string][] = [];
  let coveredUntil: string | null = null;
  seen.forEach((theme, i) => {
    if (coveredUntil !== null && Date.parse(theme.startsAt) > Date.parse(coveredUntil)) {
      entries.push({ kind: 'gap', from: coveredUntil, to: theme.startsAt });
    }
    entries.push({ kind: 'theme', theme });
    for (const other of seen.slice(i + 1)) {
      if (Date.parse(other.startsAt) < Date.parse(theme.endsAt))
        overlaps.push([theme.id, other.id]);
    }
    if (coveredUntil === null || Date.parse(theme.endsAt) > Date.parse(coveredUntil)) {
      coveredUntil = theme.endsAt;
    }
  });
  return { entries, overlaps };
}

// The event form ------------------------------------------------------------------------------

export interface MissionValues {
  id: string;
  measure: string;
  target: number | null;
  dailyMinutes: number | null;
  name: string;
  description: string;
}
export interface MilestoneValues {
  id: string;
  name: string;
  requiredMissions: number | null;
  badgeId: string | null;
  trait: boolean;
}
export interface TreeValues {
  name: string;
  artworkId: string;
  milestones: { stage: string; thresholdMinutes: number | null; badgeId: string }[];
}
export interface EventValues {
  id: string;
  name: string;
  description: string;
  artworkId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  entryMinSessions: number | null;
  leaderboard: boolean;
  teams: { id: string; name: string }[];
  missions: MissionValues[];
  milestones: MilestoneValues[];
  communityTree: TreeValues | null;
}

/** An event as the API serves it (A6.5 `GET /admin/live/events/:id`). */
export interface RenderedEvent {
  id: string;
  name: string;
  description: string;
  artworkId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  entryMinSessions: number;
  leaderboard: boolean;
  teams: { id: string; name: string }[];
  missions: MissionValues[];
  milestones: {
    id: string;
    name: string;
    requiredMissions: number;
    badgeId: string | null;
    cosmeticId: string | null;
    traitId: string | null;
  }[];
  communityTree: {
    name: string;
    artworkId: string;
    milestones: { stage: string; thresholdMinutes: number; badgeId: string | null }[];
  } | null;
}

export const NEW_EVENT: EventValues = {
  id: '',
  name: '',
  description: '',
  artworkId: '',
  status: 'planned',
  startsAt: '',
  endsAt: '',
  entryMinSessions: 0,
  leaderboard: false,
  teams: [],
  missions: [],
  milestones: [],
  communityTree: null,
};

/**
 * The served event as the body the API takes back: a milestone's reward is its badge (or the
 * cosmetic an older pack chose), its trait a flag; the tree without its live totals.
 */
export function eventFormValues(event: RenderedEvent): EventValues {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    artworkId: event.artworkId,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    entryMinSessions: event.entryMinSessions,
    leaderboard: event.leaderboard,
    teams: event.teams.map((t) => ({ id: t.id, name: t.name })),
    missions: event.missions.map((m) => ({
      id: m.id,
      measure: m.measure,
      target: m.target,
      dailyMinutes: m.dailyMinutes,
      name: m.name,
      description: m.description,
    })),
    milestones: event.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      requiredMissions: m.requiredMissions,
      badgeId: m.badgeId ?? m.cosmeticId,
      trait: m.traitId !== null,
    })),
    communityTree: event.communityTree && {
      name: event.communityTree.name,
      artworkId: event.communityTree.artworkId,
      milestones: event.communityTree.milestones.map((m) => ({
        stage: m.stage,
        thresholdMinutes: m.thresholdMinutes,
        badgeId: m.badgeId ?? '',
      })),
    },
  };
}

/** The fields of `after` that differ from `before`; lists and objects compare by value. */
export function changedFields<T extends object>(before: T, after: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const name of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) changed[name] = after[name];
  }
  return changed;
}
