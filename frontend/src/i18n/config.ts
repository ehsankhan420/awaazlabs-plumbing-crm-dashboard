/**
 * i18n CONFIGURATION — spec §2.7.
 *
 * "UI ships English; the i18n framework is in place day one with Spanish as the second
 *  locale target (US market language mix already shows meaningful Spanish volume).
 *  Language of customer interactions is a data dimension throughout, separate from UI locale."
 *
 * Read that last sentence carefully — it names two different things, and conflating them is
 * the classic mistake here:
 *
 *   - **UI locale** (this file): the language the *staff member* reads the dashboard in.
 *   - **Interaction language** (`Language` in `status-models.ts`): the language the *customer*
 *     spoke or typed in. It is a data dimension on every contact, drives the §6.2 and §9.2
 *     language-mix charts, and has nothing to do with the UI locale.
 *
 * They are deliberately separate types. A business whose staff read English still sees that
 * 22% of its calls were in Spanish.
 */

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** §2.7: "UI ships English". English is the shipped default; Spanish is the second target. */
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
};

/** BCP-47 tags for the `<html lang>` attribute and `Intl` formatters. */
export const LOCALE_BCP47: Readonly<Record<Locale, string>> = {
  en: 'en-US',
  es: 'es-US',
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
