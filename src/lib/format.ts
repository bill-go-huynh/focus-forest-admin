/** How the admin shows the API's values. Nothing here computes product truth. */

export function duration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

const STAGES: Record<string, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  young_tree: 'Young tree',
  growing_tree: 'Growing tree',
  mature_tree: 'Mature tree',
  blooming_tree: 'Blooming tree',
  final_form: 'Final form',
};

export const stageLabel = (stage: string) => STAGES[stage] ?? stage;

/** "golden-sakura" → "Golden Sakura": the species id as a label (the admin has no art). */
export const speciesLabel = (id: string) =>
  id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = ({ year, month }: { year: number; month: number }) =>
  `${MONTHS[month - 1] ?? month} ${year}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** An instant as UTC date and time: the admin is used from anywhere, so one clock. */
export const instantLabel = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

export function valueLabel(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** An app account's status, as staff read it. */
export function statusLabel(status: 'active' | 'suspended' | 'banned'): string {
  return { active: 'Active', suspended: 'Suspended', banned: 'Banned' }[status];
}
