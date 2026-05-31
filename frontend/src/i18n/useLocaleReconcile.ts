// useLocaleReconcile syncs the UI language to the just-loaded user row, and
// flips a first-login fresh signup to navigator.language when that disagrees
// with the DB default. Mounted from AppShell once useSession resolves a user.
//
// Reconciliation logic:
//   1. If localStorage already holds a locale, the user has chosen before —
//      trust user.locale (set by the most recent Settings PATCH) and just
//      sync the UI to it. No navigator override.
//   2. If localStorage is empty AND navigator.language suggests a supported
//      locale that differs from user.locale, PATCH the new locale + set it.
//      This is the first-login bias toward the user's actual browser
//      language; it runs once because step 1 fires forever after.
//   3. Otherwise (localStorage empty, navigator agrees with user.locale or
//      is unsupported) sync the UI to user.locale and prime localStorage.
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LOCALSTORAGE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/i18n'
import { useUpdateMe } from '@/hooks/useUpdateMe'
import type { Me } from '@/hooks/useSession'

function navigatorPick(): Locale | null {
  const langs = (navigator.languages ?? [navigator.language ?? '']).filter(Boolean)
  for (const lang of langs) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as Locale
    }
    const base = lang.split('-')[0]
    if (base === 'id') return 'id-ID'
    if (base === 'en') return 'en-GB'
  }
  return null
}

function isSupported(locale: string): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
}

export function useLocaleReconcile(user: Me | null | undefined) {
  const { i18n } = useTranslation()
  const updateMe = useUpdateMe()
  // Fire once per mounted user; guard so a session refetch doesn't trigger
  // another navigator flip.
  const reconciled = useRef(false)

  useEffect(() => {
    if (!user || reconciled.current) return
    reconciled.current = true

    const stored = localStorage.getItem(LOCALSTORAGE_KEY)
    const userLocale: Locale = isSupported(user.locale) ? user.locale : 'en-GB'

    if (stored) {
      // Returning device: trust the server-side choice.
      if (i18n.language !== userLocale) {
        localStorage.setItem(LOCALSTORAGE_KEY, userLocale)
        void i18n.changeLanguage(userLocale)
      }
      return
    }

    // First-login on this device. Look at navigator before settling.
    const browser = navigatorPick()
    if (browser && browser !== userLocale) {
      localStorage.setItem(LOCALSTORAGE_KEY, browser)
      void i18n.changeLanguage(browser)
      updateMe.mutate({ locale: browser })
      return
    }

    // Navigator agrees (or said nothing useful) — just prime localStorage.
    localStorage.setItem(LOCALSTORAGE_KEY, userLocale)
    if (i18n.language !== userLocale) {
      void i18n.changeLanguage(userLocale)
    }
    // updateMe and i18n are stable references; user is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
}
