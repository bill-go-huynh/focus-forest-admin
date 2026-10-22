import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

// The app's faces (design system "Focus Forest"): Fraunces for titles, Inter for everything else.
const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin', 'vietnamese'], variable: '--font-fraunces' });

export const metadata: Metadata = {
  title: 'Focus Forest Admin',
  description: 'Internal operations tool for Focus Forest.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
