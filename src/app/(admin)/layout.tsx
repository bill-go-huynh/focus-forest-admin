import type { ReactNode } from 'react';

import { AdminShell } from '../../features/shell/AdminShell';

/** Every signed-in admin page: the sidebar, and a redirect to sign-in without a session. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
