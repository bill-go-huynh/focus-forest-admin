'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { AdminSessionProvider } from '../lib/session';

/** The admin API's base URL (NEXT_PUBLIC_API_URL), e.g. http://localhost:3000. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider baseUrl={API_URL}>{children}</AdminSessionProvider>
    </QueryClientProvider>
  );
}
