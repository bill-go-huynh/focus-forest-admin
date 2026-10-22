/**
 * Live operations views (D6.2), pure: the seasonal schedule per hemisphere, and the fields an
 * edit changed. Instants are UTC (the admin's one clock); an end is exclusive. Events and the
 * Community Tree were removed from the product (owner, 2026-10-22).
 */

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

/** The fields of `after` that differ from `before`; lists and objects compare by value. */
export function changedFields<T extends object>(before: T, after: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const name of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) changed[name] = after[name];
  }
  return changed;
}
