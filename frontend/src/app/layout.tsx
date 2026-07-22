import type { Metadata, Viewport } from 'next';
import React from 'react';

import './globals.css';
import { LocaleProvider } from '@/i18n/locale-context';
import { LOCALE_BCP47, DEFAULT_LOCALE } from '@/i18n/config';

export const metadata: Metadata = {
  title: {
    default: 'Plumbing Automation Dashboard',
    template: '%s · Plumbing Automation',
  },
  description:
    'Voice and chat AI operations for a plumbing service: jobs, plumber dispatch, conversations, quality, and growth.',
  // Operational dashboard: keep it out of search indexes and avoid leaking scoped URLs.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root layout.
 *
 * Holds only what *every* page needs. `SessionProvider` and `DashboardShell` live in
 * `(dashboard)/layout.tsx`; a route group adds no URL segment, so every route keeps its
 * path.
 *
 * This is a frontend-only build with a local mock session — there is no auth provider,
 * middleware, or backend.
 */
export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    // §2.7: rendered with the shipped default locale; `LocaleProvider` keeps this attribute
    // truthful when the locale changes, so assistive technology never announces Spanish
    // content as English.
    <html lang={LOCALE_BCP47[DEFAULT_LOCALE]}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
