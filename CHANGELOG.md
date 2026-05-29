# Changelog — milestone history

The **historical record** of balances-v2: the blow-by-blow of what each milestone shipped, plus
the design decisions settled during each grilling round. Split out of `HANDOFF.md` on 2026-05-29
so the handoff doc could stay a thin live-state pointer.

See `HANDOFF.md` for current state, conventions, and the deferred backlog; `CONTEXT.md` and
`docs/adr/*` for the design. Content here was relocated, not edited — only line-wrapped (~100
columns). The status ladder below is a point-in-time snapshot; the live ladder is in `HANDOFF.md`.

## Status ladder (snapshot at 2026-05-29 relocation)

- **M1–M3 complete.** Walking skeleton, Google OAuth + invites, first vertical slice (bank-account
  asset with snapshots), all tenancy-tested.
- **M4.1 complete.** Property + vehicle asset subtypes through the full stack, two-level nav, Title
  Case on nav.
- **M4.2 complete.** Liability + receivable groups end-to-end. Last `origin/main` commit: see `git
  log -1`.
- **CI / coverage side quest (complete, post-M4.2).**
  - GH Actions on every push to `main` + every PR: golangci-lint + `go test -race -coverprofile` +
    Codecov upload + ESLint + `npm run build`. Coverage thresholds informational until alpha. Needs
    `CODECOV_TOKEN` (in repo secrets) — Codecov treats the default branch as protected even on
    public repos.
  - Phase 1: happy-path CRUD added to the 5 repo tenancy suites; `internal/repo` ~70%.
  - Phase 2 (post-M4.4): 4 position-group HTTP packages 0% → covered via harness (real testcontainer
    DB + real repo + chi router + `auth.WithUser` ctx, no mocks): receivables **76.2%**, liabilities
    **77.8%**, assets **81.7%**, investments **78.9%**. Test files mirror production layout.
  - Phase 2b: `internal/auth` 0% → **71.2%** in two steps — non-OAuth half (SessionMiddleware,
    RequireAuth, /me, /invitations, /logout, /auth/google/start, bootstrapNewUser + createFounder
    via direct in-package calls); then a `googleOAuthClient` interface (in `google.go`) lets tests
    swap a `stubOAuthClient` and drive `handleCallback` end-to-end (state-cookie/CSRF,
    exchange-error → 502, existing-user signin, new-founder bootstrap, invited-user bootstrap,
    invitation-error). Only `exchange()` + `newGoogleOAuth` OIDC-discovery stay 0% (need real
    `accounts.google.com`).
  - Side benefit: real defense-in-depth bug fixed — `handleCreateInvitation` self-invite check now
    lowercases `inviter.Email`.
- **M4.3a backend complete.** Investments group (Stock + MutualFund + Gold) end-to-end (migration,
  repo, handlers, tenancy + happy-path + shape-validation tests). `investment_snapshots` column is
  `amount` (ADR-0022 backtracked from `total_value` for cross-group consistency). Subtype + status
  enums carry all forward-compat values so M4.3b adds extension tables without ALTERs.
  `internal/repo` ~72%.
- **M4.3a-frontend complete.** Three-level nav (Investments > {Stocks, Mutual Funds, Gold});
  per-subtype list/detail + create/edit dialogs; quantity×price snapshot dialog set with derived
  amount preview. Smoke-tested vs the live backend.
- **M4.3b backend complete.** Bond + TimeDeposit end-to-end (migration 00007 adds two extension
  tables; no change to `investments`/`investment_snapshots` — M4.3a already carried
  `bond`/`time_deposit` in the subtype CHECK + the accrued-interest column). Five-subtype tenancy
  test covers stock/mutual_fund/gold/bond/time_deposit; snapshot-shape validation exercises both XOR
  branches.
