// Returns the active locale string and a setter that both calls i18next and
// mirrors the choice into localStorage. Settings calls setLocale() after the
// users.locale PATCH succeeds; other code reads the locale to drive format
// helpers (lib/format.ts — issue #2).
import { useTranslation } from 'react-i18next'
import { LOCALSTORAGE_KEY, SUPPORTED_LOCALES, type Locale } from './index'

function normalise(raw: string | undefined): Locale {
  if (!raw) return 'en'
  // i18next can hand back 'en-US', 'id-ID', etc. — strip the region.
  const base = raw.split('-')[0]
  return (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? (base as Locale)
    : 'en'
}

export function useLocale(): {
  locale: Locale
  setLocale: (next: Locale) => Promise<void>
} {
  const { i18n } = useTranslation()
  const locale = normalise(i18n.language)
  const setLocale = async (next: Locale) => {
    localStorage.setItem(LOCALSTORAGE_KEY, next)
    await i18n.changeLanguage(next)
  }
  return { locale, setLocale }
}
