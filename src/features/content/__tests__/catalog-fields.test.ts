import { CATALOG_FIELDS } from '../catalog-fields';

/**
 * The achievement form offers every criterion the API accepts (focus-forest-api
 * `ACHIEVEMENT_CRITERIA`), including the time-based and Community Tree criteria of the owner
 * decision of 2026-10-15.
 */
describe('achievement criteria in the catalog form', () => {
  it('lists every criterion the API accepts, in its order', () => {
    const criterion = CATALOG_FIELDS.achievements.find((field) => field.name === 'criterion');
    expect(criterion?.options).toEqual([
      'counted_sessions',
      'focused_minutes',
      'longest_streak_days',
      'focus_together_sessions',
      'focus_together_with_friend',
      'sessions_before_7',
      'sessions_after_22',
      'full_weekends',
      'community_contributions',
    ]);
  });
});
