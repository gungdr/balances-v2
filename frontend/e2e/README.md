# E2E tests

Playwright suite that drives the running stack end-to-end. Orchestrated by
`make e2e` from the repo root: it spawns the mock-OIDC server + the backend
against `balances_e2e`, runs `cmd/balances seed-e2e` to reset that DB to a
known fixture, then launches Playwright. See ADR-0024 for the architecture.

## Locale is pinned to en-GB (issue #12)

Every spec runs against the **English UI**. Two layers enforce this so neither
the runner's `navigator.language` nor a locale-detector regression can flip
the suite into Indonesian copy:

1. **Backend seed.** `cmd/balances seed-e2e` writes `locale = 'en-GB'` on the
   Alice + Bob user rows. The `/me` response carries that value through to
   `AppShell`, which would otherwise reconcile against `navigator.language`
   on first login (`useLocaleReconcile`).
2. **Frontend storageState.** `global-setup.ts` pre-seeds
   `localStorage['balances.locale'] = 'en-GB'` so the i18n
   `LanguageDetector` resolves to English before the first paint, with no
   network race against `/me`.

### What this means for spec authors

- `getByText('New bond position')` / `'Record monthly snapshot'` /
  `'No snapshots yet.'` / `/match ledger total/` etc. are **fine** —
  they target stable English copy that the pin guarantees. The standing
  testid convention (`feedback_e2e_test_ids`) still applies for
  picks/asserts that would otherwise need brittle DOM traversal, but it
  doesn't require every English string to get an id.
- **Do not assert Indonesian copy.** There is no `make e2e:id` variant.
  If you want to exercise a locale-switch flow, drive the Settings
  language dropdown inside the spec — don't edit the seed.
- New extraction issues that move a literal into a catalog don't break
  the pin as long as the EN value stays byte-identical. If you change
  EN copy, update the spec's `getByText` argument in the same commit.

The convention is single-locale by design (ADR-0026): the EN catalog is
the source of truth, ID translation is a downstream artefact, and the
E2E suite's job is to verify behaviour against canonical copy, not to
re-verify the translation file shape (that's covered by
`src/i18n/catalogs.test.ts`).
