# Internationalization with react-i18next and a persisted user locale

The app launches bilingual: **English (`en`) and Indonesian (`id`)**, with room to add more
languages without code changes. UI strings move from hard-coded JSX literals to **react-i18next**
catalogs, locale-aware number/date/currency formatting consolidates behind a single helper module,
and the active locale is **persisted on the user row** so it survives device changes. Backend HTTP
responses stay English in this milestone; a follow-up ADR will introduce a typed error-code envelope
([[adr-0027]] — planned) so future locales don't touch Go code.

## Why now

The app's audience is non-technical household members ([[feedback-audience-non-technical]]); the
primary user reports the household co-owner reads Indonesian comfortably and English haltingly, so
shipping EN-only is a usability ceiling not a translation luxury. Three structural reasons make now
the cheapest moment:

- **The string surface is finite and tractable** — ~165 frontend files, ~570 JSX literal-text sites,
  no untranslated content stores. Every additional screen makes the extraction sweep larger.
- **Domain values are already language-neutral in the DB.** Income categories, transaction types,
  status enums, regularity, risk profile, and ownership are stored as English tokens
  (`salary`, `routine`, `low`, `personal`) and rendered through FE-side label maps
  (`CATEGORY_LABEL`, `TYPE_LABELS`, `ownershipLabel`, etc.). Those maps are natural translation
  seams — i18n drops in where labels already concentrate, no schema change required.
- **Locale-aware formatting is already inconsistent.** `lib/format.ts` hardcodes `'id-ID'` for
  currency, `'en-US'` for year-month, `'en-GB'` for dates; `DashboardScreen` and `SnapshotChartImpl`
  reach for `Intl` directly with hardcoded locales. Centralising on the active locale is overdue
  regardless of i18n.

## The decision

### react-i18next, not LinguiJS or FormatJS

react-i18next is the largest-ecosystem React i18n library (namespaces, plurals, interpolation,
`<Trans/>` for inline JSX, well-documented Vite recipes, hot-reload of catalogs during dev). It is
chosen over:

- **LinguiJS** — smaller runtime and compile-time message IDs, but a macro-based pattern that adds a
  Babel/SWC step we don't have, and a smaller community. The bundle savings don't matter at our scale.
- **FormatJS / react-intl** — first-class ICU MessageFormat (best plural/select expressiveness), but
  heavier API surface and verbose call sites for the 90% case (`<FormattedMessage id=...
  defaultMessage=.../>`). react-i18next's interpolation is enough for our copy.

The trade-off accepted: react-i18next has runtime IDs (no compile-time check that a key exists). We
mitigate with a strict catalog-shape TypeScript type and an ESLint rule against bare JSX text.

### EN and ID at launch; locale is a string, not an enum, in code

Two languages ship as fully-translated catalogs. A third language is **adding a JSON file** —
nothing in the code switches on `'en'` vs `'id'`. The catalogs are namespaced by feature
(`common`, `nav`, `dashboard`, `assets`, `liabilities`, `receivables`, `investments`, `income`,
`settings`, `errors`) so each extraction issue ships an independently translatable unit.

### Locale persists on the user, not the browser

A new `users.locale` column (migration `00020`, `TEXT NOT NULL DEFAULT 'en'`, CHECK
`locale IN ('en','id')`) is the source of truth. Backend exposes it via the existing user-self
endpoints (`GET /api/users/me`, `PATCH /api/users/me`). Settings gains a "Language" dropdown.
First-login fallback reads `navigator.language` and writes the result back to the user row, so the
next device picks it up automatically.

Browser-only / cookie-only alternatives rejected: device-switching is a real flow for this
household app (phone + laptop), and the user row already holds the cousin field `nickname` — the
shape is familiar.

### Number / date / currency: one locale-aware helper module

`lib/format.ts` is rewritten to read the active locale from a thin `useLocale()` hook (or accept it
as a parameter for non-React call sites). Every hardcoded `'id-ID'` / `'en-US'` / `'en-GB'` becomes
the active locale. Currency formatting keeps the `NO_DECIMAL_CURRENCIES` rule unchanged — that's a
currency property, not a locale property. The signed-percent helper stays locale-agnostic.

### Backend stays English in this milestone

Error bodies remain plain English text via `http.Error(...)`. The frontend maps known statuses (per
endpoint where it matters) to translated friendly toasts; an unmapped error falls back to a generic
translated "Something went wrong" with the raw English body shown only in dev mode. **Backend
error-code envelope is the deferred follow-up** — a future ADR introduces a typed
`{code, args}` JSON shape for known sentinels so future locales don't touch Go. Shipping that now
would double the milestone's scope; deferring is cheap because the FE error mapping table is small
and can be replaced wholesale when the envelope lands.

### E2E pins to `en` rather than testid-sweeping

Playwright specs that use `getByText` on English copy stay correct by **pinning the E2E user's
locale to `en`** in the seeded session — one line in `e2e/global-setup.ts`. A separate testid sweep
for the bleed cases is unnecessary; the project convention already prefers `data-testid`
([[feedback-e2e-test-ids]]) and existing specs are mostly compliant.

### A glossary doc precedes ID translation

`docs/glossary-id.md` lists the ~30 financial-vocab decisions (Receivable → Piutang, Liability →
Liabilitas, Snapshot → Snapshot, etc.) and is written first. Subsequent extraction issues translate
against the fixed dictionary; the consistency cost of inline-translation-then-sweep is avoided.

## Considered alternatives

- **LinguiJS / react-intl.** Covered above.
- **Browser-only locale (no DB column).** Smaller change, but cross-device drift is a real bug for a
  shared household app. Rejected.
- **Full backend error-code envelope in the same milestone.** Cleanest end state, but doubles the
  scope and touches every HTTP handler. Deferred to its own ADR. The frontend mapping table is a
  cheap stopgap.
- **No glossary, translate inline during extraction.** Faster start, but consistency drift across
  screens (`Liabilitas` vs `Kewajiban`) needs a sweep later anyway. Rejected.
- **Don't ship ID at launch; scaffold EN catalogs only.** Defeats the point — the use case is the
  Indonesian-reading co-owner. Rejected.

## Consequences

- **Dependencies.** `react-i18next`, `i18next`, `i18next-browser-languagedetector` added; runtime
  bundle grows modestly (~30 KB gzipped). No Babel/SWC additions.
- **`lib/format.ts` becomes locale-aware.** Every existing `formatCurrency`/`formatDate`/
  `formatYearMonth` call site is unchanged at the call surface; the helper internally consumes the
  active locale.
- **ESLint rule against bare JSX text.** `react/jsx-no-literals` (or the equivalent) catches
  regressions. Allowlist for code tokens (`px-2`, `IDR`, etc.) in tests/fixtures.
- **`docs/glossary-id.md` is the canonical ID dictionary.** Translation PRs reference it; a new term
  expands it.
- **Migration `00020` adds `users.locale`.** `GET/PATCH /api/users/me` round-trip it; Settings UI
  gets a Language dropdown.
- **HANDOFF gains a "Don't reintroduce bare JSX text" convention** under the existing FE-lint
  bullet, and an i18n entry in the M6-shipped list when the work completes.
- **A follow-up ADR (0027) introduces a backend error-code envelope.** Tracking issue links it.
- **Future languages are JSON-only.** Add `public/locales/<lang>/<ns>.json` files and the `<lang>`
  option to the user-locale CHECK + the Settings dropdown — no code switching on locale.
