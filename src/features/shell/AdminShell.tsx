'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Button } from '../../components/ui';
import type { AdminRole } from '../../lib/schemas';
import { useAdminSession } from '../../lib/session';

const LINKS: { href: string; label: string; roles: readonly AdminRole[] }[] = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'support', 'moderator', 'content'] },
  { href: '/users', label: 'Users', roles: ['admin', 'support', 'moderator'] },
  // D5.1 (docs/09 → Reports and moderation, Focus rooms): admins and moderators.
  { href: '/reports', label: 'Reports', roles: ['admin', 'moderator'] },
  { href: '/rooms', label: 'Rooms', roles: ['admin', 'moderator'] },
  // D6.1 (docs/09 later admin, owner decision 8): content definitions for admins and content staff.
  { href: '/content', label: 'Content', roles: ['admin', 'content'] },
  // D6.2 (docs/09 later admin): events, seasonal themes, and leaderboards.
  { href: '/live', label: 'Live', roles: ['admin', 'content'] },
  // D7.1: leaderboard integrity (who runs the boards) and app errors (who supports people).
  { href: '/integrity', label: 'Integrity', roles: ['admin', 'content'] },
  { href: '/client-errors', label: 'App errors', roles: ['admin', 'support'] },
  { href: '/checkpoint', label: 'Checkpoint', roles: ['admin', 'support'] },
  { href: '/config', label: 'Configuration', roles: ['admin', 'support'] },
  { href: '/audit-log', label: 'Audit log', roles: ['admin'] },
  // DM.2: demo tools (local or demo server only; the page says when they are off).
  { href: '/demo', label: 'Demo', roles: ['admin'] },
];

/**
 * The signed-in layout (docs/09: a left sidebar, then the page). Without a session it sends the
 * visitor to sign-in; links a role cannot use are not shown.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !session) router.replace('/sign-in');
  }, [ready, session, router]);

  if (!session) return null;
  const { admin } = session;
  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-forest-deep px-4 py-6 text-sm text-[#e7efe5]">
        <div className="mb-8 flex items-center gap-3 px-2">
          <LeafMark />
          <div>
            <p className="font-display text-lg leading-tight text-white">Focus Forest</p>
            <p className="text-xs text-[#a9c4ad]">Admin</p>
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto">
          <ul className="space-y-0.5">
            {LINKS.filter((link) => link.roles.includes(admin.role)).map((link) => {
              const current = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-2 !text-inherit no-underline transition-colors ${
                      current ? 'bg-forest font-semibold !text-white' : 'hover:bg-white/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 space-y-3 rounded-xl bg-white/5 p-3 text-xs">
          <p className="break-all text-[#d6e3d4]">{admin.email}</p>
          <p className="inline-block rounded-full bg-forest-soft px-2 py-0.5 font-medium text-forest-deep">
            {admin.role}
          </p>
          <div>
            <Button onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** The app's leaf, as a small mark beside the name. */
function LeafMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#428552" />
      <path d="M18 8 C25 12 26 21 18 28 C10 21 11 12 18 8 Z" fill="#ddead8" />
      <path d="M18 14 V27" stroke="#1f3d2b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Whether the signed-in admin's role allows `roles`. */
export function useHasRole(...roles: AdminRole[]): boolean {
  const { session } = useAdminSession();
  return !!session && roles.includes(session.admin.role);
}