- **M4.3b-frontend complete.** Per-subtype Bond + TimeDeposit UI (5 components each); three-set
  snapshot dialog fork (amount-only / quantity-price / accrued-interest), existing investment trio
  renamed `QuantityPriceSnapshot*` for shape-based naming. Investments nav → 5 tabs (Stocks → Mutual
  Funds → Bonds → Time Deposits → Gold).
  - Prep: migration 00008 backtracked rate storage decimal-fraction → percentage (`0.055` → `5.5`)
    across liability/property/vehicle/bond/time-deposit rates ("type what you read on the
    statement"); migration 00009 added `bond_details.series_code` (parallel with MutualFund).
- **PaginationControls extracted (post-M4.3b-frontend).** Copy-pasted `function PaginationControls`
  in the 10 detail pages
  (`{BankAccount,Property,Vehicle,Liability,Receivable,Stock,MutualFund,Gold,Bond,TimeDeposit}Detail.tsx`)
  → shared `frontend/src/components/PaginationControls.tsx`; detail pages drop the six
  `@/components/ui/pagination` imports. Straight dedupe, no API change (shape was stable modulo
  whitespace).
- **Recharts code-split (complete, post-M4.3b-frontend).** `SnapshotChart` now a lazy wrapper around
  `SnapshotChartImpl` (default export holds recharts + the shadcn chart wrapper); detail pages keep
  `import { SnapshotChart }`; empty-snapshot short-circuit in the wrapper so the chunk isn't fetched
  on empty data. `vite.config.ts` += `manualChunks` (React, Radix, react-query, lucide) +
  `server.host: true` (LAN dev). Main chunk 890 kB/233 kB gz → 242 kB/35 kB gz; recharts a 337
  kB/100 kB gz lazy chunk; chunk-size warning gone.
- **Auto-migrate-on-serve (complete, post-M4.3b-frontend).** `serveCmd` now calls `applyMigrations`
  before opening the pgxpool (mirrors testutil: `sql.Open` → `goose.SetBaseFS`/`SetDialect` →
  `goose.UpContext`). HANDOFF had claimed this but the wiring never existed — only test infra + the
  `migrate` subcommand called goose. Now `serve` applies a pulled migration on startup; manual `go
  run ./cmd/balances migrate up` still works (status/down/up-by-one). Blocking startup on migrate is
  fine for a pre-alpha single-household app.
- **M4.4 backend complete.** Investment transaction ledger end-to-end (migration 00010 + queries +
  repo + handlers + 17-subtest tenancy/shape test). Single polymorphic `investment_transactions`
  with a `transaction_type` enum (`buy`/`sell`/`coupon`/`dividend`/`distribution`/`fee`/`maturity`)
  + a CASE-driven CHECK enforcing type→shape at the DB level.
  `validateInvestmentTransactionType(subtype, type)` enforces the subtype→type matrix (Stock →
  Buy/Sell/Dividend/Fee; MutualFund → +Distribution; Bond → +Coupon+Maturity; Gold → Buy/Sell/Fee;
  TimeDeposit → Maturity only); `validateInvestmentTransactionShape` catches missing-field combos
  with friendlier errors than the CHECK. New sentinels `ErrInvalidTransactionType` +
  `ErrInvalidTransactionShape` → 400. Per ADR-0003, transactions don't auto-propagate to
  bank-account snapshots.
- **M4.4 frontend complete.** Per-shape dialog forks (Create + Edit) for Trade, CashIncome, Fee,
  Maturity = 8 dialogs. One shared `TransactionRow` switches the Edit dialog on `transaction_type`
  (unified backend endpoint → one updateMutation). All 5 detail pages
  (Stock/MutualFund/Bond/Gold/TimeDeposit) gained a Transactions card + subtype-appropriate "+ Type"
  buttons. Maturity dispositions default from `rollover_policy` (TD only):
  `auto_renew_with_interest` → both rolled, `auto_renew_principal` → P rolled / I cash,
  `no_rollover` → both cash. Soft reconciliation warning on Stock/MF/Gold compares latest snapshot
  qty to Σ(Buys − Sells − Fee.qty_deducted) — display-only (statements stay source of truth). Main
  242 → 276 kB / 41 kB gz.
- **HTTP handler coverage Phase 2c complete (post-M4.4).** Closed remaining error-branch gaps in the
  4 position-group HTTP packages.
  - New `error_branches_test.go` per package: invalid-UUID path params on PATCH/DELETE, malformed
    JSON on PATCH, validator failures on snapshot/transaction Update, bad-date branches on subtype
    PATCH. Lifts: assets 81.7→**92.6**, liabilities 77.8→**93.5**, receivables 76.2→**93.1**,
    investments 78.9→**90.6**.
  - Repo populated-list gap fixed: `ListProperties` + `ListVehicles` were 21.9% (tenancy tests only
    hit the `len==0` early-return); added alice-creates-entity-and-snapshot subtests → both 87.5%.
  - Dead `repo.ErrUnauthenticated` branch removed from `repoErrorStatus`/`writeRepoError` in all 4
    packages — `RequireAuth` gates every Mount route, so it's unreachable in the HTTP path; a future
    leak falls through to 500 (correct for a server bug). Convention documented in `repo/errors.go`.
- **Codecov ignore convention (set during Phase 2c).** `codecov.yml` excludes from the reported
  metric: `backend/internal/db/**` (sqlc-generated), `backend/internal/testutil/**` (test helpers),
  `backend/cmd/balances/**` (entrypoint glue), `backend/internal/migrations/**` (.sql). Local `go
  test -cover` unaffected. `internal/db` runs ~80% transitively under repo tests but Go's
  per-package coverage doesn't see it; `-coverpkg` not worth the churn. `internal/config` +
  `internal/httpserver` kept **visible** as real gaps — both since filled (config 100%, httpserver
  wiring 100% / handleHealthz 66.7%).
- **M4.5 (Income) complete.** Flat flow-event entity end-to-end. Migration 00011 (`income`:
  closed-enum category CHECK + amount>0 CHECK + sole/joint ownership CHECK + `(household_id, date
  DESC)` partial index; no extension tables / snapshots / lifecycle). `IncomeRepo` CRUD; tenancy
  test covers cross-tenant rejection + alice happy-path incl. populated List. HTTP at `/api/income`
  (singular — mass noun); per-resource + `error_branches_test.go` (invalid UUID / bad JSON / bad
  date / ≤0 amount). Frontend: top-level `Income` tab, flat chronological screen (newest first,
  PAGE_SIZE=12), single shape across all 7 categories → one Create + one Edit dialog. Row-level
  Duplicate pre-fills Create with category/amount/currency/description/ownership + `date = today`.
  Defaults: **no category** (placeholder forces a pick), **ownership = Sole + current user** (salary
  is dominant). Category mutable post-create (unlike `investment_transactions.transaction_type`).
- **Sole-owner picker on Income dialogs (post-M4.5).** `GET /api/household/members` added to `auth`,
  returns `[{id, display_name, email}]` for the current household (public shape — no
  `google_sub`/audit cols), backed by `ListUsersByHousehold` sorted `display_name ASC`. Frontend
  `useHouseholdMembers` keyed `['household-members']`, 5-min staleTime. Create/EditIncomeDialog show
  a member `<select>` when ownership=sole, current user marked "(you)" + default-selected. Position
  dialogs (×10) still default sole→current user with no override — own sweep next. Test
  `TestHandleListHouseholdMembers`: sorted multi-member, 401, cross-household (Carol sees only
  herself), `google_sub` leak guard.
- **Sole-owner picker on 10 Create position dialogs (post-M4.5 #2).** `useHouseholdMembers` +
  sole-owner `<select>` into
  CreateBankAccount/Liability/Receivable/Property/Vehicle/Stock/MutualFund/Gold/Bond/TimeDeposit.
  Default stays `joint`; flip to sole shows members, current user "(you)" + default-selected. Radio
  "Mine" → "Sole owner" across all 10 (matches Income). Main 276 → 293 kB / 43.76 kB gz.
- **Position Edit-side ownership shipped (post-M4.5 #3).** Extended `ownership_type` +
  `sole_owner_user_id` through all 10 Update paths.
  - **SQL:** the two columns added to the SET of `UpdateAsset` (Bank/Property/Vehicle),
    `UpdateLiability`, `UpdateReceivable`, `UpdateInvestment` (all 5 investment subtypes) — only 4
    queries (investments + assets share parent-table updates). sqlc regenerated.
  - **Repo:** two fields on all 10 `UpdateXxxParams`, wired to the sqlc call.
  - **HTTP:** `OwnershipType` (`required,oneof=sole joint`) + `SoleOwnerUserID`
    (`required_if=OwnershipType sole`) on all 10 `updateXxxReq`.
  - **Tests:** every alice Update subtest passes `OwnershipType: "joint"`; +5 `flips ownership
    joint→sole with owner picker` subtests (Bank/Property/Vehicle/Liability/Receivable/Stock +
    round-trip via Get); 10 HTTP update happy-path + 404 tests gained `"ownership_type": "joint"`.
  - **Frontend:** two fields on all 10 `UpdateXxxPayload`; ownership block (radio + picker) on all
    10 Edit dialogs; `toForm` seeds current ownership.
- **Owner-name display in lists + details (post-M4.5 #4).** New shared
  `lib/ownership.ts#ownershipLabel(type, userID, members, currentUser)`: joint → "Joint"; sole →
  owner's display_name (+"(you)" if current user); falls back to "Sole" when members still loading
  or owner unresolved (soft-deleted). All 5 list rows + 10 detail pages (`Ownership: …`) render the
  resolved label; IncomeRow refactored onto the shared helper. The two new hooks
  (`useHouseholdMembers` + `useSession`) must be called before `if (!entity) return null`
  (rules-of-hooks). Main 305 → 306 kB / 44.45 kB gz.
- **Test-DB sharing side quest (complete, post-M4.5).** `testutil.NewTestDB` was spawning a fresh
  Postgres container + all migrations per call (~100 spawns/run). Rewrote `testutil/db.go`: **one
  container per package** via `sync.Once` (Ryuk-reaped on exit) + `TRUNCATE` all app tables
  (catalog-driven, `goose_db_version` excluded) before each `NewTestDB`. Safe — no `t.Parallel`,
  sequential within package, clean under `-race`. Signature unchanged → **zero test-file edits**.
  Full suite ~100s → ~18s (~20s `-race`); per-package 10–30× (investments 99→4s, auth 68→3s, assets
  64→3.5s). Coverage unchanged. Unrelated long pole: `internal/email`'s
  `TestSMTPMailer_SendToMailpit` ~8s when dev Mailpit is live on `localhost:1025`; skips in CI.
- **M4.6 (Position lifecycle UI) complete.** Editable `status`/`terminated_at`/`termination_note`
  across all 4 position groups + the Maturity-flips-status hard guard for Bond/TimeDeposit (was a
  frontend band-aid, now a backend invariant).
  - **Backend:** migration 00012 adds a biconditional CHECK (`(status='active') = (terminated_at IS
    NULL)`) to all 4 core tables (existing rows satisfy it, no backfill); 4 `UpdateXxxLifecycle`
    queries + repo methods on the *parent* tables (4 not 10 — assets covers bank/property/vehicle,
    investments covers all 5 subtypes); `validatePositionLifecycle` checks the per-group status set
    + biconditional; new sentinels `ErrInvalidLifecycle` → 400, `ErrPositionNotActive` → 409.
    `CreateInvestmentTransaction` now wraps insert + maturity-flip in one pgx tx: a Maturity sets
    `status='matured'` + `terminated_at` atomically; a further transaction on a non-active
    investment → 409. Guard order: type → shape → active-check (structurally-invalid still get their
    400).
  - **HTTP:** `PATCH /api/{assets,liabilities,receivables,investments}/{id}/lifecycle`; validator
    `required_unless=Status active` for the date, repo owns the status-set check.
  - **Tests:** `repo/lifecycle_tenancy_test.go` (terminate each group, biconditional both ways,
    unknown/cross-group status rejected, correction-back-to-active clears date,
    bob-cannot-terminate→ErrNotFound, maturity-flip + second-maturity→ErrPositionNotActive) +
    `assets/lifecycle_test.go` + `investments/lifecycle_test.go` (maturity 201 then 409). Migration
    applies clean (goose v12).
  - **Frontend:** `lib/lifecycle.ts` (per-group STATUS_OPTIONS, statusLabel, isActiveStatus),
    `useLifecycle.ts` (PATCH + invalidates `[listKey]` + `[listKey, id]`),
    `TerminatePositionDialog.tsx` (dedicated action — status `<select>`, date shown+required only
    when non-active + auto-filled to today, optional note; trigger "Close position" when active else
    "Edit status"), `StatusBadge.tsx` (muted active, amber terminal). Wired into all 10 detail
    pages: badge in the description line, terminate button in the action row,
    create-snapshot/transaction gated on `isActiveStatus`. Removed the `hasMaturity` band-aid from
    Bond + TD. Maturity flips status via the *transactions* endpoint (doesn't touch the investment
    detail cache) → `useCreateInvestmentTransaction` gained an optional `detailKey` that Bond/TD
    pass (`'bonds'`/`'time-deposits'`) to also invalidate `[detailKey, id]`.
  - **Design notes** folded into ADR-0009 ("M4.6 implementation notes"): the dedicated-action UX,
    require-`terminated_at`+default-today, the hard-guard, and that same-row un-terminate is a
    *correction* (not reactivation — genuine re-acquisition is a fresh Create; revisit if audit-gap
    ambiguity bites).
  - **Not yet live-smoke-tested** (Google-OAuth-only; integration tests drive the real chi router +
    repo end-to-end — user eyeballs the dev UI). Could next pick up M6 polish (TD
    duplicate-on-maturity, future-date validation) before M5.
- **E2E backend half complete (Playwright, ADR-0024).** Auth bypassed at the IdP not the session —
  Google login can't be automated (bot detection), so tests inject a pre-seeded server-side session
  cookie and the *real* `SessionMiddleware` accepts it (zero auth-code change). Tests run against a
  dedicated `balances_e2e` DB in the same Postgres container (auto-migrate-on-serve self-populates),
  keeping dev data clean + assertions deterministic.
  - **Backend:** `cmd/balances seed-e2e` — migrate (idempotent goose up) → **hard guard** (refuses
    any DB name ≠ `balances_e2e`, since it truncates every app table) → `truncateAppTables`
    (catalog-driven) → insert one household + Alice + Bob + an active session for Alice with the
    fixed id `e2e-session-alice` → print `SESSION_ID=` as the sole stdout line. The session id is a
    deterministic constant (only ever exists in `balances_e2e`).
  - **Makefile:** `e2e-db-create`, `e2e-seed`, `e2e-backend` (serve against `balances_e2e`);
    `E2E_DATABASE_URL` = `DATABASE_URL` with the db-name swapped via sed (sed delimiter must not be
    `#` — Make reads it as a comment).
  - **Verified:** seed applies 12 migrations + fixtures; `/api/me` with `Cookie:
    session=e2e-session-alice` → 200 Alice, no cookie → 401, `/api/household/members` → Alice+Bob;
    guard refuses the dev `balances` DB without truncating. No Go test (codecov-excluded entrypoint
    glue).
  - **Not covered by design:** tenancy + finance stay in the Go suites; the login flow itself
    unverified by E2E until mock-OIDC (ADR-0024 option B) — `handleCallback` ~71% unit-covered via
    `stubOAuthClient`.
  - **Frontend half:** `@playwright/test`; `playwright.config.ts` (chromium, `baseURL` :5273,
    `storageState` auth, `workers:1`, two `webServer`s — e2e backend on :8099 with
    `DATABASE_URL=balances_e2e` + vite on :5273 with `API_PROXY_TARGET=:8099`);
    `e2e/global-setup.ts` writes a storageState with the `session=e2e-session-alice` cookie (does
    *not* seed — `make e2e` seeds synchronously first); `e2e/auth.spec.ts` (authenticated AppShell
    asserts); `e2e/income.spec.ts` first write-flow — income create→edit→delete, navigating via the
    Income tab, keyed off a unique description, self-cleaning. `vite.config.ts` proxy target now the
    `API_PROXY_TARGET` env (default `:8080`) so e2e vite hits the e2e backend without touching
    8080/5173. `make e2e` = `e2e-db-create` → `e2e-seed` → `npm run test:e2e`; Playwright owns the
    e2e backend/vite lifecycle. Verified green (1 passed, ~4s).
  - **Known gaps:** (1) CI does not run the e2e suite (needs Docker + Go + Google creds +
    orchestration; ties into path-filtered-CI). (2) ~~e2e backend boot does real Google OIDC
    discovery~~ **resolved** (mock-OIDC, below). Frontend has no other test tooling — vitest
    (ADR-0021) unadded; planned as a lib/* backfill. Two specs live: auth + income.
- **mock-OIDC complete (ADR-0024 option B, agreed-sequence item 1).** E2E backend no longer does
  real Google OIDC discovery on boot.
  - **Production change (only one, behaviour-preserving for Google):** `newGoogleOAuth` discovers
    from a configurable `OIDC_ISSUER_URL` (default `https://accounts.google.com`) and uses
    discovery's `provider.Endpoint()` instead of the hardcoded `google.Endpoint`.
  - **New `cmd/balances mock-oidc`:** ~120-line OIDC provider (`/.well-known/openid-configuration` +
    `/jwks` + immediate-approve `/authorize` 302-ing back with a single-use code + `/token`
    returning a signed id_token), signing via `go-jose/go-jose/v4` (promoted to direct dep — **zero
    new modules in go.sum**). Issues `sub=e2e-alice` / `alice@example.com` matching the seeded Alice
    (shared `e2eAlice*` constants with `seed-e2e`).
  - **Orchestration:** `make e2e` builds the binary, launches the mock (:8090), waits for discovery,
    runs Playwright, kills the mock on exit (trap) — mock must be up before the backend boots since
    `auth.New` discovers at startup. Playwright's backend `webServer` env points
    `OIDC_ISSUER_URL`/client creds/`OAUTH_REDIRECT_URL`/`FRONTEND_URL` at e2e ports; the host-scoped
    `localhost` session cookie is shared with the e2e frontend.
  - **New `login.spec.ts`** overrides the injected storageState with an empty one, clicks Sign-in,
    lands as Alice through the real flow. Three specs live (auth, income, login); full `make e2e`
    green (~4s). Pre-Playwright verified via curl: boot-time discovery, JWKS verify, single-use
    codes (reuse→400), `client_secret_basic`/`client_secret_post` (bad secret→401), `/api/me`→Alice.
    Folded into ADR-0024. Hand-rolled over mockoidc/navikt: zero-new-dep + one-happy-path-login is
    all we need.
- **E2E flow expansion complete (agreed-sequence item 2).** +9 write-flow specs → 12 total. Every
  distinct dialog family now has live UI+backend coverage vs `balances_e2e`:
  - **lifecycle.spec** (bank account close→reopen correction — StatusBadge Active⇄Closed +
    snapshot-button gating, both directions — the never-live-smoke-tested M4.6 core)
  - **maturity.spec** (TimeDeposit Maturity flips status→Matured atomically + re-gates the create
    row)
  - **snapshot.spec** (amount-only snapshot CRUD)
  - **trade.spec** (Stock Buy quantity-price + a mismatched snapshot firing the display-only
    reconciliation warning)
  - **receivable / liability / property.spec** (position-group CRUD via the list-row action menu)
  - **bond-snapshot.spec** (accrued-interest shape)
  - **dividend-fee.spec** (Stock Dividend CashIncome + pure-cash Fee — the last two transaction
    families)
  - All self-cleaning. **Conventions established:** status assertions scope to the `<span>` badge
    (the same label also renders as a `<select>` `<option>` in the open Terminate dialog →
    strict-mode collision); titles colliding with a same-text submit button (`Record
    Maturity`/`Buy`/`Dividend`/`Fee`) asserted via `getByRole('heading', …)`; create dialogs have a
    duplicate trigger in the empty-state card so `+ New X` uses `.first()`; list rows navigate via
    `row.getByText(name).click()`. Full `make e2e` green (12 passed, ~19s). Still not in CI.
- **vitest tracer-bullet landed (agreed-sequence item 3).** Vitest 4.1.7 + `@vitest/coverage-v8` dev
  deps; standalone `vitest.config.ts` (separate from `vite.config.ts`; `environment: 'node'`,
  `include: ['src/**/*.test.{ts,tsx}']`, v8 coverage scoped to `src/lib/**`, `text`+`lcov`). Scripts
  `test` + `test:coverage`. First suite `src/lib/reconciliation.test.ts` (7 cases). `coverage/` in
  `.gitignore` + eslint `globalIgnores`.
  - **CI wiring:** `frontend-checks` runs `npm run test:coverage` before `build`, uploads
    `frontend/coverage/lcov.info` with `flags: frontend`, `fail_ci_if_error: true`. The `frontend`
    flag section was already in `codecov.yml`.
  - **Item 3 complete** — remaining pure helpers covered: `ownership.test.ts` (6),
    `maturity.test.ts` (buckets + "Matures today" + bad-date + `maturityClass`, fixed `now` + local
    dates), `lifecycle.test.ts`, `gold.test.ts` (24K-.999+ band, karat fractions, percentage
    fallthrough), `format.test.ts` (currency decimals by `NO_DECIMAL_CURRENCIES` + NaN;
    `formatYearMonth`/`formatDate` pin locale; midday-UTC timestamps dodge TZ day-roll). **36 tests
    / 6 files**, all green; `src/lib` **98.55% stmt / 100% branch / 93.75% func**. Only `utils.ts`
    (`cn` = `twMerge(clsx())`) stays 0%, intentionally. RTL + MSW + jsdom deferred to component
    tests. E2E stays out of CI + the coverage metric (ADR-0021).
- **Backend coverage backfill to clear 80% with margin (post-item-3).** The codecov-visible metric
  sat on **80.5%** (zero margin). Lifted to **81.8%**, all mockless (no fault injection):
  - `internal/config/config_test.go` exercises `Load` (defaults, env overrides, missing
    `DATABASE_URL`, non-integer `PORT`) → `Load` 100% — uses a `clearConfigEnv` that **Unsets** (not
    `t.Setenv("")`, which defeats `envDefault`) every key, restoring on cleanup, so a sourced `.env`
    can't leak.
  - `internal/httpserver/server_test.go` drives `New → buildRouter → Handler → handleHealthz` with a
    real pool but **nil route handlers** (`buildRouter`/`Mount` only register method values, valid
    on a nil receiver; the cookie-less `/healthz` short-circuits `SessionMiddleware` before touching
    `authH.q`). `New`/`Handler`/`buildRouter` 100%, `handleHealthz` 66.7% (DB-unreachable 503 branch
    left).
  - +5 subtests in `repo/lifecycle_tenancy_test.go` for the per-function validate-reject +
    `ErrNoRows`→`ErrNotFound` on liability/receivable/investment (coverage is per-function though
    `validatePositionLifecycle` is shared) → all three `Update*Lifecycle` **81.8%**.
  - **Decision recorded:** deeper gains need a mock/fault-injecting pool for the `if err != nil`
    DB-error wraps in `Get*`/`Update*`/`softDelete*` — brittle, low-ROI, declined.
- **Agreed next sequence (user set 2026-05-25).** ~~(1) mock-OIDC~~ **done**; ~~(2) more E2E flows
  (lifecycle first)~~ **done**; ~~(3) vitest + Codecov frontend flag~~ **done**. Next: **(4) back to
  product** (M5 dashboard / M6 polish). Work in order unless redirected.
- **M5 design grilling complete (pre-implementation, no code).** Stress-tested the
  materialized-report / dashboard design vs the domain model; decisions folded into CONTEXT +
  ADR-0002/0006/0008/0012:
  1. **carry-forward** — month M uses each position's latest snapshot ≤ M, unbounded; `year_month <
     M` flags stale.
  2. **`fx_rates`** household-scoped `(year_month, currency, rate)`, month-end, no as-of-date,
     carry-forward resolution, missing rate → **exclude + `missing_fx`**, never 1:1 (ADR-0002).
  3. **`households.multi_currency_enabled`** default off, gates UI+conversion not storage.
  4. FX **auto-fetch deferred post-M5** (Frankfurter, not Google Finance; `source` col lands with
     the fetcher).
  5. **return formula** precise txn→cash map — unit-fees + rolled-maturity excluded, birth-month
     baseline=0, timing noise cumulative-correct + snapshot-nudge (ADR-0008).
  6. **month coverage** — provisional current month (user `time_zone`), first month = NW +
     earned-income baseline with return/expenses suppressed (ADR-0006).
  7. **staleness** conservative ≤M uniform rule, full input list, detail-tables + `users` excluded
     (ADR-0006).
  8. **Joint = own column** not split (CONTEXT, ADR-0012).
  9. **dashboard** single-scroll headline-first, living-expenses sign-relabel + per-month
     data-quality nudge + waterfall.
  10. **`asset_value_change`** new column isolating property/vehicle non-cash decline so living
      expenses reads as a true cash-spending proxy (CONTEXT, ADR-0008, ADR-0012).
  - Tactical leaves deferred to build-time: currency side-by-side panel, rebuild-control placement,
    drill-down scope. Next: M5 implementation plan + slices.
- **M5 slice 1 complete (net-worth dashboard, end-to-end).** Materialized report + headline
  dashboard, net worth only (income-statement = slice 2).
  - **Backend:** migration `00013_monthly_reports` (full ADR-0012 schema; treated as a regenerable
    **cache** — plain unique `(household_id, year_month)` + upsert, **no soft-delete**,
    `generated_at` the sole timestamp + staleness point). `queries/monthly_reports.sql`:
    upsert/get/list/`DeleteMonthlyReportsOutsideRange` + `MaxReportInputUpdatedAt` (one `GREATEST`
    watermark over the `≤M` inputs — 4 snapshot + 4 parent tables + households;
    FX/income/transactions join later) + lightweight
    `List{Assets,Liabilities,Receivables,Investments}ForReport` (id/ownership/terminated_at) +
    `List{…}SnapshotsForReport` (position_id/year_month/amount).
  - **Pure engine** `monthly_reports_engine.go` (no DB, unit-tested): carry-forward (latest ≤ M via
    month-index math, unbounded), month-granular lifecycle suppression (contributes through the
    termination month), per-user + `"joint"` breakdown with liability subtraction, stale-position
    flagging; `nw_liabilities` stored positive, `nw_total = assets+receivables+investments −
    liabilities`.
  - **`MonthlyReportRepo`** (`monthly_reports.go`): lazy regen on read — coarse-but-correct
    `needsRegen` (whole-household regen when the month set differs or any row predates the
    watermark), tx upsert + out-of-range prune; current month from the requesting user's
    `time_zone`.
  - **HTTP** `internal/reports`: `GET /api/reports` + `GET /api/reports/{yearMonth}`; DTO (jsonb →
    `json.RawMessage`, else base64) carrying `reporting_currency`.
  - **Tests:** 5 pure-engine + repo integration (plumbing/tenancy/staleness no-regen +
    regen-on-edit). Race-clean, lint clean.
  - **Frontend:** `MonthlyReport` type, `useReports`, `DashboardScreen` (single-scroll
    headline-first: NW + MoM trend + in-progress tag, stale banner, time-series via the reused
    `SnapshotChart`, group-breakdown bars, by-person), wired as the **default home tab** (`group`
    defaults to `dashboard`). vitest 36 green, main 306→317 kB. Verified via curl vs live data
    (2014→2026): carry-forward, breakdowns, negative NW, JSON shape all correct. UI not
    agent-eyeballed.
- **M5 slice 2 complete (income statement).** The comprehensive-income identity (ADR-0008) on top of
  slice 1.
  - **Backend:** `List{Assets,Investments}ForReport` gained `subtype`; new `ListIncomeForReport` +
    `ListInvestmentTransactionsForReport`; watermark += `income(date<=M)` +
    `investment_transactions(transaction_date<=M)`; `UpsertMonthlyReport` extended to the full
    ADR-0012 columns (earned_income_* ×8, investment_return_* ×6, asset_value_change,
    derived_living_expenses — all nullable).
  - **Engine:** `transactionCashFlows` maps each txn type to cash_in/out (Buy→in;
    Sell/Coupon/Dividend/Distribution→out; Fee→in *only* when `quantity IS NULL`; Maturity→out per
    cash_out disposition, rolled=0); per-instrument return = `ΔSnapshot(carry-forward) + cash_out −
    cash_in` summed by subtype (computed even with no snapshot that month → transaction-only months
    count); `asset_value_change` = Σ ΔSnapshot over **property + vehicle** only (bank stays cash);
    `derived_living_expenses` = `earned + return + assetΔ − ΔNW` (residual closes the identity);
    **first-month baseline suppresses** return/assetΔ/expenses (NULL), earned_income always
    computed. `user_breakdowns` += per-user/Joint `earned_income` + `investment_return`.
  - **Repo:** loads income + transactions + position subtypes; `ptr()` helper for the
    always-computed nullable earned-income; baseline leaves return/assetΔ/expenses nil.
  - **HTTP DTO** carries the full income statement (nullable → JSON null on baseline).
  - **Tests:** engine `TransactionCashFlows` (table, all types), `IncomeStatement` (identity closes
    + depreciation isolated + baseline suppression), `InvestmentReturnWithCashFlow`. Race-clean,
    lint clean.
  - **Frontend:** types extended; `DashboardScreen` "This month" panel — earned income / investment
    return / property+vehicle value change (shown only ≠0) / living-expenses with **sign-aware
    relabel** (negative residual → "Unexplained increase") + `ⓘ` hints + a "Net worth change" total;
    baseline shows a "first tracked month" note. vitest 36 green, main 317→319 kB.
  - **Verified (API, live):** 2026-04 (depreciation −18M isolated, expenses 7.4M), 2026-05
    (revaluation +100M → expenses −35.8M → "Unexplained increase"), identity closes exactly,
    baseline suppressed. **Gotcha:** engine-code changes don't bump the data-driven watermark → had
    to `TRUNCATE monthly_reports` to force regen (Slice-4 rebuild button's job; ADR-0006
    anticipated).
- **M5 slice 3 — multi-currency + FX (complete).** FX engine + rate management + toggle + dashboard
  conversion. Per-dialog currency-picker sweep deferred (foreign positions via API/SQL meanwhile).
  - **Migration** `00014_fx_rates`: household-scoped (`year_month` DATE, `currency`, `rate`
    DECIMAL(20,8), audit + soft-delete, partial unique `(household_id, year_month, currency)`);
    `households.multi_currency_enabled BOOLEAN DEFAULT false`.
  - **Queries:** `fx_rates.sql` CRUD; `households.sql` += `UpdateHouseholdSettings` +
    `CountForeignCurrencyPositions` (OFF-guard). Report: `currency` on the 4 `*ForReport`;
    `ListFxRatesForReport`; watermark += `fx_rates(year_month<=M)`; upsert writes `fx_rates_used` +
    `missing_fx`.
  - **Engine v3:** `fxConverter` (`latest <= M` carry-forward) converts every
    snapshot/income/cash-flow to the reporting currency. Multi-currency OFF = no-op
    (regression-tested). Unconvertible → excluded + `missing_fx` (deduped; position_id null for
    flow-only). Reporting currency rate≡1.
  - **Repo:** `FxRateRepo` CRUD (dup → `ErrFxRateExists`/409); `loadEngineInput` loads rates +
    reporting_currency + `multi_currency_enabled` + per-row currencies.
  - **HTTP:** `internal/fxrates` (`/api/fx-rates`); `PATCH /api/household/settings` (blocks disable
    while foreign positions exist → 409); `/api/me` += `reporting_currency` +
    `multi_currency_enabled`.
  - **Frontend:** `Me`+`MonthlyReport` types (+`MissingFx`,`FxRate`); `useFxRates` +
    `useHouseholdSettings`; Settings tab (currency input + multi-currency checkbox + FX-rate table);
    dashboard missing-FX warning + "Exchange rates this month" panel.
  - **Tests:** engine `Fx{Conversion,CarryForward,MissingRate,OffPathUnchanged}`; `FxRateRepo`
    tenancy + dup-conflict. Race-clean, lint 0. Main 319→325 kB.
  - **Verified (curl):** `/me` fields, enable, create rate, USD-100 → `fx_rates_used {USD:16000}`;
    delete → `missing_fx`; OFF-guard 409 then 200. Bug fixed: DTO omitted
    `fx_rates_used`/`missing_fx`.
- **M5 slice 4 partial — manual rebuild controls** (user scoped to "rebuild only, then reassess";
  drill-downs skipped, side-by-side currency pending). The per-month + rebuild-all actions from
  ADR-0006 — the escape hatch for stale cache the data-driven watermark can't see (engine-code
  changes, FX corrections rippling across history); `TRUNCATE monthly_reports` was the manual
  stand-in.
  - **Backend:** two `MonthlyReportRepo` methods — `RebuildAll` (force regen → `writeReports`,
    ignoring `needsRegen`) + `RebuildMonth(yearMonth)` (generate the full set, upsert just the
    matched month via a new `writeReport` single-row helper — **no prune**, neighbours survive;
    `ErrNotFound` when out of range). Carry-forward means a per-month rebuild still reads every
    input ≤ M; only one row rewritten. Extracted `buildUpsertParams(hid, rep)` + `generate(ctx,
    hid)` shared by both write paths. `generated_at = now()` on upsert refreshes automatically.
  - **HTTP:** `POST /api/reports/rebuild` (→ `RebuildAll`, returns the series via `handleList`) +
    `POST /api/reports/{yearMonth}/rebuild` (→ `RebuildMonth` via `handleGet`; 404 out-of-range, 400
    bad month). Routes ordered so static `/rebuild` and `/{yearMonth}/rebuild` don't collide.
  - **Tests:** repo +3 subtests (rebuild-all bumps `generated_at` with no input change;
    rebuild-month bumps the target only, neighbour untouched; out-of-range → `ErrNotFound`); HTTP
    `TestReportsHandlers_Rebuild` (200 all / 200 month / 404 / 400 / 401). Race-clean, lint 0.
  - **Frontend:** `useRebuildReports` (rebuildAll + rebuildMonth, both invalidate `['reports']`);
    `DashboardScreen` low-key `RebuildFooter` — "Numbers look off? · Rebuild {Month} · Rebuild all
    months" (user terms not engine-cache jargon). vitest 36 green, main 325→326 kB.
  - **Playwright:** `rebuild.spec.ts` — record a snapshot, assert both rebuild POSTs 200
    (`waitForResponse` on the two URL shapes), dashboard stays healthy; self-cleaning. `make e2e`
    green (13 passed, ~21s).
  - **Regression caught by `make e2e`:** `snapshot.spec` + `lifecycle.spec` silently broke when
    slice 1 made Dashboard default — they clicked the `Bank Accounts` tab directly, but it's a
    sub-tab under `Assets`. Fixed both to navigate `Assets → Bank Accounts`.
  - **Test gotcha (minor UX gap):** the dashboard caches `['reports']` (`staleTime: 10s`);
    snapshot/position/income writes don't invalidate it, so a fresh snapshot doesn't refresh net
    worth until staleTime expires/reload — the spec reloads to force a fetch.
- **`['reports']` invalidation on data writes — DONE (post-slice-4).** The dashboard's `['reports']`
  went stale after data entry (writes didn't invalidate; headline lagged up to the 10s `staleTime`,
  or stayed stale across navigate-away-and-back). Fixed **globally**: `main.tsx`'s `QueryClient`
  carries a `MutationCache` with an `onSuccess` invalidating `['reports']` after **every**
  successful mutation. Chosen over per-hook (~13 hooks / ~30 mutations) — ADR-0006 warns enumerating
  inputs drifts when one's missed; one global handler can't drift, the cost is trivial (the
  refetch's server regen is a no-op when nothing went stale, and only fires when the dashboard is
  mounted). Removed the now-redundant explicit `['reports']` invalidations from `useFxRates`,
  `useHouseholdSettings`, `useRebuildReports`. `rebuild.spec.ts` now asserts the live refresh
  (snapshot create → back to dashboard → fresh NW, **no reload**). Lint/build/vitest(36)/`make
  e2e`(13) green.
- **M5 COMPLETE — side-by-side currency display (Q15c, the last done-when criterion).** Per ADR-0010
  a pure *rendering* concern: the report stores every figure in the reporting currency; the
  dashboard projects the headline NW into a second currency at that month's FX rate.
  **Headline-only** (picked over "headline + breakdowns" / "full toggle"): the big NW number gains a
  muted `≈ <amount>`; chart/breakdown/income-statement/by-person stay reporting-currency only.
  - **No backend change** — all data already client-side (`useReports` + `useFxRates`). New
    **`lib/fx.ts`** (unit-tested): `availableDisplayCurrencies(rates, reportingCurrency)` (distinct
    currencies with ≥1 rate, minus the reporting one, sorted), `resolveDisplayRate(rates, currency,
    yearMonth)` (most-recent `year_month ≤ M` carry-forward; null when none or rate ≤0/garbage),
    `convert(reportingAmount, rate)` (`reporting / rate`).
  - **`DashboardScreen`:** an "Also in: [—|CUR…]" header selector (local state, off by default;
    rendered only when `me.multi_currency_enabled` AND ≥1 display currency; stale selection guarded
    back to off if its rate is deleted); a `SecondaryAmount` sub-component renders `≈ <converted>` +
    flags carry-forward ("· CUR rate carried forward from <month>") or absence ("≈ — · no CUR rate
    yet — add one in Settings"). `formatCurrency` handles per-currency decimals (USD 2dp vs IDR
    0dp).
  - **Tests:** `lib/fx.test.ts` (9 cases) → vitest **45 / 7 files**, `src/lib` 100% branch; new
    **`e2e/currency-display.spec.ts`** (seed account+snapshot → enable multi-currency + enter a USD
    rate → pick "Also in: USD" → assert `≈` is a real conversion). The Q15c DOM carries
    **`data-testid`** (`dashboard-secondary-currency`, `dashboard-secondary-amount`); the spec
    asserts via `getByTestId` (the 12 pre-existing specs still use role/text). `make e2e` 14 passed
    (~24s), vitest 45 green, main 326→328 kB.
  - **E2E gotchas:** the multi-currency checkbox is a controlled async toggle (mutation → session
    refetch) → the spec `.click()`s + waits for the FX-rates card rather than `.check()`;
    `CardTitle` renders a `<div>` not a heading → assert card titles via `getByText`.
  - **Deferred (not M5 criteria):** drill-downs (ADR-0006) + the per-dialog currency-picker sweep.
    **All five M5 done-when criteria met** (materialized report + lazy/staleness regen; headline +
    group/person + income statement + time-series; manual rebuild; stale-positions warning;
    side-by-side currency).
- **Snapshot importer tracer complete (M6, bank-account only).** xlsx bulk-import of monthly
  snapshots for one position, end-to-end — backfill 10+ years without hand-entering every month.
  - **Backend:** `internal/snapshotimport` (pure, DB-free, unit-tested) — `BuildTemplate` emits a
    position-scoped `.xlsx` (Snapshots sheet = header + example row; Instructions sheet); `Parse`
    reads a filled one back (per-row validation, blank-row skip, dedupe by month, `year_month`
    derived from `as_of_date` when blank). New queries `GetAssetForImport` (display_name +
    native_currency; doubles as the ownership/404 check) + `UpsertAssetSnapshot` (ON CONFLICT on the
    partial unique `(asset_id, year_month) WHERE deleted_at IS NULL` → last-write-wins).
    `AssetRepo.ImportAssetSnapshots(assetID, rows, dryRun)` — ownership check, classify
    insert-vs-update, all-or-nothing tx upsert; dry-run returns counts, writes nothing. HTTP folded
    into the existing snapshots route: `GET …/import-template` (streams `.xlsx`) + `POST
    …/import?mode=preview|commit` (commit upserts only when zero row errors, else 422 + row list).
    "statement date" maps to the existing nullable `as_of_date` — no migration.
  - **Frontend:** `useImportSnapshots` + `importTemplateUrl` (multipart fetch bypasses the JSON
    `api` wrapper so the boundary isn't clobbered; a 422 body treated as a result not a throw, so
    per-row errors render); `ImportSnapshotsDialog` (download-template → file pick → "Check file"
    dry-run preview N new / N updated or per-row errors → "Import" lights up only on a clean
    non-empty preview; `data-testid` hooks); wired into `BankAccountDetail` beside "+ New snapshot",
    gated on active status.
  - **Format (xlsx not CSV):** typed cells dodge the id-ID number-format landmine (`1.000.000,50`);
    `.xlsx` is an open ISO standard (Sheets/LibreOffice/Numbers round-trip free) — instructions say
    "download as .xlsx, not CSV".
  - **Tests:** `snapshotimport` 7 (round-trip + every error branch); repo
    `TestAssetRepo_ImportAssetSnapshots` (dry-run no-write, commit, re-import upsert
    last-write-wins/no-dup, bob→ErrNotFound). Race-clean, lint 0, frontend lint+build+vitest(45)
    green, main 328→333 kB. Verified via curl: template downloads valid, preview counts, commit
    writes, re-commit flips insert→update.
  - **Not yet:** no Playwright spec (data-testids ready); UI not agent-eyeballed. **Deferred
    extensions** ~~property/vehicle/liability/receivable~~ **DONE**; ~~investment per-subtype
    shapes~~ **DONE** (entries below). Importer now complete across all groups. A leftover `Import
    Test Acct` bank account + its 2015-01 snapshot sit in the dev DB from the smoke.
- **Snapshot importer extended to all four amount-only groups (post-tracer).** Now covers
  **property, vehicle, liability, receivable**.
  - **Property + vehicle = zero-backend:** share `assets`/`asset_snapshots` + the
    `/api/assets/{id}/snapshots/import*` route with bank accounts, so `ImportAssetSnapshots` +
    `GetAssetForImport` + `UpsertAssetSnapshot` already worked — only frontend wiring into
    `PropertyDetail` + `VehicleDetail`.
  - **Liabilities + receivables = separate tables:** full backend mirrored —
    `Get{Liability,Receivable}ForImport` + `Upsert{Liability,Receivable}Snapshot` (ON CONFLICT on
    each partial unique → last-write-wins); repo `{Liability,Receivable}ImportMeta` +
    `Import{Liability,Receivable}Snapshots` (same shape as the asset version); HTTP `import.go` in
    each package folded into the existing `/{id}/snapshots` route.
  - **Naming honesty:** `snapshotimport.TemplateMeta.AssetName` → `PositionName` (now
    group-agnostic).
  - **Frontend dedupe:** wire-types (`ImportResult`/`ImportRowError`/`ImportArgs`) + multipart
    `postSnapshotImport(base, …)` + `snapshotImportTemplateUrl(base)` lifted to shared
    `hooks/snapshotImport.ts`; each group's hook wraps it with its base path + invalidation.
    `ImportSnapshotsDialog` now group-agnostic — props `{templateUrl, mutation, currency}` (parent
    owns the mutation, mirrors `CreateSnapshotDialog`); wired into all 5 detail pages, gated on
    active.
  - **Tests:** repo `TestLiabilityRepo_…` + `TestReceivableRepo_…` mirror the asset suite.
    Race-clean, lint 0, frontend green, main flat ~333 kB. Verified via curl for a fresh liability +
    receivable: stream, preview, commit insert, re-commit insert→update, final state 1 snapshot
    each; test positions deleted. Not yet: no Playwright spec; UI not agent-eyeballed. Remaining
    ~~investment shapes~~ **DONE** (below).
- **Snapshot importer extended to investments — all five subtypes (importer now complete across
  every group).** Investments fork into two snapshot shapes (the `investment_snapshot_shape` CHECK
  XOR): **quantity-price** (stock/mutual_fund/gold — `quantity` + `price_per_unit`, `amount` derived
  = qty×price) and **accrued-interest** (bond/time_deposit — total `amount` incl. accrued +
  `accrued_interest`).
  - **`snapshotimport` made shape-aware:** new `Shape` enum (`ShapeAmount`=iota=0,
    `ShapeQuantityPrice`, `ShapeAccruedInterest`); `Options.Shape` + `TemplateMeta.Shape` — **zero
    value is ShapeAmount, so the 3 existing flat-amount callers + 7 tests needed no change.**
    `ParsedRow` += `Quantity`/`PricePerUnit`/`AccruedInterest` pointers; `BuildTemplate`/`Parse`
    branch per shape (qty-price requires both cols + derives amount via exact `decimal.Mul`; accrued
    requires amount, blank `accrued_interest` → 0 non-nil so the CHECK passes). 9 unit tests now.
  - **Backend:** new `UpsertInvestmentSnapshot` (writes amount/qty/price/accrued); **reused
    `GetInvestmentByID`** for import meta (returns display_name + native_currency + **subtype** +
    ownership/404 — no new query). `InvestmentRepo.InvestmentImportMeta` +
    `ImportInvestmentSnapshots` with `ImportInvestmentSnapshotRow`; **validates every row's shape
    against the subtype up front** via `validateInvestmentSnapshotShape` (DB CHECK is the final
    backstop). HTTP `investments/import.go`: `shapeForSubtype(subtype)` picks the template/parse
    shape; routes folded into `/investments/{id}/snapshots`.
  - **Frontend stays shape-agnostic** (backend derives shape from subtype) —
    `useImportInvestmentSnapshots(id, listKey)` + `investmentImportTemplateUrl` (reusing shared
    `hooks/snapshotImport.ts`) + the same `ImportSnapshotsDialog` into all 5 investment detail
    pages, gated on active.
  - **Tests:** repo `TestInvestmentRepo_ImportInvestmentSnapshots` (qty-price stock + accrued bond:
    dry-run/commit/upsert/tenancy + persisted-shape assertions + wrong-shape-rejected →
    `ErrInvalidSnapshotShape`). Race-clean, lint 0, frontend green, main 333→335 kB. Verified via
    curl: stock persists `amount=850000`(=100×8500)/`qty=100`/`price=8500`/`accrued=null`; bond
    persists `amount=50250000`/`qty,price=null`/`accrued=250000`; both flip insert→update; smoke
    positions deleted. Not yet: no Playwright spec; UI not agent-eyeballed.
- **Backend coverage backfill — restored after M6 importer/lifecycle landed untested
  (post-importer).** The M6 work shipped HTTP handlers at **0%** (`import.go` in
  assets/liabilities/receivables/investments; `lifecycle.go` in liabilities/receivables — the
  assets/investments twins already covered), pulling the 4 position packages below their Phase-2c
  ~92% and the codecov metric to **75.7%**. Refilled mockless via the established harness:
  - per-package **`import_test.go`**: template-GET / preview-counts-no-write / commit insert→update
    reclassify / 422 bad-row all-or-nothing-no-write / invalid mode·id·file·non-xlsx, building the
    multipart `.xlsx` in-memory with `excelize` (qty-price for the investments stock case).
  - **`lifecycle_test.go`** for liabilities (`paid_off`) + receivables (`collected`) mirror the
    assets twin's biconditional / unknown-status / bad-date / bad-json / 404.
  - Repo: **`import_meta_test.go`** covers all four `*ImportMeta` (happy + unknown-id + cross-tenant
    → `ErrNotFound`) — they read 0% in repo's own profile because only cross-package handler tests
    hit them; **`monthly_reports_read_test.go`** covers `GetReport` (in/out-of-range) +
    `ReportingCurrency`; **`monthly_reports_engine_categories_test.go`** is a white-box (`package
    repo`) test hitting every `earnedIncomeAmounts.add` category + `investmentReturnAmounts.add`
    subtype arm.
  - **Numbers:** assets 77.5→**92.7**, liabilities 62.2→**92.5**, receivables 61.3→**93.0**,
    investments 79.1→**89.6**, repo 76.1→**78.9**; codecov 75.7→**83.7**. 9 new test files, zero
    production change; race-clean, `go vet` + golangci-lint 0.
  - **Ceiling unchanged:** the remaining repo sub-70% funcs are the `if err != nil` DB-error
    `fmt.Errorf` wraps + `currentUser`-err branches in `Get*`/`Update*`/`softDelete*` — need a
    fault-injecting pool, declined.
- **List-screen polish — bank-accounts tracer (M6, frontend-only).** First of a sweep across all 10
  list screens. Shipped on `BankAccountsScreen` + `BankAccountListRow`:
  1. **Latest balance right-aligned** + `tabular-nums`.
  2. **StatusBadge colour flip** — active → **green** (`bg-green-100/text-green-800`), every
     terminal status → **muted grey** (replaces the counterintuitive amber-terminal/grey-active
     scheme). 2-tier only; `written_off`→amber deferred. The badge is shared → all 10 detail pages
     inherit.
  3. **Terminated rows greyed** (`text-muted-foreground`, name de-bolded; still clickable).
  4. **Sortable headers** via new shared **`components/SortableHeader.tsx`** (real `<button>`,
     `aria-sort`, chevron, `align`, `testId`); client-side sort (unpaginated, small N), default
     **name asc**, balance defaults desc, **name is the tiebreaker**, no-snapshot rows always last.
  5. **Headline total** via new pure **`lib/totals.ts#activeCurrencyTotals`** (unit-tested, 6 cases)
     — **active-only** + **per-currency** (no FX — FX'd NW stays on the dashboard per ADR-0002);
     single-currency sees one figure, mixed sees `Rp … · $ …` largest-first + an active-account
     count.
  6. **Terminated hidden by default** — a right-aligned **"Show inactive accounts (N)"** checkbox
     appears only when N>0 (`data-testid="show-inactive"`); all-hidden shows an explanatory note not
     a blank table.
  - Refactor: **`ownerLabel` resolves once at the screen** (rows stopped each calling
    `useHouseholdMembers`); rows take it as a prop. `data-testid`s:
    `sort-{name,ownership,status,balance}`, `bank-accounts-total`, `show-inactive` (no Playwright
    spec yet). vitest **58** (`totals.test.ts` +6), main ~339 kB, `make e2e` **14 green**. **Two
    user-picked decisions:** mixed-currency total = per-currency subtotals (not FX, not hide); total
    = active-only.
- **List-screen polish rolled out to all 10 groups (M6) — sweep complete.** Applied the tracer to
  the other 9 (liabilities ×2 subtypes via one screen, receivables, properties, vehicles +
  stocks/mutual-funds/bonds/time-deposits/gold).
  - **Extracted shared infra during the rollout:** `lib/sort.ts` (`byText`, `byNumberNullsLast`
    direction-aware, nulls always last; unit-tested), `hooks/useTableSort.ts` (single-column state +
    toggle + memoized sorted; caller passes a memoized `columns` map + stable `tiebreak`),
    `components/ListHeadline.tsx` (per-currency active total; `label`/`noun`/`nounPlural`/`testId`),
    `components/ShowInactiveToggle.tsx`. `BankAccountsScreen` refactored onto these too → all 10
    share one implementation.
  - **Two list shapes:** the four **ownership groups** (liability/receivable/property/vehicle)
    mirror bank accounts — Name · Ownership · Status · Latest balance/valuation, all four sortable,
    ownerLabel resolved once. The five **investment groups** keep their subtype-identifier 2nd
    column (Ticker/Fund code/Identity/Identity/Form & purity) **non-sortable** in place of
    Ownership, sort Name/Status/value only, rows take no ownerLabel.
  - StatusBadge `group` per-screen; headline labels group-appropriate (Total balance / owed /
    outstanding / value); headline `testId`s `{group}-total`. The 5 investment rows patched
    uniformly (scripted, 1 match each); the 4 ownership rows + 10 screens rewritten. vitest **63**
    (`sort.test.ts` +5), main ~355 kB, `make e2e` **14 green** (all list-screen-touching specs still
    pass; row-name matching survives the new Status column + headline). No new sort/filter
    Playwright spec (`data-testid`s in place). UI not agent-eyeballed.

## What M4.2 shipped

Code lives where you'd expect from the M4.1 pattern. Specifics worth knowing:

**Backend**
- `backend/internal/migrations/00005_liabilities_receivables.sql` — 4 new tables. Liabilities carry 
the `subtype` enum (`personal` | `institutional`) and inline metadata (counterparty, principal, 
rate, term, dates). Receivables have no subtype, just counterparty + due_date. Both use the 
amount-shape snapshot table per ADR-0022.
- `backend/queries/{liabilities,liability_snapshots,receivables,receivable_snapshots}.sql` — full 
CRUD plus batch latest-snapshot joins for list views. Snapshot queries always JOIN the parent table 
with `household_id = $X` for belt+suspenders tenancy enforcement.
- `backend/internal/repo/{liabilities,receivables}.go` — `LiabilityRepo` and `ReceivableRepo` with 
full CRUD + snapshot CRUD. Each is its own struct; they do **not** share helpers with `AssetRepo` 
beyond the package-private `currentUser` helper.
- `backend/internal/{liabilities,receivables}/` — HTTP packages mounted under `/api/liabilities` 
and `/api/receivables`, each with `/{id}/snapshots/*` sub-routes.

**Frontend**
- Snapshot UI **lifted** to be group-agnostic. `CreateSnapshotDialog`, `EditSnapshotDialog`, and 
`SnapshotRow` accept `useMutation` results as props (`mutation`, `updateMutation`, 
`deleteMutation`) instead of calling group-specific hooks internally. **Each detail page now owns 
its own create/update/delete snapshot mutations and passes them down.** This is the key refactor 
that lets us avoid `LiabilitySnapshotRow` / `ReceivableSnapshotRow` duplication.
- `BankAccountChart` renamed to **`SnapshotChart`** and its prop type generalised to `{year_month: 
string; amount: string}[]`. All five detail pages share it.
- New hooks: `useLiabilities`, `useLiabilitySnapshots`, `useReceivables`, `useReceivableSnapshots`. 
Mutation `onSuccess` handlers invalidate both the list key (`['liabilities']` or `['receivables']`) 
and the snapshot key (`['liability-snapshots', id]` etc).
- Liabilities use **two-level nav** (Personal / Institutional inner tabs); Receivables is flat.

**Tests**
- `backend/internal/repo/{liabilities,receivables}_tenancy_test.go` — 9 subtests each. Covers core 
CRUD + snapshot CRUD across two households. All pass.

## What M4.3a backend shipped

- `backend/internal/migrations/00006_investments.sql` — `investments` + `stock_details` + 
`mutual_fund_details` + `gold_details` + `investment_snapshots`. Subtype enum carries all five 
values up front (bond/time_deposit reachable in M4.3b without an ALTER); status enum carries 
`active`/`sold`/`matured`. Snapshot table has the XOR CHECK from ADR-0022 plus a partial unique 
index on `(investment_id, year_month) WHERE deleted_at IS NULL`.
- `backend/queries/{investments,stocks,mutual_funds,golds,investment_snapshots}.sql` — full CRUD 
plus batch latest-snapshot joins and detail joins for list views. Snapshot queries JOIN 
`investments` to enforce tenancy.
- `backend/internal/repo/{investments,stocks,mutual_funds,golds}.go` — `InvestmentRepo` with 
per-subtype CRUD (txn-wrapped parent + detail writes), shared `softDeleteInvestment` helper, 
snapshot CRUD with `validateInvestmentSnapshotShape`. New `repo.ErrInvalidSnapshotShape` sentinel.
- `backend/internal/investments/*` — HTTP package mounted under `/api/investments`, with `/stocks`, 
`/mutual-funds`, `/golds` subtype CRUD and `/{id}/snapshots` snapshot CRUD. `repoErrorStatus` maps 
`ErrInvalidSnapshotShape` to 400.
- `backend/internal/repo/investments_tenancy_test.go` — covers cross-tenant rejection across all 
three subtypes, the subtype guard between them, snapshot tenancy, alice-side happy-path CRUD, and a 
separate `TestInvestmentRepo_SnapshotShapeValidation` exercising the repo's shape XOR.

## What M4.3a-frontend shipped

- `frontend/src/hooks/useInvestments.ts` — per-subtype CRUD (stocks / mutual-funds / golds) against 
`/api/investments/*`. Each subtype has its own list/detail/create/update/delete hooks; list queries 
cache under `['stocks']`, `['mutual-funds']`, `['golds']`.
- `frontend/src/hooks/useInvestmentSnapshots.ts` — shared snapshot CRUD at 
`/api/investments/{id}/snapshots`. The mutation hooks take a `listKey: 'stocks' | 'mutual-funds' | 
'golds'` so they can invalidate the right parent list when a snapshot changes (each list inlines 
`latest_snapshot`).
- `frontend/src/components/{Stocks,MutualFunds,Golds}Screen.tsx`, 
`{Stock,MutualFund,Gold}ListRow.tsx`, `Create{Stock,MutualFund,Gold}Dialog.tsx`, 
`Edit{Stock,MutualFund,Gold}Dialog.tsx` — list, row, and dialog set per subtype. Edit dialogs 
accept either the detail `Stock`/`MutualFund`/`Gold` aggregate or the list-row `*ListItem` so both 
call sites can reuse them.
- `frontend/src/components/{Stock,MutualFund,Gold}Detail.tsx` — detail pages mirror 
`LiabilityDetail`: own snapshot mutations, pass them as props to the snapshot dialogs/row, share 
`SnapshotChart`. Each detail page hardcodes its `quantityUnit` for the row ("sh" / "units" / "g").
- `frontend/src/components/CreateInvestmentSnapshotDialog.tsx` + `EditInvestmentSnapshotDialog.tsx` 
+ `InvestmentSnapshotRow.tsx` — **separate** from the amount-only 
`CreateSnapshotDialog`/`EditSnapshotDialog`/`SnapshotRow`. They take Quantity + Price-per-unit 
inputs and derive `amount = qty × price` client-side (shown as a preview, sent on the wire 
alongside the two factors). The backend's `validateInvestmentSnapshotShape` re-checks the 
subtype→shape mapping. This was a deliberate fork — see the convention note below.
- `frontend/src/lib/gold.ts` — `formatGoldPurity` helper that renders "24K (.999+)", "22K", "18K", 
or falls through to a percentage. Used in `GoldListRow` and `GoldDetail`.
- `frontend/src/api/types.ts` — added `Investment`, `InvestmentSnapshot`, 
`Stock`/`MutualFund`/`Gold` aggregates and `*ListItem` variants. `InvestmentSubtype` carries all 
five values for forward compatibility with M4.3b.
- `frontend/src/App.tsx` — Investments replaces the placeholder with a three-level nav (Group > 
Investments > {Stocks, Mutual Funds, Gold}). `Selection` union extended with `{kind: 
'stock'|'mutual_fund'|'gold', investmentId}`.
- Bundle size: ~840KB / ~228KB gzipped (was ~790KB before M4.3a-frontend; later code-split in the 
Recharts side quest, see below).

## What M4.3b backend shipped

- `backend/internal/migrations/00007_bonds_time_deposits.sql` — adds `bond_details` (bond_type enum 
`govt_primary|secondary_market`, issuer, face_value, coupon_rate, coupon_frequency enum 
`monthly|quarterly|semi_annual|annual` default monthly, maturity_date) and `time_deposit_details` 
(bank_name, principal, interest_rate, term_months, placement_date, maturity_date, rollover_policy 
enum `auto_renew_principal|auto_renew_with_interest|no_rollover`). No new indexes (deferred per the 
spec grilling — M4.2 precedent).
- `backend/queries/{bonds,time_deposits}.sql` — Create/Get/List-by-IDs/Update on each details 
table. No detail-table soft-delete; parent's `softDeleteInvestment` cascades.
- `backend/internal/repo/{bonds,time_deposits}.go` — `CreateBond` / `CreateTimeDeposit` 
(txn-wrapped parent + details), `Get/Update/Delete` with subtype guard mirroring stocks/golds. 
`validateInvestmentSnapshotShape` already covered `bond` and `time_deposit` since M4.3a; no change 
needed in `investments.go`.
- `backend/internal/investments/{bonds,time_deposits}.go` — HTTP handlers mounted under 
`/api/investments/bonds` and `/api/investments/time-deposits`. `maturity_date` / `placement_date` 
accepted as `YYYY-MM-DD` strings; Go-side `time.Parse` rather than relying on validator.
- `backend/internal/repo/investments_tenancy_test.go` — extended to five subtypes. New subtests 
cover bond/time_deposit list isolation, bob get/update/delete on each, subtype guard from bond → 
stock/time_deposit, alice happy-path update + delete on bond + TD. 
`TestInvestmentRepo_SnapshotShapeValidation` now exercises the accrued-interest XOR branch (missing 
accrued rejected, quantity+price rejected, accrued-only accepted).

## What M4.4 shipped

**Backend**
- `backend/internal/migrations/00010_investment_transactions.sql` — single 
`investment_transactions` table with a `transaction_type` enum and a CASE-driven CHECK enforcing 
type→shape (Buy/Sell need amount+quantity+price; Coupon/Dividend/Distribution need amount; Fee 
needs amount, optional paired quantity+price; Maturity needs principal+interest+both dispositions). 
Two indexes: `investment_id` and `(investment_id, transaction_date DESC)`.
- `backend/queries/investment_transactions.sql` — CRUD with `WITH owned_investment` parent-tenancy 
enforcement on Create; UPDATE/Get/List use the standard FROM-JOIN tenancy pattern. 
`transaction_type` is **not** in the UPDATE column list — immutable post-create (changing type 
would invalidate the shape).
- `backend/internal/repo/investment_transactions.go` — `CreateInvestmentTransaction` / 
`ListInvestmentTransactions` / `UpdateInvestmentTransaction` / `DeleteInvestmentTransaction` on 
`InvestmentRepo`. `validateInvestmentTransactionType(subtype, txnType)` enforces the per-subtype 
matrix; `validateInvestmentTransactionShape(p)` enforces the per-type field combo. `repo.TxnType*` 
constants and `repo.Disposition*` constants exported for cross-package use.
- `backend/internal/investments/transactions.go` + mount: routes at 
`/api/investments/{id}/transactions` (POST/GET on root, PATCH/DELETE on `{transactionID}`).
- `backend/internal/repo/investment_transactions_tenancy_test.go` — 17 subtests covering bob's 
rejection across List/Create/Update/Delete, the 4-direction subtype→type matrix (Coupon-on-Stock, 
Buy-on-TD, Maturity-on-Stock, Dividend-on-Bond), shape-rejection (Buy without quantity, Maturity 
without dispositions, Fee with qty but no price, Dividend with qty), and alice's happy-path 
List/Update/Delete + Maturity round-trip preserving dispositions.

**Frontend**
- `frontend/src/hooks/useInvestmentTransactions.ts` — list/create/update/delete hooks. No `listKey` 
(transactions aren't denormalized onto subtype list rows; if that changes later, take the 
snapshot-listKey pattern).
- Shape-forked dialog set: `Create/EditTradeTransactionDialog` (Buy + Sell — txnType prop fixes 
title and direction), `Create/EditCashIncomeTransactionDialog` (Coupon + Dividend + Distribution), 
`Create/EditFeeTransactionDialog`, `Create/EditMaturityTransactionDialog`. Trade dialog derives 
`cash = qty × price` client-side and ships all three on the wire (mirrors 
`CreateQuantityPriceSnapshotDialog`). Maturity defaults its two dispositions from an optional 
`rolloverPolicy` prop — TD passes it; Bond doesn't.
- `frontend/src/components/TransactionRow.tsx` — single row component that picks the right Edit 
dialog based on `transaction.transaction_type` (the backend endpoint is unified, so one 
updateMutation suffices). Renders a colour-coded Cash impact column (Buy/Fee out → destructive, 
Sell/Coupon/Dividend/Distribution in → emerald, Maturity → emerald cash-out portions, "rolled" when 
both portions roll). Subline under Type shows shape-specific details (qty×price, P/I + disposition 
badges, etc.).
- `frontend/src/lib/reconciliation.ts` — `reconcileQuantity(latestSnapshot, transactions)` returns 
`{ expected, actual, matches }` for Stock/MF/Gold detail pages. Display-only soft warning; not 
enforced.
- All 5 detail pages 
(`StockDetail`/`MutualFundDetail`/`BondDetail`/`GoldDetail`/`TimeDepositDetail`) gained a 
Transactions Card below Snapshots, with subtype-appropriate "+ Type" buttons, a separate 
transaction-page state (PAGE_SIZE = 12, same as snapshots), and a row layout (Date / Type / Cash 
impact / Notes / Actions).

## M4.4 design decisions (settled during the pre-implementation grilling)

The architectural core of these is captured in **ADR-0023** (investment
transaction table strategy: single polymorphic table, type→shape CHECK,
subtype→type matrix in the repo). The tactical decisions below sit on
top of that ADR.


1. **Single polymorphic `investment_transactions` table** with type enum + nullable per-shape 
columns + DB-level CHECK on type→shape (mirrors `investment_snapshots` per ADR-0022). Per-type 
tables were rejected — chronological "all transactions for instrument X" queries are natural in one 
table; cross-type sqlc queries would be 7-way UNIONs.
2. **TimeDeposit gets Maturity only.** Initial placement lives in `time_deposit_details.principal` 
via the Create dialog; no redundant "Buy" placement transaction. Bond gets the full set (Buy + Sell 
+ Coupon + Fee + Maturity) because secondary-market trades exist.
3. **Bond face_value stays as total** (not per-lot). Deepening to lots was deferred — current 
schema is sufficient for snapshot-shape tracking; revisit if a real reconciliation need surfaces.
4. **Reconciliation is display-only.** A snapshot quantity that disagrees with `Σ(Buys.qty) − 
Σ(Sells.qty) − Σ(Fees.qty_deducted)` shows a soft amber warning on the detail page. Statements 
remain the source of truth (ADR-0003 philosophy). No write-time block.
5. **transaction_type is immutable post-create.** Changing it would invalidate the shape; users 
delete + re-create instead.
6. **One Trade/CashIncome dialog handles multiple types via a `txnType` prop** rather than 
splitting Buy/Sell or Coupon/Dividend/Distribution into separate files. Fields are identical within 
shape; the title/verb pivots on the prop. Honours "name by shape, not by group" by analogy.
7. **Maturity's `rolloverPolicy` prop is optional** — TD passes it (defaults dispositions from the 
bank's configured policy), Bond doesn't (no policy, defaults to both cash-out).

## What M4.3b-frontend shipped

- **Snapshot dialog set rename + fork**: existing `CreateInvestmentSnapshotDialog` / 
`EditInvestmentSnapshotDialog` / `InvestmentSnapshotRow` renamed to `*QuantityPriceSnapshot*` to 
make the convention "name by shape, not by group" uniform. New 
`Create/EditAccruedInterestSnapshotDialog` + `AccruedInterestSnapshotRow` trio carries the 
accrued-interest shape — Total value + Accrued inputs, with derived "Of which principal" helper 
line. Bond/TD detail pages own their snapshot mutations and pass them in as props, same pattern as 
M4.3a-frontend.
- **Bond UI** (`BondsScreen`, `BondListRow`, `BondDetail`, `Create/EditBondDialog`): list row shows 
`series_code` (mono, line 1) + `<bond_type> · <issuer> · <coupon_rate>% <coupon_frequency>` (line 
2) + maturity styled by urgency (line 3). 4-tier urgency in `lib/maturity.ts`: default (muted), 
approaching (≤90d, bold), imminent (≤30d, bold + amber, countdown format), matured (muted + ⚠ 
prefix).
- **TimeDeposit UI** (`TimeDepositsScreen`, `TimeDepositListRow`, `TimeDepositDetail`, 
`Create/EditTimeDepositDialog`): list row shows bank_name + rate·term + maturity. Create dialog 
auto-derives `maturity_date` from `placement_date + term_months` whenever either changes; user can 
override (banks sometimes nudge for holidays). Rollover-policy picker has a one-line helper caption.
- **Pre-M4.3b-frontend migration prep**:
  - `migrations/00008_rates_to_percent.sql` — `UPDATE` rates × 100 in 5 columns 
(`liabilities.interest_rate`, `property_details.annual_amortization_rate`, 
`vehicle_details.annual_depreciation_rate`, `bond_details.coupon_rate`, 
`time_deposit_details.interest_rate`). Frontend create/edit forms type `5.5` for "5.5%", no 
client-side scaling.
  - `migrations/00009_bond_series_code.sql` — `bond_details.series_code` (nullable TEXT). 
Required-vs-optional decision: nullable because corporate bonds without a published code exist. 
Stock.ticker is required (exchanges always have one); bond series codes are softer.
- **App.tsx nav**: `InvestmentSubtypeNav` extended to 5 values; tab order **Stocks → Mutual Funds → 
Bonds → Time Deposits → Gold** (equities → funds → fixed-income pair → physical); Selection union 
extended with `bond` + `time_deposit` variants.

## M4.3 design decisions (settled during the grilling round)

1. **Snapshot routes are per-group**: `/api/investments/{id}/snapshots`. Mirrors ADR-0022 and the 
M4.2 pattern.
2. **Subtypes shipped in two batches** to validate each snapshot shape independently:
   - M4.3a = Stock + MutualFund + Gold (quantity+price shape) — **done**
   - M4.3b = Bond + TimeDeposit (accrued-interest shape) — **done** (backend + frontend)
3. **XOR shape integrity is two-layer**: DB CHECK rejects rows that satisfy no shape or both; the 
repo's `validateInvestmentSnapshotShape(subtype, ...)` rejects rows that pick the wrong shape for 
their parent's subtype (Postgres CHECK can't reference another table). Returns 
`repo.ErrInvalidSnapshotShape`, mapped to 400 in handlers.
4. **Transactions stay out of M4.3** — deferred to M4.4 
(Buy/Sell/Coupon/Dividend/Distribution/Fee/Maturity).
5. **Three-level nav** (Investments > {subtype}) is acceptable for M4.3-frontend; React Router 
migration still flagged for M4.9.
6. **Snapshot `amount` is dirty for the accrued-interest shape** — for Bond/TimeDeposit, `amount` 
is the total position value (already includes accrued interest); `accrued_interest` is a 
*breakdown* column for income-tracking visibility and is never additive at aggregation time. 
Documented in ADR-0022 and CONTEXT.md (the Snapshot definition).
7. **Floating-rate bonds (SBR, ST) use a plain `coupon_rate` field** — the user edits it on each 
rate reset. No structured rate_type / spread / base model; KISS, defer until UI needs filtering or 
display badges.
8. **Early TimeDeposit withdrawal folds into the `sold` status** — `sold` is the generic "fully 
exited before scheduled term" outcome per CONTEXT.md; the frontend renders a subtype-aware label 
("Withdrawn early" for TD).



## Deferred backlog — full original detail at relocation (includes since-resolved items)

- Property/vehicle amortization-rate UI helper (Q8a)
- Fee cash→quantity helper (Q12, lands in M4.6 with Transactions)
- TimeDeposit "duplicate matured TD" helper (Q14c-iv, M4.6)
- ~~Side-by-side multi-currency dashboard view (Q15c, M5)~~ **DONE** — headline-only `≈` 
projection; see the "M5 COMPLETE" entry above
- React Router migration (M4.9)
- ~~Settings/Household page that holds the invite form~~ **invite form moved DONE**: `<InviteForm 
/>` now lives in `SettingsScreen` (was rendered globally outside the Tabs at the bottom of *every* 
tab — the "bank-accounts tab" framing was stale; it showed everywhere). Pure relocation, no API 
change; Settings subtitle broadened to mention household invitations. **`users.nickname` DONE 
(M6):** migration `00015_user_nickname` adds `nickname TEXT` (nullable, `CHECK len BETWEEN 1 AND 
32`); the app stores NULL (never `''`) when cleared. Self-attributed via `PATCH /api/me` 
(`handleUpdateMe`: trims, blank→NULL, >32 chars→400) — `display_name` stays Google-sourced + the 
API/reports source of truth; `nickname` rides alongside it on `/me` + `/household/members`. 
Frontend: `lib/names.ts#preferredName(nickname ?? display_name)` (blank-guarded) is the single 
resolution point — `ownershipLabel` calls it (so all 5 list rows + 10 detail pages + `IncomeRow` 
get it free), plus a **full picker sweep**: all 22 sole-owner `<select>`s (10 Create + 10 Edit 
position dialogs + Create/EditIncome) and `DashboardScreen` by-person labels now render 
`preferredName(m)`; the "(you)" suffix logic is unchanged. Edit UI is a "Your name" card on 
`SettingsScreen` (`useUpdateMe` invalidates `['session']` + `['household-members']`). Tests: 
backend `TestHandleUpdateMe` 
(set/trim/clear-via-empty/clear-via-whitespace/32-ok/33→400/bad-json/401) + nickname assertion in 
the `/me` test; vitest `names.test.ts` (5) + `ownership.test.ts` nickname cases (52 total). Backend 
suite + golangci-lint clean; frontend lint+tsc+build clean. **Not e2e-smoke-tested** (no Playwright 
spec added; Google-OAuth-only — eyeball the Settings card + an owner picker on the dev server).
- **Per-bond `coupon_disposition` field** (escalation path): the M4.3b-frontend follow-up shipped a 
global `accrued=0` default in `CreateAccruedInterestSnapshotDialog` plus copy explaining the 
override path. If users find themselves repeatedly overriding (e.g. mostly secondary-market bond 
holders) or repeatedly forgetting to override, escalate to a per-bond enum `coupon_disposition: 
'pays_out' | 'accrues'` on `bond_details` and pivot the form on that field. Currently no signal 
that we need it.
- **Bond lots/quantity modeling**: M4.4 settled this as defer — Buy/Sell bond transactions carry 
`quantity` (lot-style) + `price_per_unit`, but `bond_details.face_value` remains a user-edited 
total with no enforced reconciliation against the transaction ledger. Will revisit only if real 
usage shows the disconnect is confusing.
- **Snapshot future-date validation**: `year_month` and `as_of_date` on the create/update snapshot 
endpoints currently accept any date, including future ones. A snapshot is by definition a past 
observation, so a snapshot with `year_month > current month` or `as_of_date > today` is nonsense. 
Scope: 5 create + 5 update handlers (asset, liability, receivable, investment quantity-price, 
investment accrued-interest), matching `max` attributes on the frontend date/month inputs, and 
400-path tests. Application-layer validation only — existing rows (including the post-May-2026 
BankAccount test snapshots inserted during the PaginationControls smoke test) are grandfathered. 
**Apply the same to transaction_date on the M4.4 transactions endpoints** (5 transaction shapes 
share one endpoint, so just one create + one update path to guard).
- **TimeDeposit "duplicate matured TD" helper**: when a Maturity transaction has 
`principal_disposition = 'rolled_to_new'`, a fresh TD position must exist to receive the rolled 
amount. Currently the user creates the new TD manually. ROADMAP M6 + HANDOFF Q14c-iv flagged a 
"duplicate this TD" helper that pre-fills a Create TD dialog from the matured row's details with 
`placement_date = maturity_date` and `principal = old.principal + rolled_interest`. Defer until 
M4.6 polish — the manual path is workable.
- **Transaction-list aggregations**: no "transactions count" or "last transaction date" surfaced on 
the subtype list rows yet. Would add a column to `*ListItem` aggregates and a sqlc query. If/when 
it lands, take the snapshot `listKey` pattern in `useInvestmentTransactions` for invalidation.
- **Gold purity input UX**: free-text decimal works (`formatGoldPurity` renders "24K (.999+)", 
"22K", etc. correctly) but typing `0.999` for 24K is awkward. Carat picker considered and deferred 
— design constraint is *"must distinguish 24K (.999) from Antam bar (.9999) without sub-percent 
precision loss"*. Possible shape: `<select>` with 24K, 22K, 20K, 18K, 14K, 10K, **Custom** where 
24K maps to `0.9999`.
- **Path-filtered CI**: `.github/workflows/ci.yml` currently runs all three jobs (backend-lint / 
backend-test / frontend-checks) on every push and PR, including doc-only changes (`docs/**`, 
`*.md`, ADRs, HANDOFF). Add `paths:` filters so backend jobs run only on `backend/**` changes and 
frontend job runs only on `frontend/**`. **Cross-cutting files must trigger both**: 
`.github/workflows/ci.yml`, `Makefile`, `codecov.yml`, `.golangci.yml`, root configs. 
**Required-check gotcha**: if branch protection is ever enabled requiring these jobs, a skipped job 
blocks merges (GitHub treats skipped ≠ success). Fix is a `ci-gate` aggregator job with `if: 
always()` that depends on the three, succeeds when each is success-or-skipped, and is the only 
required check. No branch protection today, so low risk now — but structure with the aggregator 
from day one to avoid retrofitting. Codecov caveat: `fail_ci_if_error: true` is fine when backend 
job skips (no run = no missing-report complaint), but if a Codecov status check is later wired into 
branch protection, same skipped-≠-success problem applies.

- ~~**Frontend unit tests (vitest) + Codecov frontend flag**~~ **DONE** — Vitest 4.1.7 + 
`@vitest/coverage-v8`, standalone `vitest.config.ts` (coverage scoped to `src/lib/**`), CI runs 
`npm run test:coverage` and uploads `frontend/coverage/lcov.info` with `flags: frontend`. All pure 
`lib/*` helpers now covered (`reconciliation`, `ownership`, `maturity`, `lifecycle`, `gold`, 
`format`), 36 tests, `src/lib` ~98% stmt / 100% branch. Only `utils.ts` (`cn`) skipped as 
boilerplate. **Still not added** (deferred to when component tests begin, per ADR-0021): RTL + MSW 
+ jsdom. **Do not** add Playwright/E2E to the coverage metric — it's a behavioural net, not a 
coverage instrument.

