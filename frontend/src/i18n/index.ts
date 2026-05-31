// i18n entry point. Initialises i18next with namespaces matching the catalog
// files under public/locales/<lang>/<ns>.json. Language detection order: the
// users.locale value set via Settings (synced into localStorage at sign-in),
// then navigator.language as the first-login fallback, then 'en'. See ADR-0026.
import i18n from 'i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Namespaces are split per feature so each extraction issue (issues #5–#11)
// ships an independently translatable unit. The 'errors' namespace covers
// validation + toast copy that crosses features.
export const NAMESPACES = [
  'common',
  'nav',
  'dashboard',
  'assets',
  'liabilities',
  'receivables',
  'investments',
  'income',
  'settings',
  'errors',
] as const

// Locales are stored and exchanged as BCP47 strings (matching users.locale and
// the Intl APIs). Catalog directories under public/locales/ stay 2-letter and
// are resolved at load time via i18next's load: 'languageOnly' option, which
// strips the region before requesting the JSON — 'id-ID' loads from
// /locales/id/<ns>.json. To add a regional variant (e.g. 'en-GB'), extend
// SUPPORTED_LOCALES and the matching CHECK in backend migration 00020;
// catalogs don't need to grow unless the translations actually diverge.
export const SUPPORTED_LOCALES = ['en-GB', 'id-ID'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const LOCALSTORAGE_KEY = 'balances.locale'

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en-GB',
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    // Strip the region when requesting catalog files: 'id-ID' → /locales/id.
    load: 'languageOnly',
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    interpolation: { escapeValue: false }, // React already escapes
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: {
      // The Settings UI writes users.locale via PATCH /api/users/me and mirrors
      // the choice into localStorage so a returning user picks up their
      // language before the user-self query resolves. navigator.language is
      // the first-login fallback.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALSTORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export default i18n
