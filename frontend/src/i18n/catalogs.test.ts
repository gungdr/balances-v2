// Smoke-tests the catalog shape: every namespace declared in NAMESPACES has a
// JSON file under public/locales/<lang>/<ns>.json for every supported locale,
// and the en/id key sets stay in lockstep. Catches namespace drift (e.g. a new
// namespace added to the array without its catalog files) before runtime.
// JSON imports work via tsc's resolveJsonModule + Vite's JSON loader.
import { describe, expect, it } from 'vitest'
import { NAMESPACES, SUPPORTED_LOCALES, type Locale } from './index'

import enCommon from '../../public/locales/en/common.json'
import enNav from '../../public/locales/en/nav.json'
import enDashboard from '../../public/locales/en/dashboard.json'
import enAssets from '../../public/locales/en/assets.json'
import enLiabilities from '../../public/locales/en/liabilities.json'
import enReceivables from '../../public/locales/en/receivables.json'
import enInvestments from '../../public/locales/en/investments.json'
import enIncome from '../../public/locales/en/income.json'
import enSettings from '../../public/locales/en/settings.json'
import enErrors from '../../public/locales/en/errors.json'

import idCommon from '../../public/locales/id/common.json'
import idNav from '../../public/locales/id/nav.json'
import idDashboard from '../../public/locales/id/dashboard.json'
import idAssets from '../../public/locales/id/assets.json'
import idLiabilities from '../../public/locales/id/liabilities.json'
import idReceivables from '../../public/locales/id/receivables.json'
import idInvestments from '../../public/locales/id/investments.json'
import idIncome from '../../public/locales/id/income.json'
import idSettings from '../../public/locales/id/settings.json'
import idErrors from '../../public/locales/id/errors.json'

type Catalog = Record<string, unknown>
// Catalog directories under public/locales/ are 2-letter (i18next's
// load: 'languageOnly' strips the region at request time), so the imports
// resolve 'en' and 'id' regardless of the BCP47 locale identifier the rest
// of the app uses.
const CATALOGS: Record<Locale, Record<(typeof NAMESPACES)[number], Catalog>> = {
  'en-GB': {
    common: enCommon,
    nav: enNav,
    dashboard: enDashboard,
    assets: enAssets,
    liabilities: enLiabilities,
    receivables: enReceivables,
    investments: enInvestments,
    income: enIncome,
    settings: enSettings,
    errors: enErrors,
  },
  'id-ID': {
    common: idCommon,
    nav: idNav,
    dashboard: idDashboard,
    assets: idAssets,
    liabilities: idLiabilities,
    receivables: idReceivables,
    investments: idInvestments,
    income: idIncome,
    settings: idSettings,
    errors: idErrors,
  },
}

describe('i18n catalogs', () => {
  for (const lng of SUPPORTED_LOCALES) {
    for (const ns of NAMESPACES) {
      it(`${lng}/${ns}.json loads as an object`, () => {
        expect(CATALOGS[lng][ns]).toBeTypeOf('object')
      })
    }
  }

  it('every namespace catalog has the same key set across locales', () => {
    for (const ns of NAMESPACES) {
      const enKeys = Object.keys(CATALOGS['en-GB'][ns]).sort()
      const idKeys = Object.keys(CATALOGS['id-ID'][ns]).sort()
      expect(idKeys, `id/${ns}.json keys diverge from en/${ns}.json`).toEqual(
        enKeys,
      )
    }
  })
})
