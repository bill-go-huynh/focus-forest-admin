'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, ErrorMessage, PageTitle } from '../../components/ui';
import { useAdminSession } from '../../lib/session';

/** Admin sign-in. Admins are created by the API's CLI; there is no sign-up here. */
export function SignInForm() {
  const { signIn } = useAdminSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#ddead8,#f7f3ea_60%)] p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-[0_6px_16px_#2b262024]">
        <div className="mb-2 flex justify-center">
          <svg width="48" height="48" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="18" fill="#428552" />
            <path d="M18 8 C25 12 26 21 18 28 C10 21 11 12 18 8 Z" fill="#ddead8" />
            <path d="M18 14 V27" stroke="#1f3d2b" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <PageTitle>Focus Forest Admin</PageTitle>
        </div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2"
            />
          </div>
          {error ? <ErrorMessage error={error} /> : null}
          <div className="pt-2 [&>button]:w-full [&>button]:py-2.5">
            <Button type="submit" tone="primary" disabled={busy}>
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
