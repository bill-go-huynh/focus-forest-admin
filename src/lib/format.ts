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

/** "ada@example.com (@ada)": who a person is, for staff. */
export function personLabel(person: { email: string; username: string | null }): string {
  return person.username ? `${person.email} (@${person.username})` : person.email;
}

const CATEGORIES: Record<string, string> = {
  account: 'Account',
  username: 'Username',
  avatar: 'Avatar',
  bio: 'Bio',
  behavior: 'Behavior',
};
export const categoryLabel = (category: string) => CATEGORIES[category] ?? category;

export function reportStatusLabel(status: 'open' | 'in_review' | 'resolved' | 'dismissed'): string {
  return { open: 'Open', in_review: 'In review', resolved: 'Resolved', dismissed: 'Dismissed' }[
    status
  ];
}

export function actionLabel(
  action: 'none' | 'warn' | 'reset_username' | 'reset_bio' | 'reset_avatar' | 'suspend' | 'ban',
): string {
  return {
    none: 'No action',
    warn: 'Warn the user',
    reset_username: 'Reset the username',
    reset_bio: 'Reset the bio',
    reset_avatar: 'Reset the avatar',
    suspend: 'Suspend the account',
    ban: 'Ban the account',
  }[action];
}

const PHASES: Record<string, string> = {
  lobby: 'Lobby',
  countdown: 'Countdown',
  focusing: 'Focusing',
  ended: 'Ended',
  closed: 'Closed',
};
export const phaseLabel = (phase: string) => PHASES[phase] ?? phase;

const LIVE_STATUSES: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  retired: 'Retired',
};
/** A content definition's or theme's status. */
export const liveStatusLabel = (status: string) => LIVE_STATUSES[status] ?? status;
