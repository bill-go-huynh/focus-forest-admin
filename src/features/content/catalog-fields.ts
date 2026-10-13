import type { CatalogKind } from '../../lib/schemas';

/**
 * The catalog's form fields, mirroring focus-forest-api `src/content/catalog-rules.ts`. The API
 * decides what is valid and answers every problem at once; the form only collects values and
 * offers the choices the API accepts.
 */

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'instant' | 'ref';

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  /** Can change after creation. */
  editable: boolean;
  /** The value a new item starts with. */
  initial: string | number | boolean | null;
}

const RARITY: FieldSpec = {
  name: 'rarity',
  label: 'Rarity',
  type: 'select',
  options: ['common', 'rare', 'legendary'],
  editable: true,
  initial: 'common',
};
const SOURCE: FieldSpec = {
  name: 'source',
  label: 'Source',
  type: 'select',
  options: ['achievement', 'event', 'season'],
  editable: false,
  initial: 'event',
};
const WINDOW: FieldSpec[] = [
  {
    name: 'availability',
    label: 'Availability',
    type: 'select',
    options: ['permanent', 'limited'],
    editable: true,
    initial: 'permanent',
  },
  {
    name: 'availableFrom',
    label: 'Available from',
    type: 'instant',
    editable: true,
    initial: null,
  },
  {
    name: 'availableUntil',
    label: 'Available until',
    type: 'instant',
    editable: true,
    initial: null,
  },
];
const STATUS: FieldSpec = {
  name: 'status',
  label: 'Status',
  type: 'select',
  options: ['planned', 'active', 'retired'],
  editable: true,
  initial: 'planned',
};
const COPY: FieldSpec[] = [
  { name: 'name', label: 'Name', type: 'text', editable: true, initial: '' },
  { name: 'description', label: 'Description', type: 'textarea', editable: true, initial: '' },
];
const ID: FieldSpec = { name: 'id', label: 'Id', type: 'text', editable: false, initial: '' };
const ARTWORK: FieldSpec = {
  name: 'artworkId',
  label: 'Artwork id',
  type: 'text',
  editable: true,
  initial: '',
};
const SORT: FieldSpec = {
  name: 'sortOrder',
  label: 'Sort order',
  type: 'number',
  editable: true,
  initial: 0,
};
const UNLOCK: FieldSpec = {
  name: 'achievementId',
  label: 'Unlocking achievement',
  type: 'ref',
  editable: true,
  initial: null,
};

export const CATALOG_FIELDS: Record<CatalogKind, FieldSpec[]> = {
  badges: [
    ID,
    ...COPY,
    ARTWORK,
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: ['focus', 'consistency', 'time_based', 'social', 'event', 'rare'],
      editable: true,
      initial: 'event',
    },
    RARITY,
    SOURCE,
    ...WINDOW,
    STATUS,
    SORT,
  ],
  achievements: [
    ID,
    { name: 'badgeId', label: 'Badge', type: 'text', editable: false, initial: '' },
    {
      name: 'criterion',
      label: 'Criterion',
      type: 'select',
      options: [
        'counted_sessions',
        'focused_minutes',
        'longest_streak_days',
        'focus_together_sessions',
        'focus_together_with_friend',
      ],
      editable: true,
      initial: 'counted_sessions',
    },
    { name: 'target', label: 'Target', type: 'number', editable: true, initial: 1 },
    {
      name: 'progressVisible',
      label: 'Progress visible',
      type: 'checkbox',
      editable: true,
      initial: true,
    },
  ],
  species: [
    ID,
    ...COPY,
    { name: 'baseSpeciesId', label: 'Base species', type: 'ref', editable: false, initial: null },
    RARITY,
    SOURCE,
    UNLOCK,
    ...WINDOW,
    STATUS,
    SORT,
  ],
  cosmetics: [
    ID,
    ...COPY,
    ARTWORK,
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: ['background', 'decoration', 'fauna', 'weather', 'profile_frame', 'effect'],
      editable: false,
      initial: 'decoration',
    },
    RARITY,
    SOURCE,
    UNLOCK,
    ...WINDOW,
    STATUS,
    SORT,
  ],
};

export const KIND_LABELS: Record<CatalogKind, { plural: string; one: string }> = {
  badges: { plural: 'Badges', one: 'badge' },
  achievements: { plural: 'Achievements', one: 'achievement' },
  species: { plural: 'Species', one: 'species' },
  cosmetics: { plural: 'Cosmetics', one: 'cosmetic' },
};
