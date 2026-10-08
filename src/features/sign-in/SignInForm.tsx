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
    <main className="mx-auto mt-24 max-w-sm p-4">
      <PageTitle>Focus Forest Admin</PageTitle>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
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
            className="mt-1 w-full rounded border p-2"
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
            className="mt-1 w-full rounded border p-2"
          />
        </div>
        {error ? <ErrorMessage error={error} /> : null}
        <Button type="submit" tone="primary" disabled={busy}>
          Sign in
        </Button>
      </form>
    </main>
  );
}
