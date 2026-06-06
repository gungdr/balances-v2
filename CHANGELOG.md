# Changelog — milestone history

The **historical record** of balances-v2: the blow-by-blow of what each milestone shipped, plus the
design decisions settled during each grilling round. Split out of `HANDOFF.md` on 2026-05-29 so the
handoff doc could stay a thin live-state pointer.

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
      investment → 409. Guard order: type → shape → active-check (structurally-invalid still get
      their 400).
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
- **Google profile picture in the header (M6, full stack).** A `UserAvatar` shows the user's Google
  account photo next to their name in `AppShell`.
  - **Backend:** `googleClaims` reads the OIDC `picture` claim; migration `00016_user_picture_url`
    adds `users.picture_url` (nullable). Stored on user create and refreshed on login when changed
    (`SetUserPicture`), so rows created before the column backfill on next sign-in and later photo
    changes track. `updated_by` left untouched (system sync, not a user edit). `/me` gains
    `picture_url`; `/household/members` is unchanged (the header needs only the current user).
  - **Frontend:** `UserAvatar` — rounded square, `bg-muted` initials fallback via new
    `lib/names.ts#initials`, `referrerPolicy="no-referrer"` so Google's `lh3` URLs don't 403, and a
    failed-src state (not a bool) so a changed URL re-attempts without an effect. `Me` type gains
    `picture_url`.
  - **Tests:** callback create + existing-user backfill + `/me` nil/set mapping (backend race-clean,
    golangci-lint 0); `names.test.ts` +5 `initials` cases → vitest **68**; lint + build clean. UI not
    agent-eyeballed and no Playwright spec — Google-OAuth-only, picture backfills on next sign-in.
- **React Router migration + sidebar nav shell (M6, frontend-only — ADR-0025).** Delivered the M4.9
  backlog item and fixed the mobile tab overflow in one pass.
  - **Routing:** `react-router` v7. `App.tsx` went from a ~300-line nested-`Tabs` state machine (four
    selection-state hooks + a hand-rolled detail overlay) to a `createBrowserRouter` config behind an
    auth gate. URLs mirror the domain hierarchy: `/assets/bank-accounts/:id`,
    `/liabilities/personal/:id` (detail **nested under subtype** so the dynamic `:id` never overlaps
    the literal subtype segments), `/investments/{stocks,mutual-funds,bonds,time-deposits,gold}[/:id]`,
    flat `/receivables[/:id]` + `/income`, `/settings`, and a `*` → dashboard catch-all.
  - **Screens untouched.** The ~20 list/detail components kept their `onSelect(id)`/`onBack()`/id-prop
    contract; two thin wrappers (`ListRoute`, `DetailRoute`) bridge it to `useNavigate`/`useParams`,
    so the router lives only in `App.tsx`.
  - **`src/lib/routes.ts`** — centralised path constants + builders (`routes.bankAccount(id)`), the
    link-safety stand-in for TanStack Router's compile-time checks. Why React Router over TanStack:
    stability + docs + the named plan; see ADR-0025.
  - **Nav shell:** `shadcn add sidebar` (sidebar/sheet/tooltip/separator/skeleton + `use-mobile`).
    `AppShell` = `SidebarProvider` + data-driven `AppSidebar` + `SidebarInset` with the page in an
    `<Outlet/>` — persistent sidebar on desktop, drawer on phones; subtype sub-items always expanded;
    active state by path prefix. Avatar + sign-out stay in the header. `use-mobile` rewritten with
    `useSyncExternalStore` to satisfy `react-hooks/set-state-in-effect`.
  - **Group home placeholders:** `AssetsHome`/`LiabilitiesHome`/`InvestmentsHome` (subtyped groups
    only) — stubs for the future per-group dashboards, reachable at `/assets`, `/liabilities`,
    `/investments`.
  - **Tests:** all 14 Playwright specs reworked to `goto('/path')` for entry + persistent sidebar
    `link` clicks for no-reload mid-test nav (preserving `rebuild.spec`'s client-side `['reports']`
    invalidation intent); stale "no router / in-state nav" comments fixed. lint + build + vitest
    (**68**) + e2e (**14**) all green. Sidebar visual/mobile-drawer not yet agent-eyeballed.
- **Snapshot/transaction future-date validation (M6, full stack).** Closes the deferred-backlog
  item: snapshots are past observations; `year_month > current month` or `as_of_date > today UTC`
  is nonsense. Same goes for `transaction_date` on the M4.4 transactions endpoints.
  - **Backend:** 5 create + 5 update snapshot handlers (asset, liability, receivable, investment
    quantity-price, investment accrued-interest) + 1 create + 1 update transaction handler reject
    future dates with 400. Handlers gained an injectable `now` clock via a `WithNow` option so
    tests can pin a fixed future date without monkey-patching `time.Now`. Application-layer
    validation only — existing rows (including the May-2026 BankAccount test snapshots) are
    grandfathered.
  - **Frontend:** `lib/dateLimits.ts` (`thisYearMonth()` + `todayDate()`) drives a matching `max`
    attribute on every snapshot/transaction month + date input; the helpers are unit-tested so
    the wired values can't drift from the backend's clock semantics.
- **Income `regularity` flag (M6, full stack).** Per-row classification: `routine` (monthly
  salary, regular allowance) or `incidental` (bonus, gift, capital gain). Drives no math today
  but readies the income-statement view to split predictable from one-off income.
  - **Backend:** migration `00017_income_regularity` adds `regularity TEXT NOT NULL` (CHECK
    `routine|incidental`); validator `oneof=routine incidental` on both `createReq` + `updateReq`;
    existing rows backfilled to `routine` (matches the salary-dominant case).
  - **Frontend:** `IncomeRegularity` union + label map; CreateIncomeDialog defaults to `routine`,
    EditIncomeDialog pre-fills from the row. List rows render a Lucide icon next to the category
    chip — `Repeat` for routine, `Sparkles` for incidental — and a chip-bar filter at the top of
    the screen toggles between All / Routine / Incidental. `income.spec.ts` untouched.
- **`investments.risk_profile` flag (M6, full stack).** One classification covering all 5
  investment subtypes — lives on the shared `investments` table (per the ADR-0022 principle:
  uniform-across-subtypes data sits on the parent row). Drives a list-row shield badge + a
  per-subtype chip-bar filter; powers no math yet.
  - **Backend:** migration `00018_investments_risk_profile` adds `risk_profile TEXT NOT NULL`
    (CHECK `low|medium|high`); existing rows backfilled to `medium` as a neutral starting point.
    `oneof` validator on both `createReq` + `updateReq`.
  - **Frontend:** Create dialog forces a manual choice with **no default** — the friction is the
    point, so users actually think about it; Edit pre-fills from the row. Shared
    `RiskProfileBadge` (shield icon + colour: `Shield` low + emerald, `ShieldHalf` medium +
    amber, `ShieldAlert` high + rose) renders next to the display name on every investment list
    row. Shared `RiskProfileFilter` chip bar at the top of each of the 5 subtype list screens.
- **E2E smoke coverage for the nickname + Google-picture features (M6, e2e).** Closes the
  deferred "Not e2e-smoke-tested" note that landed with the nickname + picture shipments. Both
  paths are Google-OAuth-only, so they need the mock-OIDC harness (ADR-0024).
  - **mock-oidc** now mints a `picture` claim in the id_token (pointing at
    `http://localhost:8090/avatar.png`, served as a 1×1 PNG by mock-oidc itself), so the real
    OAuth callback runs `SetUserPicture` and backfills `users.picture_url` for the seeded Alice.
  - **`picture.spec.ts`** uses `test.use({ storageState: empty })` to start unauthenticated,
    clicks Sign in with Google, drives the redirect chain through mock-oidc, asserts
    `user-avatar-img` is visible with the right `src` and the `user-avatar-fallback` is gone —
    the one path session-injection (`auth.spec.ts`) cannot cover.
  - **`nickname.spec.ts`** uses the injected session, `goto('/settings')`, sets nickname `Ally`,
    saves, reloads, asserts persistence; clears, saves, reloads, asserts blank — self-cleaning so
    downstream ownership-label assertions see the seed's NULL state.
  - Full e2e count: **16 green**.
- **Property/vehicle revaluation-rate UI helper (Q8a) — and a taxonomy fix (M6, full stack).**
  Property's `annual_amortization_rate` was wrong twice over: amortization is for *intangibles*
  (patents, goodwill), and tangible property typically *appreciates* rather than declines.
  Migration `00019_property_appreciation_rate` renames the column to `annual_appreciation_rate`,
  NULLs existing dev data (pre-alpha; forces clean re-entry with the correct sign), and leaves
  the column unsigned-constraint-free so HGB-leasehold apartments can enter negative rates for
  the decliner case. Vehicle keeps `annual_depreciation_rate` — that term is semantically
  correct.
  - **Helper:** `lib/revaluation.ts#suggestRevalued` projects `prev × (1 + rate/100)^(months/12)`
    with a *signed* rate. Positive grows, negative declines, zero/null returns no suggestion.
    Picks the latest snapshot strictly before the picked month as the anchor. Pure JS — the
    backend computes nothing from this; it's a display suggestion the user can override. 12
    vitest cases cover partial year, full year, multi-year compound, anchor selection, ISO
    datetime input, and every null path.
  - **Wiring:** `CreateSnapshotDialog` takes an optional `suggest` callback so the bank /
    liability / receivable consumers stay untouched. `PropertyDetail` passes its
    `annual_appreciation_rate` as-stored; `VehicleDetail` negates its positive-only
    `annual_depreciation_rate` at the callsite so the same helper serves both directions.
  - **Hint UX:** under the amount field, an inline `💡 Suggested <currency-formatted> — based on
    +X% /yr × N mo from <Month YYYY>` with an explicit Apply button. **Never auto-prefills** — a
    typed value is always preserved. Apply pastes the suggestion at the currency's display
    precision (0 dp for IDR/JPY/KRW/VND, 2 dp elsewhere) via `lib/format.ts#roundToCurrency`,
    not the raw 4dp arithmetic result. Sign-aware label uses "+" for appreciation and the real
    minus glyph "−" for decline.
  - **Display:** `lib/format.ts#formatSignedPercent` renders the rate on `PropertyDetail` with
    a leading "+/−" so the direction is visible at a glance.
  - **ADR-0009 updated** to reflect the rename + signed semantics.
- **Dashboard month picker (M6, frontend-only).** The dashboard header's month selector was a flat
  `<select>` listing every materialized report newest-first. At 10 years of history that's 120+
  options, unscannable for the non-technical audience, and the dropdown overflowed the viewport on
  phones. Replaced with a shadcn-style popover.
  - **Wrapper:** `components/ui/popover.tsx` — first popover in the codebase, standard shadcn shape
    around `radix-ui`'s `Popover` umbrella import (already a transitive dep via shadcn).
  - **Component:** `components/MonthPickerPopover.tsx`. Trigger is an `outline` Button showing
    `formatYearMonth(selected.year_month)` + a chevron. Popover content has a year header (`‹`
    label `›`) clamped to `[minYear, maxYear]` derived from the reports list, plus a 4×3 month
    grid. Cells without a corresponding report are disabled and dimmed; the selected cell uses
    `variant="default"` so it reads as filled. Click on an enabled cell fires `onSelect` with the
    **exact stored ISO** of the matched report (via an `isoByKey` map) — safer than
    re-synthesising `YYYY-MM-01T00:00:00Z` if the backend ever changes the day/time component.
    `viewYear` resets to `selectedYear` on each `onOpenChange(true)` so re-opening always lands
    on the current selection, not whatever year was last browsed. Date math uses `getUTCFullYear`
    / `getUTCMonth` so the `Z` timestamp never rolls a month in non-UTC locales.
  - **Wiring:** `DashboardScreen.DashboardHeader` swapped the inline `<select>` for the new
    component; the parent's `(yearMonth) => setSelectedMonth(yearMonth)` contract is unchanged.
  - **Test ids:** `month-picker-trigger`, `month-picker-content`,
    `month-picker-year-prev|next|label`, `month-picker-cell-YYYY-MM`. No spec drove the old
    select, so no spec edits were required; the ids are in place for a future
    `month-picker.spec.ts`.
  - Lint + build + vitest (91/91) + Playwright (16/16) all green.
