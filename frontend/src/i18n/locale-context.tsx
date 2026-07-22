'use client';

/**
 * LOCALE PROVIDER — spec §2.7's "the i18n framework is in place day one".
 *
 * Deliberately dependency-free. `next-intl` / `react-i18next` would each add a package and a
 * routing model this spec never describes (no `/es/...` route segments appear anywhere in
 * §3's nav tree). What §2.7 asks for is a framework: a locale, a typed catalogue per locale,
 * a lookup, and a completeness guarantee. That is what this is.
 *
 * The completeness guarantee is the important part. `es.ts` is typed `Record<MessageKey,
 * string>`, so a missing translation is a compile error rather than a silent fall-through to
 * English. `t()` therefore cannot return an untranslated string.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LOCALE, LOCALE_BCP47, isSupportedLocale, type Locale } from './config';
import { en, type MessageKey, type Messages } from './messages/en';
import { es } from './messages/es';

const CATALOGUES: Readonly<Record<Locale, Messages>> = { en, es };

const STORAGE_KEY = 'plumbing-dashboard.locale';

interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  /** Look up a message. The key is checked at compile time. */
  readonly t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>');
  return ctx;
}

/** Convenience: most call sites only want `t`. */
export function useTranslations(): (key: MessageKey) => string {
  return useLocale().t;
}

export function LocaleProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  /**
   * Always start at the shipped default. Reading `localStorage` during the initial render
   * would produce markup that differs from the server's, and React would throw a hydration
   * mismatch. The stored preference is applied in an effect immediately after mount.
   */
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null && isSupportedLocale(stored)) setLocaleState(stored);
    } catch {
      // localStorage can throw in private-browsing modes. A missing preference is not an
      // error — the default locale is a correct answer.
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply does not persist. Never break the switch over storage.
    }
  }, []);

  /**
   * Keep `<html lang>` truthful. A screen reader announces content in the language this
   * attribute declares; leaving it at `en` while rendering Spanish makes the page actively
   * hostile to assistive technology. Set from an effect because the root layout is a Server
   * Component and the locale is client state.
   */
  useEffect(() => {
    document.documentElement.lang = LOCALE_BCP47[locale];
  }, [locale]);

  const t = useCallback((key: MessageKey) => CATALOGUES[locale][key], [locale]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
