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
  { href: '/checkpoint', label: 'Checkpoint', roles: ['admin', 'support'] },
  { href: '/config', label: 'Configuration', roles: ['admin', 'support'] },
  { href: '/audit-log', label: 'Audit log', roles: ['admin'] },
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
    <div className="flex min-h-screen">
      <aside className="w-52 border-r p-4 text-sm">
        <p className="mb-4 font-semibold">Focus Forest Admin</p>
        <nav aria-label="Admin">
          <ul className="space-y-1">
            {LINKS.filter((link) => link.roles.includes(admin.role)).map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className="block rounded px-2 py-1 hover:bg-neutral-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 space-y-2 text-xs text-neutral-600">
          <p>{`${admin.email} (${admin.role})`}</p>
          <Button onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

/** Whether the signed-in admin's role allows `roles`. */
export function useHasRole(...roles: AdminRole[]): boolean {
  const { session } = useAdminSession();
  return !!session && roles.includes(session.admin.role);
}