- **Indonesian glossary doc (M6, docs-only — issue #4).** Authored `docs/glossary-id.md`, the
  canonical EN↔ID dictionary for ~50 terms across position groups, subtypes, ledger nouns,
  lifecycle, money/accounting, time/dates, auth/household, risk/regularity, income categories,
  actions/chrome, and errors. Pins decisions before the per-feature extraction issues (#5–#11)
  start translating, so consistency drift (`Liabilitas` vs `Kewajiban`, `Bunga Berjalan` vs `Bunga
  Akrual`) doesn't need a sweep later.
  - **Deliberate divergence from CONTEXT.md's _Avoid_ list:** Bond → **Obligasi** in ID UI. The
    CONTEXT avoid applied to English code/UI (Bond stays canonical there); Obligasi is the
    standard Indonesian finance term and the right ID translation. Glossary calls this out
    explicitly so future agents don't "fix" it back.
  - **Avoid-pair calls:** Amount → **Nominal** and Quantity → **Jumlah** are deliberately kept
    distinct so the two don't collide on a single screen (Snapshot dialogs especially).
    Sole-ownership → **Tunggal**, not **Pribadi**, to avoid overloading with the Personal-liability
    subtype.
  - **Cross-refs:** HANDOFF gets a glossary-pointer convention bullet ("Indonesian copy follows
    `docs/glossary-id.md`; extend in the same PR that adds a new term") + the M6-shipped list
    bullet. ADR-0026 now links the glossary file path.
- **Chrome i18n extraction (M6, full stack — issue #5).** First extraction slice; establishes the
  per-screen pattern the rest of #6–#11 will copy. Touched 7 components + 6 catalog files; ~50
  string sites moved into the `common` / `nav` / `settings` namespaces.
  - **Components:** `AppShell` (`Sign out`, brand), `AppSidebar` (NAV labels — array carries
    `labelKey` instead of literal text), `SignInScreen` (tagline + CTA), `SettingsScreen` (title
    + subtitle + Currency, Nickname, Language, FX cards), `InviteForm` (folded into the chrome
    sweep because it mounts from Settings and a mixed-language card would be a UX bug),
    `ConfirmDialog` (default `Confirm` / `Cancel` / `Working…` labels resolved via i18n so call
    sites that don't override them still translate), `AssetsHome` / `LiabilitiesHome` /
    `InvestmentsHome` placeholders.
  - **Catalogs:** `public/locales/{en,id}/{common,nav,settings}.json` populated against the
    glossary from #4. Sole = **Tunggal**, Personal-subtype = **Pribadi** (the two coexist
    cleanly because they appear in different contexts — Liabilities subtype vs ownership picker).
    Bond → **Obligasi** in `nav.bonds` per the glossary's deliberate divergence.
  - **`errText` / `formatError` helpers refactored** to accept the localized fallback as a
    parameter so the function stays English-only at the helper level and the caller passes
    `t('common:somethingWentWrong')`. Server-error bodies still display in the local copy
    pending the ADR-0027 error-code envelope; only the no-body fallback routes through i18n now.
  - **Bundled-resource init (not `i18next-http-backend`).** The first attempt followed
    ADR-0026's original draft (HttpBackend + `loadPath: '/locales/{{lng}}/{{ns}}.json'` with
    `load: 'languageOnly'` + `supportedLngs: ['en-GB', 'id-ID']`). The HTTP fetches never fired
    and the resource store stayed empty. **Root cause:** `load: 'languageOnly'` stripped the
    detected `id-ID` to `id`; i18next then rejected `id` because it wasn't in `supportedLngs`
    and `nonExplicitSupportedLngs` defaults to false — so no language resolved and no fetch
    was issued. Initially mis-diagnosed as an ESM-interop quirk with i18next-http-backend v4;
    the real bug was the language-tag mismatch. (See the "Considered alternatives" tail of
    ADR-0026 for the bundled-vs-HttpBackend trade-off after the bug was understood.)
  - **Why we still moved to bundled resources after fixing the bug:** at our scale (single
    household app, EN+ID expected lifetime, ~30 KB total catalogs) bundled wins on simplicity:
    sync first paint with no Suspense boundary or deferred mount, build-time TS validation of
    imports, no runtime HTTP request for catalogs. Trade-off accepted: adding a new language
    requires a small `i18n/index.ts` edit (10 imports + a `resources` map row), not just
    dropping a JSON file — ADR-0026's "JSON-only" line softened to match. Lazy-loading wins
    don't apply until we have 5+ languages or much heavier catalogs.
  - **Mechanical changes from the swap:**
    - Resource bundles keyed by full BCP47 (`'en-GB'` / `'id-ID'`) to match `supportedLngs`;
      `load: 'languageOnly'` dropped (no longer needed without an HTTP path to map).
    - `main.tsx` no longer defers `createRoot` behind an `i18nReady` promise — resources are
      present synchronously on first paint.
    - `i18next-http-backend` dependency uninstalled (`npm uninstall`).
    - Catalog files moved from `public/locales/` to `src/locales/` because vite warns when
      assets in `public/` are imported from JS (`public/` is for runtime URL fetches; bundled
      assets belong in `src/`). The 2-letter directory names (`en/`, `id/`) stay.
    - ADR-0026 updated to record the swap and the trade-off.
  - **Code-token allowlist:** the two FX-card placeholders (`'USD'`, `'16000'`) stay literal,
    wrapped as `placeholder={'USD'}` JSXExpressionContainers with a comment that they're data,
    not translatable copy. The ESLint rule (selector-based, hits Literal under
    JSXAttribute) leaves expressions alone.
  - Lint 1213 → 1165 warnings (48 chrome-files cleared, scope files now clean). Build green,
    vitest 13/13 (127/127). Playwright run pending final commit.
- **Dashboard i18n extraction (M6, frontend-only — issue #6).** Second extraction slice. Files:
  `DashboardScreen` (~590 lines, 9 sub-components), `MonthPickerPopover`, and the shared
  `SnapshotChartImpl` legend. New `dashboard` namespace populated EN+ID; short month names
  added to `common.months.*` (Jan/Feb/…/Dec EN, Jan/Feb/Mar/Apr/Mei/Jun/Jul/Agu/Sep/Okt/Nov/Des
  ID).
  - **Pluralisation:** `dashboard.headline.stalePositions` and `dashboard.missingFx.positions`
    /`addRate` use i18next's `_one`/`_other` suffixes so the count-bearing sentence reads
    naturally in either locale. Indonesian's plural is unmarked so both forms are
    intentionally identical there — the suffix shape is still required by i18next.
  - **GroupBreakdown rows now carry `labelKey`**, not literal strings; mirrors the
    `AppSidebar` NAV pattern.
  - **`SnapshotChartImpl.chartConfig` moved inside the component** so the recharts legend label
    picks up the active locale (it was a top-level constant). The shared chart stays a single
    component — no per-group fork — per the HANDOFF convention.
  - **`personLabel()` takes a `TFunction` argument** so it stays a plain function (no hook
    inside an arbitrary helper) while still translating "Joint" / "Unknown" / "(you)".
  - **Decorative glyphs left literal but wrapped:** `·`, `≈`, `ⓘ` are typographic tokens, not
    translatable copy, so they sit in JSXExpressionContainers (`{'·'}`, `{'≈ '}`, `{'ⓘ'}`)
    with a single explanatory comment. The ESLint rule's Literal-under-JSXAttribute /
    JSXText-with-non-whitespace selectors leave expressions alone, matching the
    code-token allowlist used in #5's FX placeholders.
  - **No `data-testid` changes**, no public-API changes; `MonthPickerPopover.MONTH_LABELS`
    became `MONTH_KEYS` (`jan`…`dec` indexing into `common.months`).
  - Lint 1166 → 1127 (39 dashboard-files cleared). Build green, vitest 13/13 (127/127).
- **Bank-accounts i18n extraction (M6, frontend-only — issue #7).** Third extraction slice and the
  **template** the four remaining group extractions (#8 properties/vehicles, #9 liabilities/
  receivables, #10 investments, #11 income) will copy. Touched 9 components + 2 helpers + 4 catalog
  files; ~130 string sites moved into `common` / `assets` / `errors`.
  - **Components:** `BankAccountsScreen` (carries the new pattern doc block at file top),
    `BankAccountDetail`, `BankAccountListRow`, `Create/EditBankAccountDialog`. Shared
    amount-shape dialogs extracted in the same slice and reused as-is by #8/#9:
    `Create/EditSnapshotDialog`, `SnapshotRow`, `ImportSnapshotsDialog`, `TerminatePositionDialog`.
    Cross-list helpers `ListHeadline` + `ShowInactiveToggle` now own their own `t()`.
  - **Helpers translated via the imported `i18n` instance** (not a hook, not a `TFunction` prop):
    `lib/lifecycle.ts` (`statusLabel`, new `statusOptions(group)` replaces the old
    `STATUS_OPTIONS` table; `STATUS_VALUES` keeps the per-group ordering) and `lib/ownership.ts`
    (`ownershipLabel`'s `Joint` / `Sole` / ` (you)` literals). Callers re-render via
    `useTranslation` upstream, so the `i18n.t` lookup picks up the live locale each render.
    Both helpers use `defaultValue: <english>` so the unit tests (vitest runs in `node`
    without an init'd i18n) still pass against the raw values — catalog correctness is asserted
    separately by `i18n/catalogs.test.ts`. `lib/lifecycle.test.ts` rewritten against the new
    `STATUS_VALUES` + `statusOptions` API; the old "label === English" assertions dropped.
  - **Pattern decisions (settled here, ported to #8–#11):**
    - Group-specific copy → group namespace (`assets.bankAccount.*`,
      `liabilities.personal.*`, …). Shared field labels reused across ≥2 groups →
      `common.fields.*`. Shared dialogs (snapshot / terminate / import) →
      `common.snapshot.*` / `common.terminate.*` / `common.import.*` — `Create/EditSnapshotDialog`,
      `SnapshotRow`, `TerminatePositionDialog`, `ImportSnapshotsDialog` all read from these
      shared keys, so a new group never reproduces dialog copy.
    - Lifecycle status labels → `common.lifecycle.<group>.<status>` (resolved through
      `lib/lifecycle.ts → i18n.t`). Ownership labels → `common.ownership.*` (resolved through
      `lib/ownership.ts`). Status enums on extension tables (e.g. `account_type` = savings /
      current / other) translate at the call site via `t('assets:bankAccount.accountTypes.<v>')`
      against an enum sub-namespace per group.
    - Pluralisation uses i18next's `_one` / `_other` suffix: `common.list.activeCount`,
      `common.list.noActive`, `common.import.needsFixing` / `committed` / `importN`. Count-aware
      copy passes the raw `count` + caller's `noun`/`nounPlural` pair so the shared key carries
      the count semantics and the screen provides only the noun.
    - `errors.json` populated with `failedToLoad` + `unknownError`; `formatError(err, fallback)`
      in dialogs (`Create/EditBankAccountDialog`, `Create/EditSnapshotDialog`,
      `ImportSnapshotsDialog`, `TerminatePositionDialog`) takes the localised unknown-error
      string as an explicit parameter (mirrors the chrome refactor in #5).
  - **Import dialog's bolded sentence fragment uses `<Trans>`** with a `<bold>` component slot
    rather than splitting the sentence into three keys per locale. First use of `<Trans>` in
    the extraction sweep; pattern documented for the bond/time-deposit dialogs in #10.
  - **ID copy follows `docs/glossary-id.md`:** Rekening Bank, Tabungan / Giro / Lainnya
    (account types), Saldo, Snapshot (kept as loanword), Bersama / Tunggal (ownership),
    Aktif / Ditutup / Terjual / Dilepas (lifecycle).
  - **No `data-testid` changes**, no public-API changes other than `lib/lifecycle.ts` swapping
    `STATUS_OPTIONS` (data table) for `statusOptions(group)` (function); the only caller was
    `TerminatePositionDialog`.
  - Lint 1127 → 987 (140 bank-account + shared-dialog warnings cleared). Build green,
    vitest 13/13 (127/127).
- **Properties + Vehicles i18n extraction (M6, frontend-only — issue #8).** Fourth
  extraction slice; first to apply the #7 template to two groups in one PR. 10 components
  touched (5 property + 5 vehicle: `*Screen` / `*Detail` / `*ListRow` / `Create*Dialog` /
  `Edit*Dialog`) plus the sign-aware revaluation hint in the shared `CreateSnapshotDialog`.
  ~160 string sites moved into `assets.property.*` / `assets.vehicle.*`. **No new shared
  dialog keys** — the four shared dialogs from #7 (snapshot create/edit/row + terminate +
  import) drove both groups without modification, validating the #7 template choices.
  - **Sign-aware revaluation hint.** The shared `common.snapshot.revaluationHint` split
    into `revaluationHintAppreciate` (positive rate; EN: "+X% appreciation /yr"; ID:
    "apresiasi X% /thn") and `revaluationHintDepreciate` (negative rate; EN: "−X%
    depreciation /yr" — real minus U+2212; ID: "penyusutan X% /thn"). The dialog picks
    the key from the rate sign rather than threading a glyph through interpolation. This
    closes the issue's "sign-aware copy translated, not just keys" criterion.
  - **Closed-enum sub-namespaces.** Property `property_type` and vehicle `vehicle_type`
    each get a sub-namespace (`assets.property.propertyTypes.{house,apartment,land,
    commercial}`, `assets.vehicle.vehicleTypes.{car,motorcycle,other}`) translated via
    `t(\`assets:<group>.\${type}.\${value}\`)` at the call site. The `capitalize` CSS
    class on the secondary-info `<div>` in both `*ListRow` and `*Detail` dropped because
    the translation now returns Title Case; addresses and make/model/year/plate stay free
    text under the same line.
  - **Edit/Create label divergence.** A handful of fields show slightly different copy
    in Create vs Edit dialogs (Edit drops the "(optional)" suffix because the field
    pre-fills with the existing value). Catalog mirrors that with `<field>` /
    `<field>Edit` siblings (`address`/`addressEdit`, `acquisitionDate`/`Edit`,
    `acquisitionCost`/`Edit`, `appreciationRate`/`Edit`, `make`/`Edit`, `model`/`Edit`,
    `year`/`Edit`, `plateNumber`/`Edit`, `depreciationRate`/`Edit`). The pattern is
    deliberate — preserves the existing EN UX and lets ID translators write each form
    naturally rather than awkwardly parameterising "(optional)".
  - **Property's acquired-for sentence** split into two keys: `acquiredLine` for the
    date-only case (`Acquired: <date>`) and `acquiredForLine` for the date+cost case
    (`Acquired: <date> for <cost>`). Picking by presence of the cost value at the call
    site keeps both EN and ID readable; the alternative — appending " for X" inline —
    embedded an English preposition that doesn't transliterate.
  - **Per-group rate-value keys.** `assets.property.appreciationRateValue: "{{value}} /yr"`
    (`/thn` in ID) and `assets.vehicle.depreciationRateValue: "{{rate}}% /yr"`. The unit
    suffix is the locale-divergent bit; the value stays formatted at the call site
    (`formatSignedPercent` for property's signed rate, `Number(...).toFixed(2)` for
    vehicle's positive rate).
  - **ID copy from `docs/glossary-id.md`:** Properti, Kendaraan, Rumah / Apartemen /
    Tanah / Komersial, Mobil / Motor / Lainnya, Apresiasi / Penyusutan,
    Valuasi (for "valuation"), Diakuisisi (for "acquired"), Laju (for "rate", chosen over
    "Tingkat" for compactness in the table-context label).
  - **No `data-testid` changes**, no public-API changes; `lib/revaluation.ts` untouched.
  - Lint 987 → 827 (160 property + vehicle warnings cleared). Build green, vitest 13/13
    (127/127). Playwright pending final commit.
- **Liabilities + Receivables i18n extraction (M6, frontend-only — issue #9).** Fifth
  extraction slice; second to apply the #7 template to two groups in one PR. 10
  components touched (5 liability + 5 receivable: `*Screen` / `*Detail` / `*ListRow`
  / `Create*Dialog` / `Edit*Dialog`). ~146 string sites moved into `liabilities.*` /
  `receivables.*`. **No new shared dialog keys** — the four shared dialogs from #7
  drove both groups without modification, validating the template for a second
  round.
  - **Subtype-aware screen** (`LiabilitiesScreen`). One component renders both the
    Personal and Institutional tabs — the previous `COPY = {personal, institutional}`
    inline literal table moved into `liabilities.screens.{personal,institutional}.
    {title,description}`. The empty-state copy ("No personal liabilities yet" /
    "Belum ada liabilitas pribadi") interpolates a lowercased subtype label resolved
    via `liabilities.subtypes.{personal,institutional}` so the same key drives both
    tabs.
  - **Detail-row pluralisation.** `liabilities.termValue` uses i18next's
    `_one`/`_other` plural suffix for "{{count}} month(s)" (EN diverges by count, ID
    stays "{{count}} bulan" for both forms but uses the same key shape so the
    callsite is uniform). Per-row value strings (`interestRateValue: "{{rate}}%
    /yr"`, `periodValue: "{{start}} → {{end}}"`) take the locale-divergent suffix /
    glue character, keeping `formatDate` / `toFixed` on the call site.
  - **Due-date snippet localisation** (Receivables). The "· due {date}" / "· jatuh
    tempo {date}" snippet appears in both the list row's secondary line and the
    detail page's subtitle. Catalog provides `rowDueSuffix` (concatenable suffix for
    the list row, where the counterparty stays unwrapped JSX) and
    `detailSubtitleWithDue` (full sentence with both fields interpolated, for the
    detail-page subtitle where the whole line goes through one `t()`). When no due
    date exists the row drops the suffix and the detail page renders the
    counterparty name directly — no empty interpolation surface.
  - **ID copy from `docs/glossary-id.md`:** Liabilitas Pribadi / Institusional,
    Piutang, Pihak lawan (Counterparty), Pokok (Principal), Suku bunga (Interest
    rate), Bunga (Interest), Tenor (Term — common Indonesian finance loanword;
    "Jangka waktu" would be the literal translation but reads stiff in a household
    UI), Jatuh tempo (Maturity / due date), Saldo terutang (Outstanding balance).
  - **No `data-testid` changes**; the E2E literals ("+ New liability", "New
    liability", "Edit liability", "Counterparty", "Receivable actions", etc.) all
    preserved in the EN catalog.
  - Lint 827 → 681 (146 liability + receivable warnings cleared). Build green, vitest
    13/13 (127/127). Playwright pending final commit.
- **Income i18n extraction (M6, frontend-only — issue #11).** Sixth extraction slice;
  the flat flow-event group end-to-end. 4 components touched (`IncomeScreen`,
  `IncomeRow`, `Create/EditIncomeDialog`); ~66 string sites moved into `income.*`.
  Pulled ahead of #10 at user request — income is the simpler of the two
  remaining extractions and unblocks tackling #10 (investments + transactions, 18
  components) in isolation.
  - **Two-tier category catalog.** Income rows render a compact chip ("Salary" /
    "Business" / "Rental"), while the Create/Edit dropdowns spell out the longer
    forms ("Business income" / "Rental income" / "Insurance payout"). Catalog
    mirrors the divergence with `income.categories.*` (chip) + parallel
    `income.categoryOptions.*` (dropdown, with a `placeholder` sibling for the
    disabled "Select category" option). The previous in-component
    `CATEGORY_LABEL: Record<IncomeCategory, string>` constant table was deleted —
    the call site in `IncomeRow` now reads `t(\`income:categories.\${income.category}\`)`
    directly and reuses that resolved string in the delete-confirm sentence.
  - **Regularity icons keep their accessible labels.** The `Repeat` (routine) /
    `Sparkles` (incidental) row icons resolve their `aria-label` + `<title>` via
    `income.regularity.routineRowLabel` / `incidentalRowLabel` so a screen reader
    announces "Pemasukan rutin" in ID. The chip-bar filter labels (`Routine` /
    `Incidental` / `All` → `Rutin` / `Insidental` / `Semua`) live alongside under
    `income.filter.*`.
  - **Filter-empty line localised by enum.** When the filter chip is set and no
    rows match, the screen picks one of three keys (`filter.emptyAll` /
    `emptyRoutine` / `emptyIncidental`) rather than interpolating a stray English
    enum into a generic frame — keeps the ID noun ("rutin" / "insidental") agreeing
    with the surrounding sentence.
  - **Duplicate flow preserved.** The row-level Duplicate menu item still mounts
    `CreateIncomeDialog` with a `DuplicateSeed` and the dialog title flips between
    `createTitle` and `duplicateTitle` based on `seed` presence. The Create's
    Sole-default ownership (M4.5 grilling lineage) survives the i18n sweep.
  - **ID copy from `docs/glossary-id.md`:** Pemasukan (Income — chose over
    Pendapatan for the non-technical-household register), Gaji / Pendapatan usaha /
    Pendapatan sewa / Hadiah / Pengembalian pajak / Klaim asuransi / Lainnya (the
    seven category dropdowns), Rutin / Insidental (regularity), Duplikat
    (Duplicate verb on the row menu), Saring (Filter — verb form for the
    `filter.ariaLabel`).
  - **No `data-testid` changes**, no public-API changes; the in-component
    `CATEGORY_LABEL` table removed from `IncomeRow` (only call site).
  - Lint 681 → 615 (66 income warnings cleared; 615 remaining are all `#10`
    investment-transaction-dialog scope). Build green, vitest 13/13 (127/127).
    Playwright pending final commit.
- **Investments i18n extraction (M6, frontend-only — issue #10).** Seventh and
  largest extraction slice; all 5 subtypes end-to-end plus the shared
  transaction/snapshot dialog set. 30 components touched
  (5 × `*Screen` + `*Detail` + `*ListRow` + `Create*Dialog` + `Edit*Dialog`),
  6 snapshot-fork files (`Create/Edit/Row` for `QuantityPrice` +
  `AccruedInterest`), 8 transaction-fork files
  (`Create/Edit` for `Trade` + `CashIncome` + `Fee` + `Maturity`),
  the shared `TransactionRow`, the three `RiskProfile*` components, and
  `lib/maturity.ts` — roughly 9.4 k lines of source routing every literal
  through `t()`.
  - **Per-subtype namespaces, shape-shared shared keys.** Subtype copy lives
    at `investments.stock.*` / `mutualFund.*` / `bond.*` / `timeDeposit.*` /
    `gold.*` (5 closed sets of list/detail/dialog text plus per-subtype
    `quantityUnit` + `reconcileWarning` interpolation keys). Transaction
    shapes get their own top-level blocks — `investments.trade.*`,
    `cashIncome.*`, `fee.*`, `maturityTxn.*` — because the same dialog
    drives multiple subtypes; the shared `TransactionRow` reads
    `investments.transactionType.{buy,sell,coupon,dividend,distribution,fee,maturity}`
    + `transactionRow.{tradeDetail,feeDetail,maturityPrincipalDetail,
    maturityInterestDetail,deleteTitle,deleteDescription,rolledImpact,
    actions}` + `disposition.{cashOut,rolledToNew,cashShort,rolledShort}`.
    Snapshot dialogs split by shape: `quantityPriceSnapshot.*` (stocks /
    mutual funds / gold) and `accruedInterestSnapshot.*` (bond / time
    deposit), with a shared `snapshotsCard.*` (chart title +
    `chartDescription` / `chartDescriptionTotal` + table headers) and
    `snapshotRow.*` (actions + delete confirm).
  - **Risk profile + maturity copy localised, behaviour preserved.**
    `RiskProfileBadge` / `RiskProfileFilter` / `RiskProfileSelect` resolve
    badges + chip labels + select options through
    `investments.riskProfile.*` (badge letters too — L/M/H in EN become
    R/S/T in ID). `lib/maturity.ts` switched its 4-tier label generator
    to `i18n.t(..., { defaultValue: <english> })` — the node-env unit
    tests still pass because they read the English defaults, matching
    the lib/lifecycle.ts pattern. The 30/90-day urgency buckets and
    Tailwind `maturityClass` tiers stay intact; only the label string is
    translated.
  - **`detailsCardLine` interpolated per subtype.** All 5 detail pages
    render `Ownership: {x} · Currency: {y} · Status:` followed by an
    inline `<StatusBadge />`; the prefix is one i18n key per subtype with
    `{{ownership}}` + `{{currency}}` placeholders. ID flips this to
    `Kepemilikan: … · Mata uang: … · Status:`.
  - **Bond + TimeDeposit detail-card extras translated inline.** Bond
    detail's Face value / Coupon / Maturity rows resolve via
    `bond.faceValueLabel` + `couponLabel` + `couponValue` (with `rate`
    + `frequency` interpolation) + `maturityLabel`; TD detail's
    Principal / Placement / Maturity / At maturity rows via
    `timeDeposit.principalLabel` + `placementLabel` + `maturityLabel` +
    `atMaturityLabel`. Subtype + frequency dropdowns read closed enums
    (`bond.bondType.{govt_primary,secondary_market}` +
    `bond.couponFrequency.{monthly,quarterly,semi_annual,annual}` +
    `timeDeposit.rolloverPolicy.{auto_renew_principal,
    auto_renew_with_interest,no_rollover}`); list-row short forms
    (`govt_primary_short` / `monthly_short`, etc.) and the bond
    `rowMeta` joiner ("{type} · {issuer} · {rate}% {frequency}") read
    matching sibling keys to keep ID grammar natural in the compact
    row.
  - **ID copy from `docs/glossary-id.md`:** Saham (Stock), Reksa Dana
    (Mutual Fund), Obligasi (Bond — the glossary's deliberate override
    of CONTEXT's English-side _Avoid_ list), Deposito (Time Deposit —
    short form is everyday Indonesian usage), Emas (Gold), Beli / Jual
    (Buy / Sell), Kupon / Dividen / Distribusi (Coupon / Dividend /
    Distribution), Biaya (Fee — avoids the informal English loanword),
    Jatuh Tempo (Maturity — both transaction type and lifecycle
    status), Pokok / Nilai Nominal (Principal / Face Value), Bunga
    Berjalan (Accrued Interest — preferred over Bunga Akrual which
    reads textbook-y), Suku Bunga (Interest Rate), Risiko
    Rendah / Sedang / Tinggi (Low / Medium / High Risk), Pemilik
    Tunggal / Bersama (Sole / Joint Ownership), Penempatan / Tanggal
    Jatuh Tempo (Placement / Maturity Date).
  - **No `data-testid` changes**, no public-API changes; ~615 `no-restricted-syntax`
    lint warnings cleared down to 13 pre-existing ones (em-dash placeholders + bare
    "·" separators that match patterns left in the bank-account / property template
    rows). Build green, vitest 13/13 (127/127); Playwright pending final commit.
- **E2E locale pin convention (M6, e2e — issue #12).** Eighth i18n slice;
  closes the suite-coverage side of ADR-0026 by writing down (and
  re-verifying) the en-GB pin that all 16 Playwright specs already
  depended on.
  - **Pin already in place across two layers.** Backend `cmd/balances
    seed-e2e` writes `Locale: "en-GB"` on the Alice + Bob user rows
    (`/me` carries it through to `AppShell`, which would otherwise
    reconcile against `navigator.language` on first login via
    `useLocaleReconcile`). Frontend `e2e/global-setup.ts` pre-seeds
    `localStorage['balances.locale'] = 'en-GB'` so the i18n
    `LanguageDetector` resolves to English before the first paint with
    no network race against `/me`. Both layers documented in
    `global-setup.ts` already, formalised in this issue.
  - **`frontend/e2e/README.md` added.** Single-source-of-truth doc for
    the convention: the pin lives in two layers (above), spec writers
    may `getByText('New bond position')` etc. because the EN copy is
    guaranteed stable, the standing `data-testid` convention
    (`feedback_e2e_test_ids`) still applies for picks/asserts that
    would otherwise need brittle DOM traversal, and exercising the ID
    UI in a spec means driving the Settings language dropdown — never
    editing the seed.
  - **Audit confirms no leaks.** Swept every `getByText` on translated
    copy across the 16 specs (`'New bond position'`, `'Record monthly
    snapshot'`, `'No snapshots yet.'`, `/match ledger total/`,
    `'Exchange rates'`, `'No rates entered yet.'`, `'Rebuild failed —
    try again.'`, etc.); each string maps to a canonical EN key in the
    catalog and the pin guarantees it resolves to that value at
    runtime. No specs needed migration.
  - `make e2e` 16/16 green (24.7s) — auth + login + 14 write-flow
    specs including the new investments-extraction targets
    (`bond-snapshot`, `trade`, `dividend-fee`, `maturity`). No
    `data-testid` changes; no source changes outside `e2e/README.md`.
- **Backend error-code envelope ADR + httperr package + receivables
  template (M6, backend — issue #13, slices 1 + 2).** Closes the
  Shape-C transition deferred by ADR-0026: HTTP errors move from
  English `http.Error(...)` text bodies to a typed JSON envelope
  `{code, args}` so future locales never touch Go. Codes are the wire
  contract; the FE i18n catalog (`errors:code.<CODE>`) is the single
  source of human copy — no `message` field on the wire.
  - **ADR-0027 (slice 1, commit cf707e4).** Designs the envelope: shape
    `{code, args}` with codes as SCREAMING_SNAKE_CASE strings, ten
    sentinel-derived codes (`NOT_FOUND`, `INVALID_LIFECYCLE`,
    `INVALID_SNAPSHOT_SHAPE`, `INVALID_TRANSACTION_TYPE`,
    `INVALID_TRANSACTION_SHAPE`, `FX_RATE_EXISTS`,
    `FOREIGN_POSITIONS_EXIST`, `POSITION_NOT_ACTIVE`, `INTERNAL`,
    and `ErrUnauthenticated` deliberately unmapped) + twelve inline
    codes for the parse/validation layer above the repo. Validator
    field errors collapse into one generic `VALIDATION` code with
    `{field, rule}` args (one catalog template handles every rule
    via i18next interpolation). ADR-0026 link updated from "planned"
    to live.
  - **`internal/httperr` package (slice 2).** `Envelope` type +
    `Write(w, status, code, args)` + `WriteRepo(w, op, err)` sentinel
    switch + `WriteValidation(w, err)` first-field-error mapper +
    `NewValidator()` that registers a JSON-tag-name func so the
    `field` arg reads as the on-wire field name (`amount`, not
    `Amount`). Codes live in `codes.go` as exported `Code` constants
    with one-paragraph godoc per code documenting the trigger + the
    mapped HTTP status. 8 test cases cover Write JSON shape +
    `args: omitempty` + sentinel mapping (including `errors.Is`
    traversal through `fmt.Errorf` wrapping) + the
    `ErrUnauthenticated` fall-through to INTERNAL + validator
    mapping for both struct-tag and oneof rules + the untagged-field
    fallback to Go name (safety-net path; internal/* tags every
    wire field).
  - **Receivables template (slice 2).** Every `http.Error(...)` call
    site in `internal/receivables/{receivables,lifecycle,import}.go`
    swapped to `httperr.Write` / `WriteRepo` / `WriteValidation`. The
    package-local `writeRepoError` helper deleted; `validator.New(...)`
    construction swapped to `httperr.NewValidator()`. Two small shims
    `writeInvalidID(w, field)` + `writeInvalidDate(w, field)` keep the
    call sites at one level of abstraction. `parseOptionalDate`
    signature simplified from `(s, field string) (*time.Time, error)`
    to `(s *string) (*time.Time, bool)` — the field name is named at
    the write site so the helper stays field-agnostic. `path /
    snapshot path id` distinction surfaces in the envelope as
    `{field: "id"}` vs `{field: "snapshot_id"}`. The other six BE
    packages convert in slice 3; the FE swap (one
    `errorMessage(err, t)` helper replacing ~50 local `formatError`
    clones + `errors.json` populated EN+ID) lands as slice 4.
  - **No test churn.** Two existing body-string assertions across
    `internal/**/*_test.go` (`auth/handlers_test.go` checks the
    response does *not* leak `google_sub`; `auth/callback_test.go`
    checks an invitation-failure redirect mentions `invitation`) are
    both out of scope for the envelope (the leak check passes
    unchanged; the redirect path is exempt per ADR-0027) so no test
    file in the receivables sweep needed editing — full backend suite
    + new httperr unit tests green, `golangci-lint run` 0 issues.
- **Backend httperr sweep across the remaining 6 packages (M6, backend —
  issue #13, slice 3).** Brings every HTTP-reachable error response in
  `internal/{assets,liabilities,investments,income,fxrates,reports,auth}`
  onto the ADR-0027 envelope. Receivables (the slice-2 template) was
  already converted; this slice generalises the pattern. The OAuth
  callback redirects (`internal/auth/handlers.go:handleCallback`) and
  the mock OIDC subcommand stay on their existing redirect/dev-only
  paths per ADR-0027's explicit exceptions.
  - **`internal/errs` leaf package added.** Earlier slice 2 had
    `httperr` import `internal/repo` for the sentinel switch; once
    `internal/auth` also imported `httperr`, the cycle (auth →
    httperr → repo → auth, because repo imports auth for
    `UserFromContext`) appeared. Fix: move the sentinel vars to a
    dependency-free leaf package `internal/errs`, and have
    `internal/repo/errors.go` re-export them via aliases
    (`var ErrNotFound = errs.ErrNotFound`) so every existing
    `repo.ErrFoo` call site keeps compiling. `httperr.WriteRepo`
    switches against `errs.Err*` directly. Documented in
    `internal/errs/errs.go`'s package doc + the repo/errors.go
    comment so the next contributor knows why the alias layer
    exists.
  - **Assets package (6 files).** `assets.go` loses
    `repoErrorStatus`/`writeRepoError`, gains the
    `writeInvalidID(w, field)` + `writeInvalidDate(w, field)`
    shims; subtype files (bank_accounts, properties, vehicles) and
    shared files (snapshots, lifecycle, import) sweep onto the
    envelope. `parseOptionalDate(s, field) (*time.Time, error)` →
    `(s *string) (*time.Time, bool)` mirroring the receivables
    refactor; the field name is named at the write site.
  - **Liabilities, Investments, Income, Fxrates, Reports
    packages.** Same pattern. Investments was the largest sweep (10
    files: 5 subtypes + snapshots + transactions + lifecycle +
    import + investments.go) — the package-local `parseOptionalDate`
    that returned a typed `errBadAsOfDate` sentinel got the same
    `(*time.Time, bool)` simplification with the field named at the
    write site. Income's manual `!IsPositive()` check on amount
    emits `VALIDATION` with `{field: "amount", rule: "gt"}` —
    matches what the validator's `gt` tag would emit if
    decimal.Decimal supported tag-based comparison. Fxrates' similar
    rate check uses the dedicated `INVALID_RATE` code instead
    because the FE catalog already has a tighter wording for that
    one. Reports has only the `INVALID_YEAR_MONTH` inline case
    (path-param parse).
  - **Auth package (non-callback).** `handleStart` /
    `handleMe` / `handleUpdateMe` / `handleListHouseholdMembers` /
    `handleUpdateHouseholdSettings` / `handleCreateInvitation` /
    `SessionMiddleware.RequireAuth` all swap. New
    `CodeUnauthorized` (401) covers the real client-facing
    middleware 401 — distinct from repo's unreachable
    `ErrUnauthenticated`. `handleUpdateMe` had four bespoke
    validation paths (`nickname` type/length, `locale`
    presence/oneof) that don't go through `validator.Struct`; each
    surfaces as `VALIDATION` with the appropriate
    `{field, rule}` args so the FE catalog only needs one
    rendering path. `handleUpdateHouseholdSettings`' "disable
    multi-currency while foreign positions exist" 409 reuses the
    existing `FOREIGN_POSITIONS_EXIST` sentinel code (sentinel was
    declared for the repo path; the inline check now emits the
    same code for symmetry on the wire).
  - **Tests + lint clean.** Full backend suite green (18 packages,
    including 8 httperr unit tests added in slice 2). `golangci-lint
    run` 0 issues. No `*_test.go` file in the sweep needed editing
    (status-only asserts everywhere; the two body-content asserts
    flagged in slice 2 stay valid).
  - Slice 4 (FE swap — one `errorMessage(err, t)` helper replacing
    ~50 local `formatError` clones + `errors.json` populated EN+ID)
    closes out issue #13.
- **Frontend error-envelope sweep (M6, frontend — issue #13, slice
  4).** Closes out the ADR-0027 stream. The 39 dialogs + non-dialog
  surfaces that surfaced a mutation error each carried a local
  `formatError(err, unknownMsg)` clone that rendered the raw English
  server body verbatim; every one of them now goes through a single
  `errorMessage(err, fallback?)` helper.
  - **`@/api/client` envelope plumbing.** `ApiError.body` retypes
    from `unknown` to `ErrorEnvelope | string | undefined`; new
    `ErrorEnvelope = { code: string; args?: Record<string, unknown> }`
    and `isEnvelope()` narrowing guard exported alongside. The `api()`
    wrapper parses the body as JSON, accepts it only if it shapes as
    an envelope, and otherwise falls through to `text()` (so the OAuth
    callback's plain redirect-error responses still surface a useful
    string in dev). `@/hooks/snapshotImport` (the multipart importer
    that bypasses `api()`) does the same narrowing on its 4xx path —
    its 422 "file had bad rows" body is still consumed as the
    success-shaped `ImportResult`, unchanged.
  - **`src/lib/errorMessage.ts` helper.** Resolution order: ApiError
    + envelope body → `errors:code.<CODE>` with `args` interpolated;
    ApiError without envelope → generic `errors:code.UNKNOWN`; native
    `Error` → `err.message`; anything else → optional `fallback`,
    else UNKNOWN. Unknown codes log a dev-only `console.warn` before
    falling to UNKNOWN, so a missing catalog entry doesn't go silent
    during development. Pattern mirrors `lib/lifecycle.ts` — pulls
    the live i18n instance directly rather than threading a `t` arg,
    so callers re-render on locale change via their own
    `useTranslation` hook.
  - **VALIDATION rule lookup deviates one step from the ADR sketch.**
    The ADR pitched `errors:code.VALIDATION` as both the template
    string and the parent of `rule.<rule>` sub-keys; JSON can't carry
    both at the same key, so rule strings live under sibling
    `errors:code.VALIDATION_RULE.<rule>` and the helper resolves the
    rule first, then feeds the human form into the
    `errors:code.VALIDATION` template's `{{rule}}` placeholder.
  - **`errors.json` populated EN+ID.** Every code emitted in slices
    1–3 has a catalog entry in both locales (23 codes total) plus the
    VALIDATION_RULE sub-keys for the seven validator tags actually
    used by the backend structs (`required`, `required_if`,
    `required_unless`, `email`, `gt`, `iso4217`, `oneof`). ID copy
    follows `docs/glossary-id.md` conventions; the `Errors` section
    of the glossary stays the canonical reference for future codes.
  - **Sweep across 39 components.** Every `Create*Dialog` /
    `Edit*Dialog` / `Import*Dialog` / `TerminatePositionDialog` /
    `InviteForm` deletes its local `formatError` (~9 lines each) and
    swaps `formatError(mutation.error, t('common:unknownError'))` →
    `errorMessage(mutation.error)`. `SettingsScreen`'s parallel
    `errText` helper (same shape, different name) also swaps. Net:
    +188/−458 lines across 44 files. `InviteForm` dropped its
    `const unknownError = t('common:unknownError')` line since the
    helper owns the fallback now.
  - **Tests + lint clean.** Vitest 127/127, vite build green,
    eslint 0 errors (13 pre-existing "Bare JSX text" warnings
    unrelated to this slice). Backend suite still green (no backend
    changes; the wire contract from slices 1–3 was already in place).
    Playwright E2E green locally.

- **Investment screens enhancements — slice 14a (M6, frontend —
  issue #14, slice 1 of 4).** Smallest-risk hits of the four-slice
  enhancement bundle: numeric-alignment sweep, bond-detail
  transaction-section totals, and transaction-search input on all 5
  detail screens. Issue #14 originally bundled four UI concepts
  (alignment, cost-line on detail graph, list-screen graphs +
  headlines, investment home dashboard); 14a takes the three
  smallest, lowest-risk pieces first so the larger cost-basis +
  charting work in 14b–14d can build on a clean alignment baseline.
  - **Right-align numerics across investment detail tables.** Three
    shared row components flip their numeric `<TableCell>` to
    `text-right tabular-nums`: `QuantityPriceSnapshotRow`
    (quantity / price / total — used by Stock / MutualFund / Gold);
    `AccruedInterestSnapshotRow` (principal / accrued / total —
    used by Bond / TimeDeposit); `TransactionRow` (cash impact —
    preserves the dir-color class, just appends alignment). The
    five detail screens each gain `className="text-right"` on the
    matching `<TableHead>`s — snapshot table's qty/price/total or
    principal/accrued/total + transactions table's cash impact.
    List-screen tables were already right-aligned via the
    `SortableHeader align="right"` + cell-level `text-right
    tabular-nums` combo from the M6 list-screen polish; no list
    change needed.
  - **Bond detail Σ coupons + Σ fees.** Quick yield-to-date glance
    the user asked for: a totals strip inside the Transactions
    `CardContent`, above the table, showing `Total coupons: X` +
    `Total fees: Y` in the bond's native currency. Computed via a
    one-line `txnSum` reducer over `transactions` filtered to
    `transaction_type === 'coupon'` / `'fee'`. Maturity payouts are
    deliberately excluded — they're terminal, not recurring income,
    and rolling them into the "total coupons" line would mix two
    different signals. The strip renders side-by-side with the
    transaction-search input (`flex flex-wrap justify-between`),
    both above the table. Keys `bond.totalCouponsLabel` /
    `totalFeesLabel` added to EN ("Total coupons:" / "Total fees:")
    and ID ("Total kupon:" / "Total biaya:" — both terms from
    `docs/glossary-id.md`).
  - **Transaction search on all 5 detail screens.** New
    `frontend/src/lib/transactionSearch.ts` exports a pure
    `matchesTxnSearch(tx, query)` predicate that lowercase-matches
    `query.trim()` against the localised transaction-type label
    (`i18n.t(\`investments:transactionType.${tx.transaction_type}\`)`)
    and the user-entered description. Pulls the live i18n instance
    directly via `import i18n from '@/i18n'`, mirroring
    `lib/lifecycle.ts` / `lib/maturity.ts` — callers re-render
    through their own `useTranslation` hook on locale change. Each
    detail screen gains a `useState('')` for `txnSearch`, computes
    `filteredTransactions = (transactions ?? []).filter(...)`
    before pagination, and renders an `<Input
    data-testid="txn-search">` above the Transactions table. The
    inner ternary handles "raw > 0 but filtered === 0" with a
    fresh `transactions.searchEmpty` line; `txnPage` clamps
    naturally via the existing `effectiveTxnPage = Math.min(...)`
    pattern, so no effect needed to reset pages on filter change.
  - **Counterparty caveat.** The original ask was "search over type
    + notes + counterparty" but investment transactions don't carry
    a separate counterparty column on either repo or wire (only
    `receivable`/`liability` rows do). The description doubles as
    that surface today; filtering against description + type label
    covers the actual use cases ("show all my BBCA buys", "find
    that fee from last quarter").
  - **i18n keys.** Shared keys live in the `transactions` namespace
    block: `searchPlaceholder` ("Search transactions…" /
    "Cari transaksi…") and `searchEmpty` ("No transactions match
    your search." / "Tidak ada transaksi yang cocok dengan
    pencarian."). The bond-specific totals keys live under
    `bond.*` because they're not shareable shape — only bonds carry
    the coupon + fee total semantics in the same view.
  - **Tests + lint clean.** Vitest 127/127, vite build green,
    eslint 0 errors (13 pre-existing "Bare JSX text" warnings
    unchanged from the issue-#13 baseline). Backend suite untouched
    (no backend changes). Playwright E2E deferred per the
    no-Playwright-while-experimenting workflow note; user will
    eyeball before/after the next slice. Net +345/−183 across 11
    files (10 modified + 1 new helper).

- **Investment screens enhancements — slice 14b (M6, frontend —
  issue #14, slice 2 of 4).** Cost-basis line on the detail-screen
  time graphs + headline `Total cost` / `Unrealized P/L` row
  beneath each H1. The gap between the value Area and the cost
  Line is the chart's one-glance P/L signal; the headline gives the
  same number as a precise readout under the H1.
  - **`lib/costBasis.ts` (3 exports + 16 unit tests).**
    `computeCostBasis(transactions) → { cost, heldQty }` is the
    avg-cost FIFO-ish replay: buys add `amount` + `quantity`, sells
    reduce both by `(cost / qty) × sellQty` (pre-sell ratio), fees
    capitalize into cost, coupon / dividend / distribution /
    maturity ignored. `costBasisSeries(snapshots, transactions)`
    is the per-snapshot-month parallel — sorts txns once, walks
    snapshot months in ascending order with a single cursor for
    O(n+m). `flatCostSeries(snapshots, cost)` emits a constant
    series for the subtypes whose cost lives outside the ledger
    (TD principal, bond govt-primary face value). All three accept
    either bare `"YYYY-MM"` or the API's `"YYYY-MM-DDT..."` form
    (slice-7 prefix match).
  - **Why ignore maturity.** Maturity is terminal — after it, the
    user typically stops snapshotting and the chart simply ends.
    At the maturity-month snapshot itself, value = principal +
    final interest and cost = unchanged principal, so the gap
    reads as the realized gain ("+5M on a 100M TD"). If we zeroed
    cost at maturity, the same gap would mis-read as "+105M".
    Sells already reduce cost proportionally so voluntary
    liquidations are correct without special-casing maturity.
  - **`SnapshotChart` + `SnapshotChartImpl` gain `costSeries?`.**
    When provided, the impl merges `cost` into each chart datum
    by year_month prefix, extends `chartConfig` with a `cost`
    entry (`color: var(--muted-foreground)`), and renders a
    second series as a recharts `<Line>` (thin solid stroke, no
    dot, animation off) layered on top of the existing value
    `<Area>` (kept with its fill). A `<ChartLegend>` shows up
    only when cost is present — wasteful chrome otherwise. The
    non-investment detail screens (BankAccount / Property /
    Vehicle / Liability / Receivable / Dashboard) omit the prop
    and render exactly as before — 10 unchanged callsites.
  - **Per-subtype cost source.** `StockDetail` / `MutualFundDetail`
    / `GoldDetail` use `costBasisSeries(snapshots, transactions ??
    [])` straight from the ledger. `BondDetail` branches on
    `hasBuys = transactions.some(t => t.transaction_type === 'buy')`:
    secondary-market bonds with real Buy txns use the ledger;
    govt-primary held-to-maturity (no Buy recorded — face value IS
    the cost) falls back to `flatCostSeries(face_value)`. The
    headline's `bondTotalCost` mirrors the same branch.
    `TimeDepositDetail` always uses `flatCostSeries(principal)` —
    TD ledger carries only Maturity (terminal), so the principal
    field on `time_deposit_details` is authoritative.
  - **`InvestmentHeadline` component.** Single shared row under
    each detail H1 (`data-testid="investment-headline"`), inside
    the left column of the header flex so action buttons re-center
    to the row. Renders `Total cost: X` always, then either
    `Unrealized P/L: ±Y (±Z%)` (active positions) or the
    closed-status short-circuit (see below). P/L tone via
    `plColor`: positive → `text-emerald-600`, negative →
    `text-destructive`, zero → `text-muted-foreground`. Sign uses
    the typographic minus glyph "−" (U+2212), matching the
    revaluation helper for visual alignment with "+". When
    `Math.abs(totalCost) === 0` the percentage is suppressed (no
    div-by-zero); when `latestValue === null` the P/L value cell
    shows the `unrealizedPLEmpty` em-dash.
  - **Closed-position short-circuit (the matured-mid-month
    problem).** Surfaced during grilling: when a TD or bond
    matures mid-month and the user snapshots end-of-month as
    they always do, the snapshot reads value=0 (cash already
    paid out). The P/L block would then show −100% (cost was
    100M, value is 0). For positions with `status !== 'active'`
    AND `terminated_at` set, the component swaps the P/L block
    for a `Matured on {date}` / `Sold on {date}` line driven by
    `headline.closed.<status>` with `default` fallback. Filed
    as separate **issue #17 (backend auto-snapshot on
    Maturity)** for the structural fix — when that lands, this
    short-circuit can be removed. The closed-status block is
    `data-testid="investment-headline-closed"`; the P/L number
    when present is `data-testid="investment-headline-pl"` for
    spec hooks.
  - **i18n.** New `dashboard.chart.costLegend` ("Cost" / "Modal")
    + `investments.headline.{totalCost,unrealizedPL,
    unrealizedPLEmpty,closed.{matured,sold,default}}` in EN+ID.
    ID copy follows `docs/glossary-id.md`: "Total modal" (cost
    basis — retail-friendly Indonesian; the accounting-formal
    "Biaya perolehan" reads jargon-y for the household
    audience), "Untung/rugi belum direalisasi" (full form, not
    the abbreviated "L/R", because non-technical users don't
    parse the abbreviation), "Jatuh tempo / Dijual / Ditutup
    pada". Glossary gets three new rows: Cost/Modal, Unrealized
    P/L, Fee (the third disambiguates `biaya` as fee vs `modal`
    as cost basis on the same screens).
  - **Tests + lint clean.** Vitest **143/143** (+16 new
    `lib/costBasis.test.ts` cases), vite build green, eslint 0
    errors (13 pre-existing "Bare JSX text" warnings unchanged
    from the issue-#13 baseline). Backend untouched. Net
    +290/−12 across 15 files (12 modified + 3 new:
    `InvestmentHeadline.tsx`, `lib/costBasis.ts`,
    `lib/costBasis.test.ts`). Playwright E2E deferred per the
    no-Playwright-while-experimenting workflow note.

- **Investment screens enhancements — slice 14c (M6, frontend —
  issue #14, slice 3 of 4).** List-screen aggregate headline +
  per-currency time graph across all 5 investment list screens.
  The detail-screen value-vs-cost view from 14b ports up to the
  collection level; a user landing on `/investments/stocks`
  immediately sees the total they put in, the total it's worth,
  the unrealized P/L, and the monthly trajectory of both lines.
  - **`lib/listAggregates.ts` (10 unit tests).** Pure aggregator:
    `aggregateListPositions(positions) → { byCurrency,
    timeSeriesByCurrency, count }`. Per-currency totals (value +
    cost + P/L) for the headline; per-currency monthly time series
    with carry-forward for the graph. Active-only — matches the
    existing `activeCurrencyTotals` convention so terminated
    positions drop out of both views consistently. Currencies stay
    separate (no FX) per the no-FX list-screen convention from
    `lib/totals.ts`; multi-currency households get one card per
    currency. Time-series walk uses per-position cursors so each
    month step is O(1) amortized — sort once, walk the union of
    months, sum value + cost using "latest snapshot at-or-before
    month" carry-forward.
  - **`hooks/useInvestmentBatch.ts`.**
    `useInvestmentBatchSnapshots(ids)` and
    `useInvestmentBatchTransactions(ids)` wrap `useQueries` with
    the same `['investment-snapshots', id]` /
    `['investment-transactions', id]` keys as the existing
    per-position hooks, so the React Query cache is **shared
    with the detail screens**: clicking a list row hydrates the
    detail page instantly (snapshots + transactions already in
    cache). The structural follow-up (backend cost_basis aggregate
    on each subtype's ListItem) is tracked in **issue #18** —
    once that lands the transactions batch can drop; the
    snapshots batch stays until a parallel monthly-series
    endpoint exists too.
  - **`InvestmentListHeadline` (new, swaps `ListHeadline` on the
    5 investment screens).** Single card, three rows
    (Value / Cost / P/L) with a per-currency dot separator on
    each row + a 4th line with the active-count noun. P/L tone
    mirrors the detail-screen `InvestmentHeadline` (emerald gain
    / destructive loss / muted zero, "−" U+2212 minus glyph) and
    fans across currencies — each segment gets its own color
    independently. Mixed-currency household sees e.g.
    "Value: Rp 50M · $ 5K" / "Cost: Rp 40M · $ 4K" /
    "P/L: +Rp 10M (+25%) · +$ 1K (+25%)" all stacked in one
    card. Non-investment list screens keep using the existing
    `ListHeadline` unchanged.
  - **`ListTimeGraph` (new).** Maps over
    `timeSeriesByCurrency.entries()` and renders one `<Card>` per
    currency containing the lazy `<SnapshotChart>`. Reuses the
    existing chart's `costSeries` prop from 14b — converts each
    `TimePoint` into the snapshot-like `{year_month, amount}`
    shape plus the parallel `{year_month, cost}` shape. The
    chart wrapper's own length-2 minimum handles the "not enough
    data" case per currency. `data-testid="list-time-graph-
    {currency}"` for spec hooks.
  - **Per-subtype wiring in the 5 list screens.** Stock / MF /
    Gold use `computeCostBasis(transactions)` + `costBasisSeries`
    (ledger replay). Bond branches on `hasBuys`: secondary
    markets use ledger; govt-primary falls back to flat
    `face_value` via `flatCostSeries` (same rule as 14b's
    `BondDetail`). TimeDeposit always uses
    `flatCostSeries(principal)` and skips the transactions batch
    entirely — the TD ledger only carries Maturity (terminal),
    no buys, no fees, so the snapshots-only batch is enough.
  - **i18n keys.** New `investments.list.{totalCost,
    unrealizedPL, chartTitle, chartDescription}` (EN+ID). ID
    copy reuses the `Modal` (cost basis) + `Untung/rugi`
    (P/L) terms from 14b's glossary additions. Chart description
    interpolates currency code: "Sum of value and cost across
    active positions (IDR)." / "Total nilai dan modal seluruh
    posisi aktif (IDR).".
  - **Tests + lint clean.** Vitest **153/153** (+10 new
    `lib/listAggregates.test.ts` cases), vite build green,
    eslint 0 errors (13 pre-existing "Bare JSX text" warnings
    unchanged from the issue-#13 baseline). Backend untouched.
    Net +600/−16 across 12 files (7 modified + 5 new:
    `InvestmentListHeadline.tsx`, `ListTimeGraph.tsx`,
    `useInvestmentBatch.ts`, `lib/listAggregates.ts`,
    `lib/listAggregates.test.ts`). Playwright E2E deferred per
    the no-Playwright-while-experimenting workflow note.

- **Investment screens enhancements — slice 14d (M6, frontend —
  issue #14, slice 4 of 4 — closes the issue).** The
  `/investments` landing rebuilt from a placeholder page into a
  cross-subtype dashboard. The list-screen aggregate idea from
  14c ports up one level: a user landing on `/investments`
  immediately sees the total value they hold across all 5
  subtypes, what those positions cost, the unrealized P/L, plus
  the trend lines, category mix, and risk mix that make
  rebalancing decisions readable at a glance.
  - **`lib/homeAggregates.ts` (9 unit tests).** Pure
    cross-subtype aggregator: takes positions tagged with
    `category` (`'stock' | 'mutualFund' | 'bond' |
    'timeDeposit' | 'gold'`) and `riskProfile` and emits a
    `HomeAggregates` shape that extends 14c's `ListAggregates`
    with three additional outputs — `categorySeriesByCurrency`
    (monthly carry-forward breakdown by category, for the
    100%-stacked chart), `categoryPieByCurrency`, and
    `riskPieByCurrency`. Internally calls
    `aggregateListPositions` for the headline + value/cost
    series so the home and per-list-screen views agree
    automatically. Active-only, no FX, currencies separate —
    matches 14c. `INVESTMENT_CATEGORIES` +
    `INVESTMENT_RISK_PROFILES` constants exported for stable
    legend ordering across charts.
  - **`CategoryStackChart` / `CategoryStackChartImpl` (new).**
    Lazy boundary + recharts `AreaChart` with
    `stackOffset="expand"` — recharts' built-in 100%-stacked
    mode. Y-axis labelled as percentages; tooltip recomputes
    per-row totals so it shows the share even though recharts
    feeds it the raw value. One `<Area>` per category, dropping
    any category that's zero across every month so a household
    holding only stocks + bonds doesn't get a 5-stack legend
    with three flat lines.
  - **`InvestmentPieChart` / `InvestmentPieChartImpl` (new).**
    Generic shared pie used twice — once for category mix, once
    for risk mix — so the page doesn't duplicate two
    near-identical chart files. Accepts a
    `{ key, label, value, color }[]` and renders recharts
    `PieChart` + `Pie` + `Cell` with shadcn `ChartLegend` +
    `ChartTooltip`. Donut shape (`innerRadius={48}`) so the
    legend has room beneath without crowding the slices.
    Tooltip formats as `{label}: {currency value} ({pct}%)`
    using the same `formatCurrency` helper as the rest of the
    app. Empty slices are filtered out at the impl boundary so
    the legend stays tight; the wrapper short-circuits to
    `null` if the total is zero (e.g. a household with
    investments but no snapshots yet).
  - **`InvestmentsHome.tsx` (rewrite).** Fetches all 5 list
    endpoints via the existing per-subtype hooks, concatenates
    the IDs, and runs a single
    `useInvestmentBatchSnapshots(allIds)` +
    `useInvestmentBatchTransactions(txnIds)` pair. Per-subtype
    cost-basis branching (Stock/MF/Gold ledger replay; Bond
    `hasBuys` branch; TD flat principal) mirrors the existing
    list screens — kept inline rather than abstracted because
    each subtype reads slightly different fields off its
    `details`, and a single abstraction would obscure that.
    Layout: headline → for each currency a vertical stack of
    (value+cost card, category-stack card, 2-col grid of the
    two pies). Multi-currency households get one stack per
    currency. **No FX** — same convention as the per-list
    screens. The N+1-fetches structural fix is **issue #18**,
    multiplied by 5 here; same out-of-scope rationale.
  - **Color choices.** The shadcn theme ships
    `--chart-1`..`--chart-5` but all five sit in the cyan
    family — a stacked / pie split using them would read as
    one blob. Categories use 5 distinct Tailwind 500-level
    hues instead, picked for legibility against both light
    and dark backgrounds: stock `#06b6d4` (cyan), mutualFund
    `#8b5cf6` (violet), bond `#3b82f6` (blue), timeDeposit
    `#10b981` (emerald), gold `#eab308` (yellow — literal
    gold connotation). Risk uses a semantic traffic-light
    palette per the user decision: low `#059669` (emerald-600,
    matches the existing P/L gain tone), medium `#f59e0b`
    (amber-500), high `#dc2626` (red-600, stable static
    equivalent of the OKLCH `--destructive` token that recharts
    needs a hex for). The palette duplication between
    `CategoryStackChartImpl.tsx` and `InvestmentsHome.tsx` is
    deliberate — keeps the lazy chunks self-contained — and
    documented inline at both sites.
  - **i18n keys.** New `investments.home.{subtitle,
    valueCostChartTitle, valueCostChartDescription,
    categoryStackTitle, categoryStackDescription,
    categoryPieTitle, categoryPieDescription, riskPieTitle,
    riskPieDescription, categoryLabel.{stock,mutualFund,
    bond,timeDeposit,gold}}` (EN+ID). ID category labels pulled
    from the glossary (Saham / Reksa Dana / Obligasi /
    Deposito / Emas). Risk pie legend reuses the existing
    `investments.riskProfile.badge{Low,Medium,High}` keys — no
    new copy needed there.
  - **Tests + lint clean.** Vitest **162/162** (+9 new
    `lib/homeAggregates.test.ts` cases), vite build green
    (three new lazy chunks: `CategoryStackChartImpl`,
    `InvestmentPieChartImpl`, plus recharts' own
    `AreaChart`), eslint 0 errors on the new code (the 13
    pre-existing "Bare JSX text" warnings from the
    issue-#13 baseline remain unchanged). Backend untouched.
    Net +744/−6 across 9 files (3 modified —
    `InvestmentsHome.tsx`, `locales/en/investments.json`,
    `locales/id/investments.json`; 6 new —
    `lib/homeAggregates.ts`, `lib/homeAggregates.test.ts`,
    `CategoryStackChart.tsx`, `CategoryStackChartImpl.tsx`,
    `InvestmentPieChart.tsx`, `InvestmentPieChartImpl.tsx`).
    Playwright E2E deferred per the
    no-Playwright-while-experimenting workflow note.

- **Date inputs capped at 4-digit year (M6, frontend — issue #15).**
  HTML `<input type="date">` will happily accept a 6-digit year
  (e.g. `203045-01-01`) when no `max` is set — surfaced first on the
  Create Bond dialog's `maturity_date`, but the same bug existed on
  every unbounded date input. Added `max="9999-12-31"` to all 17 sites
  across 13 dialogs that didn't already have a tighter cap: bond
  maturity (Create + Edit), TD placement + maturity (Create + Edit),
  liability start + maturity (Create + Edit), receivable due (Create +
  Edit), income date (Create + Edit), property acquisition_date
  (Create + Edit), and `TerminatePositionDialog.terminated_at`. The
  existing `max={todayDate()}` / `max={thisYearMonth()}` past-only
  caps on snapshot + transaction dialogs (5+5 snapshot + 7
  transaction sites) already exclude the 6-digit case as a side
  effect of clamping to today, so they're unchanged. Vitest 162/162,
  vite build green, eslint 0 errors. Net +17/0 across 13 files.
  Backend untouched.

- **Investment graphs include closed positions (M6, frontend —
  issue #21).** The list-screen time graphs (#14 slice 14c) and the
  Investments-home cross-subtype graphs (#14 slice 14d) were
  active-only, which hid the historical shape of the portfolio: a
  sold or matured position vanished from the chart as soon as its
  lifecycle flipped, so the user saw a step-down rather than a
  continuous curve through the months the position was actually
  held. Fixed at the pure-aggregator layer:
  - `lib/listAggregates.ts` — `Position` gains
    `terminated_at: string | null`. `aggregateMonthly` walks
    *all* positions (not just `active`) and caps each one's
    contribution at its termination month (`month > termMonth`
    skips). Carry-forward still works within the held window;
    after the termination month the position drops out cleanly.
    Headline + count remain `active`-only — closed positions
    have no current value/cost to attribute.
  - `lib/homeAggregates.ts` — same treatment for
    `aggregateMonthlyByCategory` so the 100%-stacked category
    chart also reflects the historical share. Pies stay
    current-state (active-only); the category stack now mixes
    all-history (closed-cap aware) with active-only pies, so the
    `byCurrencyAll` / `byCurrencyActive` split makes the
    convention explicit at the grouping step.
  - All 5 list screens (`Stocks/MutualFunds/Bonds/TimeDeposits/
    Golds`) + `InvestmentsHome` thread
    `terminated_at: item.investment.terminated_at` into the
    `Position` rows they build. No type changes on the wire —
    `Investment.terminated_at` is already on every list payload.
  - **Caveat that intersects #17.** Without auto-snapshot on
    Maturity (#17), a position closed mid-month has its
    pre-maturity snapshot as its last value, so the
    termination-month bar will read inflated (the principal
    pre-payout, not the realized 0). Once #17 lands and the
    backend inserts a `maturity_date` snapshot at the realized
    payout, the bar drops to 0 in the termination month, then
    the position drops out the next month — exactly the shape
    the user wants. This is documented in
    `lib/listAggregates.ts`'s `aggregateMonthly` comment as a
    known issue, not a bug to chase here.
  - Unit tests extended: two new `listAggregates` cases (closed
    position capped at terminated month + month-strictly-after
    omission); the homeAggregates "excludes terminated" case
    rewritten to assert the headline/pies-vs-series split. No
    changes to `costBasis.ts` or to `useInvestmentBatch.ts` —
    closed positions were already being fetched by the existing
    batch hooks (the filter happened in the aggregator, not at
    the fetch).
  - Vitest 164/164 (+2 listAggregates), vite build green, eslint
    0 errors (only pre-existing bare-JSX-text warnings remain).
    Net +171/−24 across 10 files. Backend untouched.

- **Auto-snapshot on Maturity (M6, backend + frontend — issue #17,
  fixes #16).** Structural fix flagged during #14 slice 14b
  grilling and listed in the deferred backlog. When a Bond or
  TimeDeposit Maturity transaction lands,
  `CreateInvestmentTransaction` now upserts an
  `investment_snapshots` row at `firstOfMonth(transaction_date)`
  with `amount = principal_amount + interest_amount` and
  `accrued_interest = interest_amount` — atomic with the existing
  status flip to `matured`, in the same Tx. Bond + TimeDeposit are
  the only subtypes that accept Maturity per
  `validateInvestmentTransactionType` and both use the accrued
  shape, so a single code path covers both. Reuses the existing
  `UpsertInvestmentSnapshot` (the importer's idempotent path), so
  a pre-maturity snap the user took earlier in the same month is
  overwritten — the maturity payout is the authoritative
  end-of-life value. Carry-forward into next months now reflects
  the realized payout instead of the zero an end-of-month snap
  would record after the cash already left the position, which
  fixes the −100% P/L misread that #16 reported and was also the
  root cause behind 14b's closed-status short-circuit + 14d/21's
  mid-month-closure caveat in the cross-subtype graphs.
  - `internal/repo/investment_transactions.go` —
    `CreateInvestmentTransaction` gains the upsert call inside
    the same Tx as `UpdateInvestmentLifecycle`; no new error
    code (snapshot-shape is already validated by the type/shape
    guards on the parent transaction).
  - `internal/repo/investment_transactions_tenancy_test.go` —
    new sub-test `alice maturity auto-creates snapshot at
    maturity month` asserts the upserted row's `YearMonth`
    (2027-01-01 for a 2027-01-15 maturity), `Amount` (principal +
    interest), `AccruedInterest` (= interest), nil `Quantity` /
    `PricePerUnit`, and `Currency`. New `maturity overwrites
    pre-existing snapshot in same month` sub-test creates a
    second TD, pre-creates a user snapshot for the maturity
    month, then triggers Maturity and asserts the row was
    overwritten with the payout values (same snapshot count).
  - `frontend/src/components/InvestmentHeadline.tsx` — closed-
    status short-circuit narrowed from "any closed status" to
    `status === 'sold'`. Matured positions now flow through the
    normal P/L branch, which produces the right number against
    the new maturity-month snapshot. Sold positions keep the
    short-circuit because the manual terminate flow doesn't
    auto-snapshot — the latest snap is still the pre-sale value
    and would render value=0 / −100% in the same misleading way.
    File header comment rewritten to reflect the narrower scope.
  - `frontend/src/locales/{en,id}/investments.json` —
    `headline.closed.matured` + `headline.closed.default` dropped
    (no longer rendered); `headline.closed.sold` retained for the
    sold short-circuit.
  - **Side note for #14 slice 14d / #21.** The mid-month-closure
    caveat documented in `lib/listAggregates.ts` is now resolved
    by this change for matured positions: the termination-month
    bar reads the realized payout (positive value drops to 0 in
    the following month as the position drops out). Sold
    positions still suffer the inflated termination-month read
    until a parallel auto-snapshot on Sell lands, which is not in
    scope here. No changes to the aggregator are required —
    carry-forward already does the right thing once the snapshot
    exists.
  - Go test suite all packages green; golangci-lint 0 issues;
    vitest 164/164; vite build green; ESLint 0 errors (only
    pre-existing bare-JSX-text warnings). Net +148/−22 across 5
    files.

- **Backend `cost_basis` aggregate on investment ListItems (M6,
  backend + frontend — issue #18).** Structural follow-up flagged
  during #14 slice 14c grilling: the list-screen headline P/L needs
  each position's cost basis, but Stock / MutualFund / Gold carry it
  only in the transaction ledger, so 14c worked around it with a
  per-position `useQueries` batch (N parallel fetches per list). This
  folds a derived `cost_basis` decimal into each subtype's `*ListItem`
  so the headline reads a single self-contained number. Implemented as
  a Go ledger replay rather than the SQL avg-cost CTE the issue
  sketched — avg-cost-on-sell isn't trivially expressible in standard
  SQL, and replaying in Go gives **exact parity** with the frontend's
  documented `lib/costBasis.ts` convention (zero divergence to
  document) while matching the existing batch-query idiom in
  `ListStocks`.
  - `backend/queries/investment_transactions.sql` — new
    `ListInvestmentTransactionsByInvestmentIDs :many` (one batched
    fetch of every non-deleted txn across the household-scoped ID set,
    ascending by `investment_id, transaction_date, created_at`). Mirrors
    `ListLatestInvestmentSnapshotsByInvestmentIDs` and skips the
    household JOIN because the caller supplies only IDs already resolved
    by `ListInvestmentsByHousehold`. `sqlc generate` regenerated.
  - `backend/internal/repo/cost_basis.go` (new) —
    `costBasisFromLedger` replays the avg-cost ledger in
    `shopspring/decimal`: buy adds amount + qty, sell reduces cost
    proportionally (`cost*sellQty/qty`, sellQty clamped to held) and
    qty, fee capitalises into cost, coupon/dividend/distribution and
    maturity ignored — the exact rules from `lib/costBasis.ts`.
    `ledgerHasBuy` + `groupTransactionsByInvestment` helpers.
  - The 5 repo `List*` methods set `CostBasis`: Stock / MutualFund /
    Gold replay the ledger; Bond branches `ledgerHasBuy ? replay :
    face_value` (govt-primary bonds book cost as face value, no buy
    txn); TimeDeposit takes `details.Principal` directly with no txn
    fetch (its ledger holds only the terminal Maturity row). New
    `cost_basis` JSON field on all 5 `*ListItem` structs.
  - Per-subtype round-trip tests: a full Stock ledger
    (buy + buy + partial-sell-at-avg + fee → 1,050,000), Gold/MF single
    buys, Bond face_value path, TD principal. Shared `postTxn` +
    `requireCostBasis` test helpers.
  - Frontend: `cost_basis: string` added to all 5 `*ListItem` types
    (`shopspring` decimals serialise as JSON strings here). All 6 list
    screens (`Stocks/MutualFunds/Bonds/TimeDeposits/Golds` +
    `InvestmentsHome`) now source the per-position headline `cost` from
    `Number(item.cost_basis)` instead of replaying transactions — a
    robustness win too: the headline P/L stays correct even if the
    transactions batch errors. The snapshots + transactions batch
    survives only to build the time graph's per-month cost *series*
    (`costBasisSeries` / `flatCostSeries`); dropping it entirely waits
    on a separate monthly cost-basis series endpoint, filed as **#22**.
    `computeCostBasis` import removed where it became unused.
  - All green: backend suite + `go vet` + gofmt; ESLint 0 errors; vite
    build green; vitest 164/164; Playwright E2E 16/16. Net +249/−42
    across 20 files + 1 new.

- **Monthly cost-basis series endpoint — retires the list-screen fan-out
  (M6, backend + frontend — issue #22, the #18 follow-up).** #18 made the
  list *headline* self-contained but the time graphs still plotted a
  per-month cost *line* from each position's full ledger, so
  `useInvestmentBatchTransactions` (+ `useInvestmentBatchSnapshots`)
  lived on as an N-parallel `useQueries` fan-out. This adds a single
  household-scoped endpoint that returns every position's monthly value +
  cost series, and rewires all six list/home screens onto it.
  - `backend/queries/investment_snapshots.sql` — new
    `ListInvestmentSnapshotsByInvestmentIDs :many` (all non-deleted
    snapshots across the household-scoped ID set, ascending by
    `investment_id, year_month`), mirroring the latest-only batch above.
    `sqlc generate` regenerated.
  - `backend/internal/repo/investment_time_series.go` (new) —
    `InvestmentTimeSeries` lists every household investment once, batch
    fetches snapshots + transactions + bond/TD details, and builds per
    position a `value_series` (snapshot amounts) + `cost_series`. Cost is
    sampled **at snapshot months** (`costSeriesAtMonths`) — the exact
    mirror of `lib/costBasis.ts#costBasisSeries` — so every cost point
    shares a month with a value point and the value carry-forward in
    `aggregateMonthly` stays correct. Stock/MF/Gold replay the ledger;
    Bond branches `ledgerHasBuy ? replay : flat face_value`; TD is flat
    principal. `cost_basis.go` refactored to share one `applyLedgerTxn`
    step between the terminal figure (#18) and the series so they can't
    drift.
  - `backend/internal/investments/investments.go` — new
    `GET /investments/time-series` route + `handleInvestmentTimeSeries`
    (a single static segment, no clash with the two-segment `/{id}/…`
    routes). Two handler tests: a full Stock ledger series (Jan buy →
    1,000,000, Feb buy → 1,500,000, carried into Mar) and the TD flat
    principal series.
  - Frontend: new `hooks/useInvestmentTimeSeries.ts` (one
    `['investment-time-series']` query, pre-mapped to a
    `Map<id, {snapshots, costSeries}>`) replaces `useInvestmentBatch.ts`
    (deleted). All five subtype list screens + `InvestmentsHome` drop the
    `useInvestmentBatch*` calls and the per-screen
    `costBasisSeries`/`flatCostSeries`/`computeCostBasis` replay — the
    Bond `hasBuys` branch and the TD `principal`/flat logic move
    server-side. `InvestmentsHome` collapses its five per-subtype loops
    into one `push(items, category)` helper over a shared `HomeListItem`
    shape. Detail screens are untouched and keep `lib/costBasis.ts`.
  - All green: backend suite + `go vet` + gofmt + golangci-lint 0 issues;
    ESLint 0 errors; vite build green; vitest 164/164; Playwright E2E
    16/16.

- **Built-in instruction manual — guided tours on every position detail
  screen (M6, frontend-only — issue #23).** A "Help" button in each detail
  header launches a step-by-step `driver.js` walkthrough that spotlights
  each section with a short, non-technical explanation of what it is and
  how to use it. POC'd on Bonds, then rolled to all 10 position detail
  screens.
  - New `driver.js` dependency (~5kb, no transitive deps). New shared
    `components/HelpTourButton.tsx` takes already-translated `TourStep[]`
    (so it stays i18n-agnostic) and prunes steps whose anchor isn't
    rendered this visit (the chart card needs ≥2 snapshots; the add-row
    actions hide on closed positions) — a pruned step would otherwise pop
    as a stray centered modal. driver's Next/Back/Done/progress chrome
    routes through a new `common:tour.*` namespace; `{{current}}/{{total}}`
    are fed back through i18next as literal values so driver's own
    interpolation leaves them intact.
  - Anchored by `data-testid` (mirrors the E2E convention): `tour-overview`
    (H1), `tour-actions` (header button group, where the Help button also
    lives), `tour-details`/`tour-chart`/`tour-snapshots` cards, and — on the
    5 investment subtypes — `tour-transactions` plus the existing
    `investment-headline` for the cost/P&L step. Non-investment positions
    (bank, property, vehicle, liability, receivable) run a 5-step variant
    (no headline, no transactions).
  - Copy teaches the actual workflow, not just labels: how cost basis & P/L
    derive (ledger replay vs. flat principal/face-value per subtype), how to
    read the value-vs-cost chart, the coupon/fee tallies, and the maturity
    flow. EN + ID for all 10 screens under each domain namespace
    (`investments.{bond,stock,mutualFund,gold,timeDeposit}.tour`,
    `assets.{bankAccount,property,vehicle}.tour`, `liabilities.tour`,
    `receivables.tour`); ID follows `docs/glossary-id.md`. Income is
    deliberately out of scope — it's a flat flow-event, not a position.
  - Surfaced a real accounting bug while writing the bond copy: the #17
    maturity auto-snapshot double-counts the principal in the Dashboard
    investment-return line. Filed as **#25** (Option B — truthful 0-value
    close snapshot) rather than fixed inline; the tour copy stays honest by
    not claiming principal isn't counted until #25 lands.
  - All green: ESLint 0 errors; vite build green; vitest 164/164. Backend
    untouched.

- **Maturity/termination is a truthful 0-value close snapshot (M6, full
  stack — issue #25, fixes the #16/#17 fallout).** Reverses #17's *data*
  approach while keeping its frontend affordances. #17 (added to fix a
  −100% P/L display glitch) wrote a maturity-month snapshot of `principal
  + interest`; with ADR-0008's return formula `Δvalue + cash_out − cash_in`
  that left the `cash_out` payout with nothing to cancel, so the Dashboard
  investment-return line **double-counted the entire payout** (booked 110
  instead of 5 interest on a 100/5 TD). Rolled TDs were worse — old (105) +
  new (~105) both counted that month. Option B from the issue: make the
  *data* truthful, let the unchanged engine run.
  - **Backend.** The Maturity handler now writes a `0` close snapshot
    (amount + accrued) instead of `principal + interest`
    (`investment_transactions.go`). Generalized the rule to **all**
    termination: `UpdateInvestmentLifecycle` (investments only) writes the
    same `0`-value close snapshot in the subtype's shape on a Sell/manual
    terminate, wrapped in a tx with the lifecycle flip — subsuming the
    deferred "auto-snapshot on Sell" item. One rule: *terminate ⇒ 0-value
    close snapshot; proceeds are transactions.* The un-terminate correction
    affordance (ADR-0009) soft-deletes that close so a reactivated position
    carries its last real value, not `0`. The engine needs **no special
    case** — `terminatedBefore` + the return formula were already correct;
    they only broke because #17 fed them a fictional value.
  - **Frontend.** Re-widened the `InvestmentHeadline` short-circuit that #17
    had narrowed to sold-only: matured positions now show "Matured on
    {date}" (presentation reading true status) instead of a naive −100% P/L
    against the `0` close. The detail value-graph drops the trailing `0`
    close point (so the line ends at the last real value, not a crater) and
    marks it Sold/Matured (`SnapshotChart`, new `status` prop threaded from
    the 5 investment detail screens).
  - **Tests.** Engine unit tests for maturity cash_out, rolled TD (no
    double-count), and sold termination — each asserting interest/gain-only
    return and no NW bubble. DB-backed: maturity tenancy tests flipped to
    assert the `0` close; new `TestInvestmentLifecycle_CloseSnapshot` covers
    manual terminate + un-terminate. All green (backend `go test ./...`;
    frontend vitest 164/164, build green).
  - **Docs.** ADR-0008 states the liquidation-to-0 assumption the return
    formula depends on explicitly; ADR-0009 documents the close-snapshot
    rule and reconciles it with the long-standing rejected "$0 snapshot as
    status mechanism" alternative (the `0` here is truthful data for the
    termination month, not the lifecycle mechanism, and carry-forward
    suppression prevents the stale-zero pollution that alternative warned
    of). User-facing: an end-of-month data-entry recommendation in the help
    tour / glossary, since the maturity-month NW dip is real and
    self-corrects once the bank deposit is recorded (ADR-0008 timing noise).

- **Capital at entry is a transaction, never return (M6, full stack —
  issue #27, placement-side mirror of #25).** The entry-side twin of #25:
  deploying capital into a `govt_primary` bond or a time deposit over-stated
  that month's investment return by the **full principal**, because the
  `0 → principal` snapshot jump had no `cash_in` to cancel it under ADR-0008's
  `Δvalue + cash_out − cash_in`. Stocks / MF / gold / secondary-market bonds
  always recorded a Buy; primary bonds and TDs did not. Two fixes, one rule
  (*capital at entry is a `cash_in`, return nets to yield*):
  - **Bonds — placement is a Buy; face value is ledger-derived.** `CreateBond`
    now seeds a placement **Buy** for `govt_primary` from its `face_value` +
    new `placement_date` inputs (IDR-1,000,000 units: `qty = face / 1e6`,
    `price_per_unit = 1e6` at par; secondary-market bonds are not seeded — the
    user records the real Buy). The hand-maintained `bond_details.face_value`
    scalar was **dropped** (migration 00021) — a duplicated source of truth that
    drifts on every buy/sell edit (derive-don't-duplicate, ADR-0003). Outstanding
    nominal now derives from the ledger, `(Σ buy_qty − Σ sell_qty) × 1e6`
    (`outstandingFaceFromLedger`), surfaced as `Bond.outstanding_face` /
    `BondListItem.outstanding_face`; cost basis always replays (every bond has a
    Buy now). The detail-screen Edit dialog drops its `face_value` input;
    `CreateBondDialog` gains a placement-date input (govt_primary only) + a hint
    for secondary. Coupon/display read the derived nominal.
  - **Time deposits — engine-synthesized placement cash_in (option a).** A TD
    records no Buy, so the engine synthesizes the placement `cash_in` from
    `time_deposit_details.principal` at `placement_date` (new fields on
    `reportPosition`, fed by an extended `ListInvestmentsForReport`). No new txn
    type, no migration, no backfill — applies uniformly to every existing TD.
  - **Result.** Placement month nets to `0` return; lifetime return = coupons /
    interest / gain only. Combined with #25, capital is excluded at **both**
    entry and exit. Verified against real dev data: the 17 backfilled primary
    bonds derive `outstanding_face` from their reconstructed Buys, and the
    canonical dev TD (placed 2019-04, principal 12M) now books `0` time-deposit
    return in 2019-04 (was +12M).
  - **Tests.** Engine units: TD placement → 0 + accrued-only thereafter; bond
    placement Buy → 0; two-tranche bond → 0 each tranche month;
    `outstandingFaceFromLedger` across buys/sells. Bond HTTP tests gain
    placement-date + a govt_primary-missing-placement 400; cost-basis assertions
    re-pointed at the ledger. All green (backend `go test ./...` + golangci-lint;
    frontend vitest 164/164, build + ESLint 0 errors).
  - **Docs.** ADR-0008 birth-month note states placement must be a recorded
    (bond Buy) or synthesized (TD) `cash_in`; ADR-0009 gains a "Placement"
    section (Buy-at-placement for bonds, engine-synthesis for TDs,
    face-value-from-ledger) and drops `face_value` from the `bond_details` row.

- **Value-over-time graphs never skip months (M6, frontend — issue #24).**
  Every chart renders on a *categorical* X axis (one tick per data point), so
  any month a series omitted simply vanished from the timeline and the
  remaining points spaced out evenly — a position snapshotted in Jan then Apr
  drew Jan and Apr side by side as if adjacent, and a stretch of empty months
  read as no elapsed time. The series builders were the cause: both
  aggregators (`lib/listAggregates` `aggregateMonthly`,
  `lib/homeAggregates` `aggregateMonthlyByCategory`) walked
  `[...new Set(snapshotMonths)]`, and the per-position detail chart
  (`SnapshotChartImpl.toChartData`) plotted raw snapshots 1:1 — all three
  emitted only months that carried an entry.
  - **Fix.** A shared `lib/months.ts` `monthRange(first, last)` enumerates the
    full inclusive `YYYY-MM` span (year-boundary aware; accepts the API's
    `YYYY-MM-DDT…` shape). The two aggregators now walk that continuous range
    instead of the snapshot-month set — their existing carry-forward cursors
    fill the gap months for free. The detail chart's `toChartData` was
    rewritten to walk the same range, carrying the last known value (and cost)
    forward into gaps — a balance you didn't re-snapshot still held its value,
    it didn't drop to zero. This covers all four converging surfaces: the
    per-position detail charts, the list-screen `ListTimeGraph`, the home
    `CategoryStackChart`, and the dashboard net-worth chart (already continuous
    from the backend materialized report, unaffected).
  - **Matured positions no longer crater the aggregate.** The maturity "trick"
    (drop the synthetic 0-value close snapshot, #25) lived only on the
    per-position detail chart via its `status` prop; the list/home aggregates
    had no status, so the 0-close leaked into the summed line and dipped it to
    0 at the termination month — visible on the TD-list time graph when a TD
    matured. Both aggregators (`aggregateMonthly`, `aggregateMonthlyByCategory`)
    now drop the *zero* close-month snapshot for a closed position, so its last
    real value carries through its termination month, then the existing #21 cap
    removes it the month after. A position whose genuine final value lands in
    its termination month (non-zero) is untouched.
  - **Readable maturity marker + labelled tooltip.** Two `SnapshotChartImpl`
    fixes surfaced while verifying the above. The Sold/Matured `ReferenceDot`
    label sat at the rightmost data point with a default middle anchor, so the
    text was clipped by the chart's right edge (and, at the line's peak, the
    top edge): now `textAnchor: 'end'` extends it leftward into the plot and a
    `marker ? 28 : 12` top margin gives it vertical headroom. The tooltip
    showed bare numbers with no series name — `ChartTooltipContent` renders
    *only* the `formatter` output when one is set, dropping its own label +
    indicator, and the formatter returned just the formatted currency. It now
    returns a full row (colored square + "Value"/"Cost" label + formatted
    amount), so the two lines are distinguishable on hover.
  - **Tests.** New `months.test.ts` (single month, consecutive, gap-fill,
    year crossing, API shape, reversed/malformed bounds). A gap-fill regression
    in `listAggregates.test.ts`: Jan+Apr snapshots → Feb/Mar carried forward.
    The #21 closed-position test updated (termination month now carries the
    last real value, not the 0-close) + a lone-matured-position no-crater case.
    All green (vitest 173/173, build + ESLint 0 errors).

- **Duplicate-matured-TD rollover helper (M6, frontend-only — Q14c-iv).** When a
  TimeDeposit matures with a `rolled_to_new` disposition on its principal and/or
  interest, the rolled funds belong in a fresh deposit — until now the user
  re-keyed every field by hand. A matured TD detail screen now shows a teaching
  callout (sky banner, `Repeat` icon, `data-testid="rollover-callout"`) stating
  the rolled amount and offering **Create rollover deposit**, which opens the
  standard Create-TD dialog pre-seeded from the matured position.
  - **Pure helper.** New `lib/rollover.ts`: `maturityRolloverPrefill(td, txns)`
    finds the (terminal, at-most-one) maturity transaction, sums only the
    rolled portions (`principal_amount` if `principal_disposition ===
    'rolled_to_new'`, plus `interest_amount` if its disposition is rolled),
    and returns `{ rolledAmount, prefill }` — or `null` when nothing rolled
    (pure cash_out) or no maturity txn exists (so the callout never shows on an
    active or manually-sold position). The prefill carries bank/currency/rate/
    term/ownership/risk/description forward, sets `placement_date` = the old
    TD's scheduled `maturity_date` and `principal` = the rolled sum, and
    recomputes the new `maturity_date` via a shared
    `addMonths` (lifted out of the dialog into the same module).
  - **Dialog reuse.** `CreateTimeDepositDialog` gained optional `prefill` +
    `triggerLabel`/`triggerVariant`/`triggerSize` props (the two list-screen
    call sites are unchanged — props default to the primary Create trigger).
    Form state seeds from `{ ...emptyForm(), ...prefill }` and resets to the
    same on close. The form's shape now lives in `lib/rollover.ts` as the
    exported `TimeDepositForm` type so the helper can describe a partial of it.
  - **i18n + tests.** New `timeDeposit.rollover.{calloutTitle,calloutBody,
    calloutAction}` EN+ID (ID: "digulung ke deposito baru", aligning with the
    `disposition.rolledShort` glossary term). `rollover.test.ts` (7 cases):
    addMonths math + the four roll combinations (both/principal-only/
    interest-only/none) + no-maturity-txn. vitest 180/180, build + ESLint 0
    errors. Backend untouched.

- **Aggregate graph: closed positions end before their termination month
  (M6, frontend-only — refines #24/#21 for the rollover seam).** Verifying the
  first real rolled-over TD pair (R0 matured + rolled → R1 placed the *same*
  month) surfaced a one-month spike on the list/home time graphs: #24 dropped a
  closed position's synthetic 0-close (#25/#27) and carried its last real value
  *through* its termination month, so at a rollover seam both the predecessor
  (carried) and the successor (real) landed in the same month — e.g. R0 24.0M +
  R1 24.576M = 48.576M, when the household only ever held ~24.5M. The detail
  chart never had this (it ends a closed position at its last real snapshot +
  a Sold/Matured marker), so the two surfaces also disagreed.
  - **Fix (chosen over a rollover-disposition-aware branch).** Both aggregators
    (`lib/listAggregates` `aggregateMonthly`, `lib/homeAggregates`
    `aggregateMonthlyByCategory`) now treat a closed position as held only
    *through the month before* `terminated_at`. A `live(m) = m < termMonth`
    filter drops the termination month from each position's month set (so a
    *lone* closed position no longer extends the timeline into its 0-close
    month and crater to 0 there), and the walk-time cap tightened from
    `month > termMonth` to `month >= termMonth` (so a carried value can't leak
    into the termination month when *another* position extends the range). The
    whole 0-close-detection block is deleted — with #25/#27 the termination
    month's snapshot is always the 0-close anyway, so excluding it loses
    nothing real. This unifies the aggregate with the detail chart and matches
    the app's month-end snapshot semantics (a position paid out by month-end
    isn't held at that month-end).
  - **Tests.** New `does not double-count a same-month rollover seam` case
    mirrors the real R0→R1 data (seam month shows R1 only). The #24/#21
    closed-position cases updated to Option A (closed contributes through the
    month before termination, then drops; lone-matured still no-craters because
    its termination month leaves the range entirely). vitest 181/181, build +
    ESLint 0 errors. Backend untouched.

- **Suppress the rollover callout once a successor exists (issue #29 — explicit
  FK).** The matured-TD "Create rollover deposit" callout (Q14c-iv) kept showing
  after the user had already created the successor, nagging them to make a
  deposit that exists and inviting duplicates. The blocker was that nothing
  linked a rolled-over deposit back to its source, so there was no signal to
  gate on. Of the four candidate directions in the issue, we took **option 1
  (explicit link)** — the model-correct one, which also seeds a future
  R0→R1→R2 chain view. Accepted scope: a successor created *by hand* (not via
  the helper) stays unlinked and still prompts; only helper-created successors
  carry the back-reference.
  - **Schema.** Migration 00022 adds a nullable self-referential
    `investments.rolled_from_investment_id uuid REFERENCES investments(id)` —
    on the shared `investments` table (per ADR-0022, mirroring the
    `risk_profile` precedent in 00018). `CreateInvestment` gains the column;
    new `GetRolloverSuccessor` query returns `{id, display_name}` of the live
    investment rolled from a given id (household-scoped, `LIMIT 1`).
  - **Backend.** `CreateTimeDepositParams.RolledFromInvestmentID *uuid.UUID`
    threads from the `createTimeDepositReq` JSON field through to the insert.
    Belt + suspenders: the create path verifies the source belongs to the
    caller's household (`GetInvestmentByID` inside the tx) before linking, so a
    crafted id can't touch another household's deposit — returns `ErrNotFound`
    on a cross-tenant source. `GetTimeDeposit` resolves both immediate
    rollover-chain neighbours into a new `RolloverRef {ID, DisplayName}` —
    `RolledFrom` (from the stored `rolled_from_investment_id`, via
    household-scoped `GetInvestmentByID`) and `RolledTo` (via
    `GetRolloverSuccessor`); a dangling/cross-tenant/soft-deleted source
    resolves to nil rather than erroring. A non-nil `RolledTo` is what
    suppresses the callout.
  - **Frontend.** `Investment.rolled_from_investment_id` + a new
    `RolloverRef` type + `TimeDeposit.rolled_from` / `rolled_to` added to the
    wire types. `maturityRolloverPrefill` short-circuits to `null` when
    `rolled_to` is set (one guard at the top — every existing roll case is
    unchanged). `CreateTimeDepositDialog` gained a `rolledFromInvestmentId`
    prop, sent as `rolled_from_investment_id` on create; the callout passes
    `td.investment.id`. `useCreateTimeDeposit`'s `onSuccess` now also
    invalidates `['time-deposits', <source id>]` when the payload carries the
    link, so the source detail refetches and the callout disappears without a
    manual reload.
  - **Rollover card (chain view, "while here" follow-on).** TD detail screen
    gains a dedicated **Rollover** card (`data-testid="rollover-card"`, only
    rendered when a neighbour exists) showing the immediate neighbours: an
    up-arrow "Rolled over from" line linking the predecessor and a down-arrow
    "Rolled over into" line linking the successor (each a button →
    `onSelectTimeDeposit`, a new router-unaware callback bridged in `App.tsx`
    to `nav(routes.timeDeposit(id))`); the absent side shows a muted "—" /
    "Not yet". Scope is immediate neighbours only — you click through to walk
    a longer chain. New `timeDeposit.rolloverChain.*` keys EN+ID (ID:
    "Gulungan", "Digulung dari/ke", glossary-aligned).
  - **Tests.** New `rollover.test.ts` case (successor present → null). New
    repo tenancy subtest: source reports no `RolledTo` → bob's cross-tenant
    link rejected with `ErrNotFound` → alice's link succeeds and round-trips
    the FK → source resolves `RolledTo` to the successor and the successor
    resolves `RolledFrom` back to the source → cleanup. vitest 182/182,
    backend suite + golangci-lint green, vite build + ESLint 0 errors.

- **Faster dev-server restart (issue #30).** `make restart` (and the per-side
  `backend-restart` / `frontend-restart`) dropped from ~3s of blind `sleep 1`s
  to ~1.6s, and now blocks on *actual* readiness rather than a fixed delay that
  didn't even guarantee the server was up.
  - **Diagnosis.** Measured each stage: warm `go build` is 0.1–0.5s, and both
    servers reach ready ~0.3s after spawn (backend = migrations + OIDC discovery
    + pgxpool; frontend = vite). So neither `go run` nor the 10s graceful-shutdown
    timeout was the cost — in dev `http.Server.Shutdown` returns instantly (no
    connections draining). The entire delay was three hardcoded `@sleep 1`s
    (backend-stop, backend-start, frontend-start).
  - **Stops wait for exit, not a clock.** `backend-stop` / `frontend-stop` poll
    `pgrep` until the process is actually gone (cap 5s), then escalate to
    `pkill -9` — so a slow graceful drain is tolerated without a fixed penalty,
    and a wedged process is still killed.
  - **Starts poll for readiness.** `backend-restart` polls
    `curl /healthz` on `$(BACKEND_PORT)` (new Makefile var, `$(or $(PORT),8080)`);
    `frontend-restart` truncates the log then greps for vite's `Local:` line
    (port-agnostic). Both cap at 10–15s.
  - **Adjustable grace period.** Per the issue's literal ask, the previously
    hardcoded `10*time.Second` shutdown timeout in `cmd/balances/main.go` is now
    `cfg.ShutdownTimeout`, a new `SHUTDOWN_TIMEOUT` config field
    (`envDefault:"10s"`). Doesn't change dev speed (Shutdown already returns
    instantly there) but lets a deploy tune drain time without a recompile.
  - **Detached the bg jobs from the caller's stdout.** Separately surfaced while
    testing: when `make restart` runs with its output *piped* (a captured
    subprocess — e.g. an agent's shell tool, `make restart | tee`), the command
    appeared to hang for minutes even though the Makefile finished in ~1.3s. The
    old `nohup cmd > LOG 2>&1 &` reassigned the *job's* fd1/fd2 to the log, but
    the recipe **sub-shell** wrapping it kept fd1 = make's inherited stdout. Piped,
    that's the pipe's write-end, and it stays open as long as the server runs — so
    the pipe reader never gets EOF and blocks until the server dies. (Interactive
    terminal use never showed it: fd1 there is the tty, not a pipe.) Fix: wrap each
    start in `( cd DIR && exec nohup CMD ) > LOG 2>&1 < /dev/null &` so the
    redirection covers the whole sub-shell and `exec` leaves no extra shell layer
    holding the descriptor. `lsof` confirms every lingering bg process now has
    fd1 → its log, never a pipe; `make restart | cat` returns in ~0.6s.
  - **`nohup` retained, deliberately.** The group redirect alone would drop SIGHUP
    protection, so the dev servers would die when the terminal that launched them
    closed. `exec nohup CMD` keeps it: `nohup`'s `SIGHUP=SIG_IGN` is preserved
    across `go run`'s fork+exec down to the real server binary (verified by sending
    SIGHUP directly to the listening pid — server survived). Because the group
    redirect already points stdout at a regular file, `nohup` writes no stray
    `nohup.out`.
  - **Verified.** `make restart` → ~1.3s wall (piped, ~0.6s); `/healthz` 200 +
    frontend 200 afterwards. Backend suite + golangci-lint (`0 issues`) green;
    backend builds.

- **Mutual-fund fund type (issue #20).** Mutual funds now carry a `fund_type`
  classification, recorded on create/edit and shown on the list.
  - **Global, not Indonesia-only.** The user asked to generalise past the local
    reksa dana set. Researched the industry taxonomy: the four universal
    ICI/Morningstar top-level asset classes (money market, fixed income / bond,
    equity / stock, mixed / hybrid·balanced·allocation) are the cross-market
    core; on top of them sit the structural wrappers a household actually names —
    index funds, ETFs, target-date / lifecycle funds, commodity funds. `other`
    absorbs the niche tail (municipal/tax-exempt, alternative/hedge, sector).
    Final enum: `money_market | fixed_income | equity | mixed | index | etf |
    target_date | commodity | other`. Syariah/ESG are an orthogonal *flavour* of
    each type, never a type — kept out of scope as a possible future flag.
  - **Schema (migration 00023).** Closed enum enforced by a `CHECK` on
    `mutual_fund_details`, **not** the shared `investments` table — subtype-
    specific data lives in `*_details` per ADR-0022 (mirrors `gold_details.form`).
    Column lands `NOT NULL` in one pre-alpha step; existing rows backfill to
    `other` (no neutral default exists, unlike risk_profile's `medium`).
  - **Backend.** `queries/mutual_funds.sql` Create/Update gain the column; sqlc
    regen; repo `Create/UpdateMutualFundParams` + handler `create/updateMutualFundReq`
    carry `fund_type` with `validate:"required,oneof=…"` (the nine values). Forces
    a deliberate choice on create, like risk_profile. Handler tests assert the
    round-trip + reject an out-of-enum value (`crypto` → 400); tenancy test updated.
  - **Frontend.** New `MutualFundType` union + `fund_type` on `MutualFundDetails`
    and both payloads. New `MutualFundTypeSelect` (required, no default; placeholder
    "— select —"; options in DB-CHECK order), wired into the Create and Edit
    dialogs, parent refuses submit until chosen. `MutualFundListRow` renders the
    short type label as a muted chip in the Name column (`data-testid="mf-fund-type"`),
    satisfying the issue's "same column as Name". EN/ID
    `mutualFund.fundType.{selectLabel,selectPlaceholder,option.*,short.*}` populated
    (ID from the finance glossary: Pasar uang / Pendapatan tetap / Saham / Campuran
    / Indeks / ETF / Target waktu / Komoditas / Lainnya).
  - **Verified.** Backend suite green (real Postgres round-trip via the handler
    harness); `tsc` clean, eslint 0 errors, vite build green, vitest 182/182.

- **Position-control buttons: relocate + tighten (issue #31).** Two passes, frontend-only.
  - **Relocation (#31).** The per-position **Add Snapshot** + **Import** controls moved off the
    detail-screen top-right action cluster into the **snapshots-card header** (right-aligned),
    mirroring the transactions card that already hosted its create buttons there. Top-right now
    carries only Help / Edit / Close / Delete. Applied to all 10 detail screens (bank account,
    property, vehicle, liability, receivable + stock, mutual fund, gold, bond, time deposit);
    `isActiveStatus` gating preserved. Guided-tour steps repointed: the `actions` step (now
    spotlighting the management buttons) rewritten to "Manage this position" (Edit / Close /
    Delete), and the `snapshots` step body folded in the add/import guidance it gained — 10
    subtypes × EN/ID.
  - **Terser labels + icons (follow-on).** Every create/manage button shortened and given a lucide
    icon (matching `HelpTourButton`'s `mr-1 size-4` pattern): snapshot `+ New snapshot` → **New**
    (`Plus`), `Import from spreadsheet` → **Import** (`Upload`), terminate `Close position` →
    **Close** / `Edit status` → **Status** (`Archive`), detail-screen **Edit** (`Pencil`) /
    **Delete** (`Trash2`); the literal `+ ` prefix dropped from all 7 transaction triggers (uniform
    `Plus`) and all 11 list-screen create buttons (noun kept, e.g. **New bank account**). Both
    locales. Icons render as `<svg>` with no accessible name, so role-name lookups are unaffected.
  - **Copy alignment.** Tour `actionsBody`/`snapshotsBody` and the per-group `snapshotsEmpty`
    empty-state copy that *name* the buttons repointed to the new labels (`“New”` / `“Import”` /
    `“Close”`; ID `“Baru”` / `“Impor”` / `“Tutup”`), EN+ID. Terminate dialog headings
    (`closeTitle`/`editTitle`) left descriptive — they're modal titles, not button references.
  - **E2E.** 12 specs' role-name selectors updated to the new labels; the two generic terminate
    names made `exact` to dodge Radix Dialog's `aria-label="Close"`. Surfaced a pre-existing gap:
    `bond-snapshot.spec` never filled the **Placement date** field that issue #27 made `required` on
    bond create, so `Create` silently no-op'd — Playwright isn't in CI (go test + lint + build
    only), so it went unnoticed since #27. Added the missing fill.
  - **Verified.** `tsc` clean, eslint 0 errors, vite build green, vitest 182/182, Playwright 16/16.
    ~54 files; backend untouched.

- **Fee cash→quantity helper (Q12, M6).** A unit-settled fee removes units from the position at a
  conversion price, so `cash_amount = quantity_deducted × price_per_unit` — three dependent values
  the owner previously had to divide by hand. New pure `lib/feeQuantity.ts` (`deriveFeeQuantity`,
  6 unit tests) computes `quantity = amount ÷ price` to 8dp (DECIMAL(20,8)), returning `null` on
  blank/non-numeric/≤0 inputs so the call site renders nothing.
  - **Dialogs.** `Create/EditFeeTransactionDialog` reordered the unit-fee row to read as a
    calculator — **Cash amount** (top), then **Conversion price** → **Units deducted** — and
    auto-fills the units field via a `patch()` change-handler (computed inline, *not* a `useEffect`
    on the mutation-bearing form, per the deps-array render-loop gotcha). The derive is
    non-destructive: a `qtyTouched` flag latches once the user types into the units field and stops
    the auto-fill thereafter. Edit seeds `qtyTouched` from `transaction.quantity` so an existing
    saved unit figure is never clobbered; the helper only kicks in for fees that had no units. A
    muted `fee.derivedHint` line ("Auto-filled from cash ÷ price. Edit to override.") shows while the
    field is auto-managed. The pure-cash fee (both fields blank) and the existing
    quantity+price-must-pair validation are unchanged.
  - **Verified.** vitest 188/188 (+6), eslint 0 errors on touched files, vite build green. The
    pure-cash `dividend-fee.spec` path is unaffected (price blank → no derive; fills by label, not
    position). Frontend-only; backend untouched. Closes the Q12 M6 line.

- **E2E coverage for the help tours (issue #26, closes it).** New `e2e/tour.spec.ts` — 5 specs that
  drive the driver.js guided tours (#23) through the real UI, exercising the two structural variants
  (non-investment bank account = 5 steps, investment bond = 7 steps incl. `investment-headline` +
  `tour-transactions`). The deferred case list from #26 maps to:
  - **Launch + navigate.** `data-testid="help-tour"` opens the overlay on step 1; Next advances,
    Back returns, the last step swaps Next → Done and clicking it closes the popover. Progress text
    asserted as `current of total` at each step.
  - **Anchoring.** A shared `expectStep` helper asserts, per step, the popover title, the progress
    text, and that driver.js stamped `driver-active-element` onto the step's anchor element — i.e.
    the popover attached to the right `data-testid` (`tour-overview`/`-actions`/`-details`/`-chart`/
    `-snapshots`/`-transactions` + `investment-headline`). Reads driver's portal-rendered text +
    role="dialog", never a fixed DOM position (per `e2e/README.md`).
  - **Step pruning.** Chart step skipped with < 2 snapshots (total drops to 4; the `Balance over
    time` title — exact-match, since the overview body copy contains the phrase — never appears). On
    a **closed** position the per-card New/Import buttons hide but the header `tour-actions` group
    survives, so its step still anchors.
  - **Locale.** Tour renders EN by default (the en-GB pin), then ID after toggling the
    `settings-language-select` dropdown — chrome (`Lanjut`/`1 dari 4`) + a body string asserted.
    Waits on the `PATCH /api/me` before the reload so `useLocaleReconcile` reads `id-ID` and doesn't
    revert; restores en-GB at the end (waited on too) so later specs stay English.
  - **Verified.** `make e2e` 21/21 green (5 new), tsc + eslint clean. Out of the coverage metric
    (behavioural net, ADR-0021). Frontend-only.

- **Theme switcher (M6, full stack — issue #33).** Per-user light/dark, persisted server-side so it
  follows the user across devices. Deliberately a mirror of the locale stack (ADR-0026) at every
  layer, so it reads as boringly consistent rather than a second bespoke preference mechanism.
  - **Backend.** Migration 00024 adds `users.theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN
    ('light','dark'))` — the default matches the dark-only status quo; the browser-preference bias is
    a client concern (see reconcile). New `UpdateUserTheme` query mirrors `UpdateUserLocale`
    (self-attributed, `updated_by = id`). `meResponse` gains `theme`; `handleUpdateMe` gains a
    `theme` branch mirroring the `locale` branch (null/wrong-type → 400 `{field:"theme",
    rule:"required"}`, off-enum → `{rule:"oneof"}`), guarded by a `supportedThemes` map that mirrors
    the CHECK and the FE constant. `CreateUser` unchanged — the column default covers new rows.
  - **Frontend `src/theme/`** (mirrors `src/i18n/`). `index.ts`: `SUPPORTED_THEMES`, `applyTheme`
    (toggles the `dark` class on `<html>`), `resolveBootTheme` (localStorage → prefers-color-scheme →
    dark), and the `ThemeContext`. `ThemeProvider` holds the active theme (init from
    `resolveBootTheme`) and is the single writer — `setTheme` persists to localStorage, toggles the
    class, and re-renders consumers. `useTheme` reads the context. `useThemeReconcile` mirrors
    `useLocaleReconcile` with prefers-color-scheme in place of navigator.language: on first login
    (localStorage empty) it biases to the OS appearance and PATCHes it; thereafter it trusts
    `user.theme`.
  - **No-flash boot.** `index.html` drops the hardcoded `class="dark"` and runs an inline
    synchronous script (same precedence as `resolveBootTheme`) before first paint; the React
    `ThemeProvider` re-reads the same sources so its initial state matches — no flip-on-hydrate.
  - **Settings + logo.** A `ThemeCard` (Appearance) sits next to `LanguageCard`, same two-option
    `<select>` shape (`data-testid="settings-theme-select"`), optimistic `setTheme` + `PATCH`.
    `AppLogo` drops its `theme` prop and reads `useTheme()` directly, so the light wordmark now goes
    live with the light palette. `settings` catalog gains a `theme` block (EN + ID).
  - **Verified.** Backend `go test ./...` green (3 new `TestHandleUpdateMe` subtests + a combined
    nickname/locale/theme case); migration applied to dev DB (v24), backend restarted, `/api/me`
    serving 200 with the new field. Frontend tsc + build clean, eslint 0 errors, vitest 188/188. New
    `e2e/theme.spec.ts` (mirrors `nickname.spec.ts`, self-cleaning back to dark) — full `make e2e`
    left for the user to eyeball.

- **Logo / brand mark (M6, frontend + docs).** First real visual identity for the app.
  - **Concept.** A *balance scale* read three ways at once: a fulcrum **dot** = the monthly
    **snapshot** (a point in time, not a transaction stream — the app's defining non-feature); a
    **beam** with two hanging **stacks** where assets (left, indigo, taller) outweigh liabilities
    (right, slate, shorter); the stacks double as **bar-chart** bars. Honours the project
    constraints: non-technical audience (legible, no jargon), multi-currency (no currency glyph),
    Indonesian-retail-neutral, and **no red/green** coding (liabilities aren't "bad", receivables
    exist) — colour-blind safe. Indigo `#6366F1` accent is **constant across themes**; only the ink
    (post/beam/hangers) swaps light↔dark.
  - **Assets (`docs/brand/svg/`).** `icon-plated.svg` (256, full mark on navy plate, app/PWA/OS),
    `favicon.svg` (64, **simplified** to one bar per side so it survives 16px), `glyph-light/dark`
    (170×163, transparent, theme-tuned), `wordmark-light/dark` (284×88). Wordmark is **IBM Plex Sans
    700, tracking −40, outlined to `<path>`** — zero font dependency (no `<text>`/`font-family`), so
    it renders identically everywhere. IBM Plex is OFL; outlines in a logo carry no legal obligation,
    but add `frontend/licenses/IBMPlexSans-OFL.txt` as courtesy attribution if/when desired.
  - **Reproducible, not hand-drawn.** `docs/brand/gen.py` + `outline.py` generate every SVG from a
    256 design grid + the pinned font instance; full recipe + colour tokens + geometry in
    `docs/brand/logo.md`. The variable font (`IBMPlexSans-var.ttf`, fetched from google/fonts) and
    the derived `wordmark_path.json` are gitignored.
  - **Wired in (dark-only for now).** New `AppLogo` component (imports both theme variants, `theme`
    prop defaults to `'dark'`, since `index.html` hardcodes `<html class="dark">`) replaces the text
    brand in the **sidebar header**, the **mobile top bar** (`AppShell`), and the **sign-in card**
    (`SignInScreen`). `public/favicon.svg` replaced. Per-user theme switching — at which point the
    light variants go live via a `useTheme()` hook mirroring `useLocale` — is **issue #33**.
  - **Verified.** vite build + tsc green, eslint 0 errors (13 pre-existing bare-JSX warnings in
    unrelated files), vitest 188/188. No e2e locator referenced the removed brand text; full `make
    e2e` left for the user to eyeball. Frontend + docs only; backend untouched.
- **Gold buyback-price valuation convention (M6, frontend + docs — issue #19).** Gold trades on a
  bid/ask spread (dealer sells high, buys back low). The decision — settled with the user — is that
  gold valuation **snapshots mark at the buyback price** (what it cashes out for today), so net worth
  is realisable, never optimistic. The spread surfaces as an honest immediate unrealised loss after
  purchase.
  - **No schema change, no backend change.** The two prices already live in the ledger: a Buy stores
    `price_per_unit` = the selling price paid, a Sell stores the buyback received — so realised P/L is
    already spread-correct via ADR-0008's `Δvalue + cash_out − cash_in`. The only open question was
    the periodic snapshot's mark, now a UI-enforced convention.
  - **Frontend.** `Create{QuantityPriceSnapshot,TradeTransaction}Dialog` gain an optional `priceHint`
    prop (full-width muted line below the Quantity/Price grid — kept out of the price *cell* so the
    two inputs stay aligned). `GoldDetail` wires three gold-only hints: snapshot → "use the buyback
    price"; Buy → "dealer's selling price (higher)"; Sell → "buyback price you received". Stock / MF /
    bond pass nothing → dialogs render unchanged. New keys `gold.{snapshotPriceHint,buyPriceHint,
    sellPriceHint}` EN+ID; the gold help-tour `snapshotsBody` gained a buyback sentence.
  - **Docs.** ADR-0009 grows a "Gold marks at the buyback price (issue #19)" section recording the
    decision, the spread mechanics, and the two rejected alternatives (second price column; snapshot-
    at-selling-price-then-fee-on-sale). `docs/glossary-id.md`: Selling price → Harga jual, Buyback
    price → Harga buyback.
  - **Edit dialogs intentionally unchanged** — correcting a stored figure is not the teaching moment;
    the hint lives where the monthly which-price decision is made (the Create dialogs).
  - **Verified.** eslint 0 errors (13 pre-existing warnings, none in changed files), vite build green,
    vitest 188/188. Playwright not re-run (gold-tour copy grew) — left for the user to eyeball.

- **Security CI layer (M6, CI/infra).** Added three GitHub-native security tools on top of the
  existing lint/test/coverage pipeline, scoped deliberately at "what a public financial app's threat
  surface actually needs" rather than more lint (SonarQube was evaluated and declined — heavy overlap
  with golangci-lint/eslint, and its quality-gate would compete with the existing `ci-gate` +
  Codecov). The full considered/deferred record lives in `docs/ci-tooling.md`, flagged for
  reassessment before alpha.
  - **CodeQL (`.github/workflows/codeql.yml`).** SAST for Go *and* TS/JS via a 2-language matrix
    (`go` build-mode `manual` → setup-go + `go build ./...`; `javascript-typescript` build-mode
    `none`). Runs per-PR/push + a weekly Monday cron so query-pack updates re-scan unchanged code.
    Own workflow (not folded into `ci.yml`) because it needs `security-events: write`. Free for
    public repos; would need GitHub Advanced Security if the repo ever goes private.
  - **govulncheck (`backend-vuln` job in `ci.yml`).** Reachability-based Go vuln scan, path-gated on
    `backend/**` and wired into the `ci-gate` aggregator so a reachable vuln blocks merges. First run
    immediately earned its keep: **7 reachable vulns** — 2 stdlib (`net/textproto`, `crypto/x509`)
    and 5 in `golang.org/x/crypto@v0.50.0` (the latter all reached only via `internal/testutil/db.go`
    → testcontainers → ssh, i.e. test-only). Fixed by bumping `golang.org/x/crypto`→**v0.52.0** and
    the go directive `1.25.7`→**1.26.4** (vuln DB lists backports at 1.25.11 / 1.26.4; chose the 1.26
    line to match the toolchain already running locally). Post-fix: `No vulnerabilities found`,
    `go build ./...` green, full `-race` suite green, golangci-lint v2.12.2 0 issues.
  - **Dependabot (`.github/dependabot.yml`).** Weekly update PRs + security alerts across all three
    ecosystems: `gomod` (backend), `npm` (frontend, dev-deps grouped into one PR), and
    `github-actions` — the last so the Actions versions stay current (and would feed SHA-pinning if
    that deferred item is later adopted).

## What M4.2 shipped

Code lives where you'd expect from the M4.1 pattern. Specifics worth knowing:

**Backend**
- `backend/internal/migrations/00005_liabilities_receivables.sql` — 4 new tables. Liabilities carry
  the `subtype` enum (`personal` | `institutional`) and inline metadata (counterparty, principal,
  rate, term, dates). Receivables have no subtype, just counterparty + due_date. Both use the
  amount-shape snapshot table per ADR-0022.
- `backend/queries/{liabilities,liability_snapshots,receivables,receivable_snapshots}.sql` — full
  CRUD plus batch latest-snapshot joins for list views. Snapshot queries always JOIN the parent
  table with `household_id = $X` for belt+suspenders tenancy enforcement.
- `backend/internal/repo/{liabilities,receivables}.go` — `LiabilityRepo` and `ReceivableRepo` with
  full CRUD + snapshot CRUD. Each is its own struct; they do **not** share helpers with `AssetRepo`
  beyond the package-private `currentUser` helper.
- `backend/internal/{liabilities,receivables}/` — HTTP packages mounted under `/api/liabilities` and
  `/api/receivables`, each with `/{id}/snapshots/*` sub-routes.

**Frontend**
- Snapshot UI **lifted** to be group-agnostic. `CreateSnapshotDialog`, `EditSnapshotDialog`, and
  `SnapshotRow` accept `useMutation` results as props (`mutation`, `updateMutation`,
  `deleteMutation`) instead of calling group-specific hooks internally. **Each detail page now owns
  its own create/update/delete snapshot mutations and passes them down.** This is the key refactor
  that lets us avoid `LiabilitySnapshotRow` / `ReceivableSnapshotRow` duplication.
- `BankAccountChart` renamed to **`SnapshotChart`** and its prop type generalised to `{year_month:
  string; amount: string}[]`. All five detail pages share it.
- New hooks: `useLiabilities`, `useLiabilitySnapshots`, `useReceivables`, `useReceivableSnapshots`.
  Mutation `onSuccess` handlers invalidate both the list key (`['liabilities']` or
  `['receivables']`) and the snapshot key (`['liability-snapshots', id]` etc).
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
  three subtypes, the subtype guard between them, snapshot tenancy, alice-side happy-path CRUD, and
  a separate `TestInvestmentRepo_SnapshotShapeValidation` exercising the repo's shape XOR.

## What M4.3a-frontend shipped

- `frontend/src/hooks/useInvestments.ts` — per-subtype CRUD (stocks / mutual-funds / golds) against
  `/api/investments/*`. Each subtype has its own list/detail/create/update/delete hooks; list
  queries cache under `['stocks']`, `['mutual-funds']`, `['golds']`.
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
  enum `auto_renew_principal|auto_renew_with_interest|no_rollover`). No new indexes (deferred per
  the spec grilling — M4.2 precedent).
- `backend/queries/{bonds,time_deposits}.sql` — Create/Get/List-by-IDs/Update on each details table.
  No detail-table soft-delete; parent's `softDeleteInvestment` cascades.
- `backend/internal/repo/{bonds,time_deposits}.go` — `CreateBond` / `CreateTimeDeposit` (txn-wrapped
  parent + details), `Get/Update/Delete` with subtype guard mirroring stocks/golds.
  `validateInvestmentSnapshotShape` already covered `bond` and `time_deposit` since M4.3a; no change
  needed in `investments.go`.
- `backend/internal/investments/{bonds,time_deposits}.go` — HTTP handlers mounted under
  `/api/investments/bonds` and `/api/investments/time-deposits`. `maturity_date` / `placement_date`
  accepted as `YYYY-MM-DD` strings; Go-side `time.Parse` rather than relying on validator.
- `backend/internal/repo/investments_tenancy_test.go` — extended to five subtypes. New subtests
  cover bond/time_deposit list isolation, bob get/update/delete on each, subtype guard from bond →
  stock/time_deposit, alice happy-path update + delete on bond + TD.
  `TestInvestmentRepo_SnapshotShapeValidation` now exercises the accrued-interest XOR branch
  (missing accrued rejected, quantity+price rejected, accrued-only accepted).

## What M4.4 shipped

**Backend**
- `backend/internal/migrations/00010_investment_transactions.sql` — single `investment_transactions`
  table with a `transaction_type` enum and a CASE-driven CHECK enforcing type→shape (Buy/Sell need
  amount+quantity+price; Coupon/Dividend/Distribution need amount; Fee needs amount, optional paired
  quantity+price; Maturity needs principal+interest+both dispositions). Two indexes: `investment_id`
  and `(investment_id, transaction_date DESC)`.
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
  Sell/Coupon/Dividend/Distribution in → emerald, Maturity → emerald cash-out portions, "rolled"
  when both portions roll). Subline under Type shows shape-specific details (qty×price, P/I +
  disposition badges, etc.).
- `frontend/src/lib/reconciliation.ts` — `reconcileQuantity(latestSnapshot, transactions)` returns
  `{ expected, actual, matches }` for Stock/MF/Gold detail pages. Display-only soft warning; not
  enforced.
- All 5 detail pages
  (`StockDetail`/`MutualFundDetail`/`BondDetail`/`GoldDetail`/`TimeDepositDetail`) gained a
  Transactions Card below Snapshots, with subtype-appropriate "+ Type" buttons, a separate
  transaction-page state (PAGE_SIZE = 12, same as snapshots), and a row layout (Date / Type / Cash
  impact / Notes / Actions).

## M4.4 design decisions (settled during the pre-implementation grilling)

The architectural core of these is captured in **ADR-0023** (investment transaction table strategy:
single polymorphic table, type→shape CHECK, subtype→type matrix in the repo). The tactical decisions
below sit on top of that ADR.


1. **Single polymorphic `investment_transactions` table** with type enum + nullable per-shape
   columns + DB-level CHECK on type→shape (mirrors `investment_snapshots` per ADR-0022). Per-type
   tables were rejected — chronological "all transactions for instrument X" queries are natural in
   one table; cross-type sqlc queries would be 7-way UNIONs.
2. **TimeDeposit gets Maturity only.** Initial placement lives in `time_deposit_details.principal`
   via the Create dialog; no redundant "Buy" placement transaction. Bond gets the full set (Buy +
   Sell
+ Coupon + Fee + Maturity) because secondary-market trades exist.
3. **Bond face_value stays as total** (not per-lot). Deepening to lots was deferred — current schema
   is sufficient for snapshot-shape tracking; revisit if a real reconciliation need surfaces.
4. **Reconciliation is display-only.** A snapshot quantity that disagrees with `Σ(Buys.qty) −
   Σ(Sells.qty) − Σ(Fees.qty_deducted)` shows a soft amber warning on the detail page. Statements
   remain the source of truth (ADR-0003 philosophy). No write-time block.
5. **transaction_type is immutable post-create.** Changing it would invalidate the shape; users
   delete + re-create instead.
6. **One Trade/CashIncome dialog handles multiple types via a `txnType` prop** rather than splitting
   Buy/Sell or Coupon/Dividend/Distribution into separate files. Fields are identical within shape;
   the title/verb pivots on the prop. Honours "name by shape, not by group" by analogy.
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
  override (banks sometimes nudge for holidays). Rollover-policy picker has a one-line helper
  caption.
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
6. **Snapshot `amount` is dirty for the accrued-interest shape** — for Bond/TimeDeposit, `amount` is
   the total position value (already includes accrued interest); `accrued_interest` is a *breakdown*
   column for income-tracking visibility and is never additive at aggregation time. Documented in
   ADR-0022 and CONTEXT.md (the Snapshot definition).
7. **Floating-rate bonds (SBR, ST) use a plain `coupon_rate` field** — the user edits it on each
   rate reset. No structured rate_type / spread / base model; KISS, defer until UI needs filtering
   or display badges.
8. **Early TimeDeposit withdrawal folds into the `sold` status** — `sold` is the generic "fully
   exited before scheduled term" outcome per CONTEXT.md; the frontend renders a subtype-aware label
   ("Withdrawn early" for TD).



## Deferred backlog — full original detail at relocation (includes since-resolved items)

- Property/vehicle amortization-rate UI helper (Q8a)
- Fee cash→quantity helper (Q12, lands in M4.6 with Transactions)
- TimeDeposit "duplicate matured TD" helper (Q14c-iv, M4.6)
- ~~Side-by-side multi-currency dashboard view (Q15c, M5)~~ **DONE** — headline-only `≈` projection;
  see the "M5 COMPLETE" entry above
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
  the `/me` test; vitest `names.test.ts` (5) + `ownership.test.ts` nickname cases (52 total).
  Backend suite + golangci-lint clean; frontend lint+tsc+build clean. **Not e2e-smoke-tested** (no
  Playwright spec added; Google-OAuth-only — eyeball the Settings card + an owner picker on the dev
  server).
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
  **Required-check gotcha**: if branch protection is ever enabled requiring these jobs, a skipped
  job blocks merges (GitHub treats skipped ≠ success). Fix is a `ci-gate` aggregator job with `if:
  always()` that depends on the three, succeeds when each is success-or-skipped, and is the only
  required check. No branch protection today, so low risk now — but structure with the aggregator
  from day one to avoid retrofitting. Codecov caveat: `fail_ci_if_error: true` is fine when backend
  job skips (no run = no missing-report complaint), but if a Codecov status check is later wired
  into branch protection, same skipped-≠-success problem applies.

- ~~**Frontend unit tests (vitest) + Codecov frontend flag**~~ **DONE** — Vitest 4.1.7 +
  `@vitest/coverage-v8`, standalone `vitest.config.ts` (coverage scoped to `src/lib/**`), CI runs
  `npm run test:coverage` and uploads `frontend/coverage/lcov.info` with `flags: frontend`. All pure
  `lib/*` helpers now covered (`reconciliation`, `ownership`, `maturity`, `lifecycle`, `gold`,
  `format`), 36 tests, `src/lib` ~98% stmt / 100% branch. Only `utils.ts` (`cn`) skipped as
  boilerplate. **Still not added** (deferred to when component tests begin, per ADR-0021): RTL + MSW
+ jsdom. **Do not** add Playwright/E2E to the coverage metric — it's a behavioural net, not a
  coverage instrument.
