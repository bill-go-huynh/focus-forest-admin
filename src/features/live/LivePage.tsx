'use client';

import { useState } from 'react';

import { PageTitle } from '../../components/ui';
import { LeaderboardsPanel } from './LeaderboardsPanel';
import { ThemesPanel } from './ThemesPanel';

const TABS = [
  ['themes', 'Seasonal themes'],
  ['leaderboards', 'Leaderboards'],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * Live operations (D6.2; docs/09 later admin): seasonal themes per hemisphere, and leaderboards
 * with exclusions. Admins and content staff. Events and the Community Tree were removed from the
 * product (owner, 2026-10-22).
 */
export function LivePage() {
  const [tab, setTab] = useState<Tab>('themes');

  return (
    <>
      <PageTitle>Live operations</PageTitle>
      <div role="tablist" aria-label="Live operations" className="mb-4 flex gap-2">
        {TABS.map(([each, label]) => (
          <button
            key={each}
            role="tab"
            aria-selected={each === tab}
            onClick={() => setTab(each)}
            className={`rounded px-3 py-1 text-sm ${each === tab ? 'bg-forest text-white' : 'border'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'themes' ? <ThemesPanel /> : <LeaderboardsPanel />}
    </>
  );
}
