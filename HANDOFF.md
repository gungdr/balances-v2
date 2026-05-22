# Handoff — pick this up cold

You are an agent resuming work on **balances-v2**. This document is the live state of the project: what's done, what's next, what to avoid. Pair it with the durable docs (`CONTEXT.md`, `docs/adr/*`, `docs/ROADMAP.md`) which describe the design rather than the live state.

Read these first, in order:
1. `CLAUDE.md` (project instructions; points to `docs/agents/*`)
2. `docs/ROADMAP.md` (six milestones)
3. `CONTEXT.md` (domain language)
4. This document
5. `docs/adr/*` (twenty-two design decisions; skim the index, read the ones touching your task)
6. `git log --oneline -20` (most recent direction)

## Where we are

- **M1–M3 complete**: walking skeleton, Google OAuth + invites, first vertical slice (bank-account asset with snapshots), all tenancy-tested.
- **M4.1 complete**: property + vehicle asset subtypes through the full stack, two-level nav, Title Case applied to nav.
- **M4.2 complete**: liability + receivable groups end-to-end. Last commit on `origin/main`: see `git log -1`.
- **CI/coverage side quest complete (post-M4.2)**: GitHub Actions runs golangci-lint + `go test -race -coverprofile` + Codecov upload + ESLint + `npm run build` on every push to `main` and every PR. Coverage thresholds are informational-only until alpha. Codecov needs `CODECOV_TOKEN` (already set in repo secrets) because Codecov treats the default branch as protected even on public repos. Phase 1 coverage backfill added happy-path CRUD tests to the five repo tenancy suites; `internal/repo` sits around 70%. HTTP handler coverage (currently 0% across `internal/{assets,liabilities,receivables,auth}`) is deferred to a future side quest.
- **M4.3a backend complete**: Investments group with Stock + MutualFund + Gold subtypes shipped end-to-end on the backend (migration, repo, handlers, tenancy + happy-path + shape-validation tests). `investment_snapshots` column is `amount` (ADR-0022 was backtracked from `total_value` for cross-group consistency). Subtype and status enums carry all forward-compat values so M4.3b adds extension tables without ALTERs. `internal/repo` coverage ~72%.
- **M4.3a-frontend complete**: three-level nav (Investments > {Stocks, Mutual Funds, Gold}); per-subtype list/detail pages and create/edit dialogs; quantity×price snapshot dialog set with derived amount preview. Smoke-tested end-to-end against the live backend.
- **M4.3b backend complete**: Bond + TimeDeposit subtypes shipped end-to-end on the backend (migration 00007 adds the two extension tables; no schema change to `investments` or `investment_snapshots` since M4.3a already carried `bond`/`time_deposit` in the subtype CHECK and the accrued-interest value column). Five-subtype tenancy test now covers all of stock/mutual_fund/gold/bond/time_deposit; snapshot-shape validation exercises both XOR branches.
- **M4.3b-frontend complete**: per-subtype Bond + TimeDeposit UI (5 components each), three-set snapshot dialog fork (amount-only / quantity-price / accrued-interest) with the existing investment trio renamed to `QuantityPriceSnapshot*` for shape-based naming uniformity. Investments nav extended to 5 tabs (Stocks → Mutual Funds → Bonds → Time Deposits → Gold). Pre-M4.3b-frontend prep: migration 00008 backtracked rate storage convention from decimal fraction to percentage (`0.055` → `5.5`) across liability/property/vehicle/bond/time-deposit rates — uniform "type what you read on the statement" UX; migration 00009 added `bond_details.series_code` for parallel-with-MutualFund symmetry.
- **PaginationControls extracted (post-M4.3b-frontend)**: the copy-pasted `function PaginationControls` block in the 10 detail pages (`{BankAccount,Property,Vehicle,Liability,Receivable,Stock,MutualFund,Gold,Bond,TimeDeposit}Detail.tsx`) moved to a shared `frontend/src/components/PaginationControls.tsx`. Detail pages now import the component and drop the six `@/components/ui/pagination` primitive imports. Shape was stable across all 10 (modulo whitespace) so the extraction was a straight dedupe with no API changes.
- **Recharts code-split side quest complete (post-M4.3b-frontend)**: `SnapshotChart` is now a lazy wrapper around `SnapshotChartImpl` (default export, holds recharts + the shadcn chart wrapper). Detail pages keep their `import { SnapshotChart }` unchanged; the empty-snapshot short-circuit stays in the wrapper so the chunk isn't even fetched on empty data. `vite.config.ts` also gained `manualChunks` peeling React, Radix, react-query, and lucide into their own chunks, and `server.host: true` for LAN access during dev. Main chunk dropped from 890 kB / 233 kB gz to 242 kB / 35 kB gz; recharts is a 337 kB / 100 kB gz lazy chunk; chunk-size warning gone.
- **M4.4 (Transactions) next**: Buy / Sell / Coupon / Dividend / Distribution / Fee / Maturity for investment instruments. ADR-0003 defers cash propagation to bank-account snapshots — transactions are income/cost-basis ledgers only.

## What M4.2 shipped

Code lives where you'd expect from the M4.1 pattern. Specifics worth knowing:

**Backend**
- `backend/internal/migrations/00005_liabilities_receivables.sql` — 4 new tables. Liabilities carry the `subtype` enum (`personal` | `institutional`) and inline metadata (counterparty, principal, rate, term, dates). Receivables have no subtype, just counterparty + due_date. Both use the amount-shape snapshot table per ADR-0022.
- `backend/queries/{liabilities,liability_snapshots,receivables,receivable_snapshots}.sql` — full CRUD plus batch latest-snapshot joins for list views. Snapshot queries always JOIN the parent table with `household_id = $X` for belt+suspenders tenancy enforcement.
- `backend/internal/repo/{liabilities,receivables}.go` — `LiabilityRepo` and `ReceivableRepo` with full CRUD + snapshot CRUD. Each is its own struct; they do **not** share helpers with `AssetRepo` beyond the package-private `currentUser` helper.
- `backend/internal/{liabilities,receivables}/` — HTTP packages mounted under `/api/liabilities` and `/api/receivables`, each with `/{id}/snapshots/*` sub-routes.

**Frontend**
- Snapshot UI **lifted** to be group-agnostic. `CreateSnapshotDialog`, `EditSnapshotDialog`, and `SnapshotRow` accept `useMutation` results as props (`mutation`, `updateMutation`, `deleteMutation`) instead of calling group-specific hooks internally. **Each detail page now owns its own create/update/delete snapshot mutations and passes them down.** This is the key refactor that lets us avoid `LiabilitySnapshotRow` / `ReceivableSnapshotRow` duplication.
- `BankAccountChart` renamed to **`SnapshotChart`** and its prop type generalised to `{year_month: string; amount: string}[]`. All five detail pages share it.
- New hooks: `useLiabilities`, `useLiabilitySnapshots`, `useReceivables`, `useReceivableSnapshots`. Mutation `onSuccess` handlers invalidate both the list key (`['liabilities']` or `['receivables']`) and the snapshot key (`['liability-snapshots', id]` etc).
- Liabilities use **two-level nav** (Personal / Institutional inner tabs); Receivables is flat.

**Tests**
- `backend/internal/repo/{liabilities,receivables}_tenancy_test.go` — 9 subtests each. Covers core CRUD + snapshot CRUD across two households. All pass.

## What M4.3a backend shipped

- `backend/internal/migrations/00006_investments.sql` — `investments` + `stock_details` + `mutual_fund_details` + `gold_details` + `investment_snapshots`. Subtype enum carries all five values up front (bond/time_deposit reachable in M4.3b without an ALTER); status enum carries `active`/`sold`/`matured`. Snapshot table has the XOR CHECK from ADR-0022 plus a partial unique index on `(investment_id, year_month) WHERE deleted_at IS NULL`.
- `backend/queries/{investments,stocks,mutual_funds,golds,investment_snapshots}.sql` — full CRUD plus batch latest-snapshot joins and detail joins for list views. Snapshot queries JOIN `investments` to enforce tenancy.
- `backend/internal/repo/{investments,stocks,mutual_funds,golds}.go` — `InvestmentRepo` with per-subtype CRUD (txn-wrapped parent + detail writes), shared `softDeleteInvestment` helper, snapshot CRUD with `validateInvestmentSnapshotShape`. New `repo.ErrInvalidSnapshotShape` sentinel.
- `backend/internal/investments/*` — HTTP package mounted under `/api/investments`, with `/stocks`, `/mutual-funds`, `/golds` subtype CRUD and `/{id}/snapshots` snapshot CRUD. `repoErrorStatus` maps `ErrInvalidSnapshotShape` to 400.
- `backend/internal/repo/investments_tenancy_test.go` — covers cross-tenant rejection across all three subtypes, the subtype guard between them, snapshot tenancy, alice-side happy-path CRUD, and a separate `TestInvestmentRepo_SnapshotShapeValidation` exercising the repo's shape XOR.

## What M4.3a-frontend shipped

- `frontend/src/hooks/useInvestments.ts` — per-subtype CRUD (stocks / mutual-funds / golds) against `/api/investments/*`. Each subtype has its own list/detail/create/update/delete hooks; list queries cache under `['stocks']`, `['mutual-funds']`, `['golds']`.
- `frontend/src/hooks/useInvestmentSnapshots.ts` — shared snapshot CRUD at `/api/investments/{id}/snapshots`. The mutation hooks take a `listKey: 'stocks' | 'mutual-funds' | 'golds'` so they can invalidate the right parent list when a snapshot changes (each list inlines `latest_snapshot`).
- `frontend/src/components/{Stocks,MutualFunds,Golds}Screen.tsx`, `{Stock,MutualFund,Gold}ListRow.tsx`, `Create{Stock,MutualFund,Gold}Dialog.tsx`, `Edit{Stock,MutualFund,Gold}Dialog.tsx` — list, row, and dialog set per subtype. Edit dialogs accept either the detail `Stock`/`MutualFund`/`Gold` aggregate or the list-row `*ListItem` so both call sites can reuse them.
- `frontend/src/components/{Stock,MutualFund,Gold}Detail.tsx` — detail pages mirror `LiabilityDetail`: own snapshot mutations, pass them as props to the snapshot dialogs/row, share `SnapshotChart`. Each detail page hardcodes its `quantityUnit` for the row ("sh" / "units" / "g").
- `frontend/src/components/CreateInvestmentSnapshotDialog.tsx` + `EditInvestmentSnapshotDialog.tsx` + `InvestmentSnapshotRow.tsx` — **separate** from the amount-only `CreateSnapshotDialog`/`EditSnapshotDialog`/`SnapshotRow`. They take Quantity + Price-per-unit inputs and derive `amount = qty × price` client-side (shown as a preview, sent on the wire alongside the two factors). The backend's `validateInvestmentSnapshotShape` re-checks the subtype→shape mapping. This was a deliberate fork — see the convention note below.
- `frontend/src/lib/gold.ts` — `formatGoldPurity` helper that renders "24K (.999+)", "22K", "18K", or falls through to a percentage. Used in `GoldListRow` and `GoldDetail`.
- `frontend/src/api/types.ts` — added `Investment`, `InvestmentSnapshot`, `Stock`/`MutualFund`/`Gold` aggregates and `*ListItem` variants. `InvestmentSubtype` carries all five values for forward compatibility with M4.3b.
- `frontend/src/App.tsx` — Investments replaces the placeholder with a three-level nav (Group > Investments > {Stocks, Mutual Funds, Gold}). `Selection` union extended with `{kind: 'stock'|'mutual_fund'|'gold', investmentId}`.
- Bundle size: ~840KB / ~228KB gzipped (was ~790KB before M4.3a-frontend; later code-split in the Recharts side quest, see below).

## What M4.3b backend shipped

- `backend/internal/migrations/00007_bonds_time_deposits.sql` — adds `bond_details` (bond_type enum `govt_primary|secondary_market`, issuer, face_value, coupon_rate, coupon_frequency enum `monthly|quarterly|semi_annual|annual` default monthly, maturity_date) and `time_deposit_details` (bank_name, principal, interest_rate, term_months, placement_date, maturity_date, rollover_policy enum `auto_renew_principal|auto_renew_with_interest|no_rollover`). No new indexes (deferred per the spec grilling — M4.2 precedent).
- `backend/queries/{bonds,time_deposits}.sql` — Create/Get/List-by-IDs/Update on each details table. No detail-table soft-delete; parent's `softDeleteInvestment` cascades.
- `backend/internal/repo/{bonds,time_deposits}.go` — `CreateBond` / `CreateTimeDeposit` (txn-wrapped parent + details), `Get/Update/Delete` with subtype guard mirroring stocks/golds. `validateInvestmentSnapshotShape` already covered `bond` and `time_deposit` since M4.3a; no change needed in `investments.go`.
- `backend/internal/investments/{bonds,time_deposits}.go` — HTTP handlers mounted under `/api/investments/bonds` and `/api/investments/time-deposits`. `maturity_date` / `placement_date` accepted as `YYYY-MM-DD` strings; Go-side `time.Parse` rather than relying on validator.
- `backend/internal/repo/investments_tenancy_test.go` — extended to five subtypes. New subtests cover bond/time_deposit list isolation, bob get/update/delete on each, subtype guard from bond → stock/time_deposit, alice happy-path update + delete on bond + TD. `TestInvestmentRepo_SnapshotShapeValidation` now exercises the accrued-interest XOR branch (missing accrued rejected, quantity+price rejected, accrued-only accepted).

## What M4.3b-frontend shipped

- **Snapshot dialog set rename + fork**: existing `CreateInvestmentSnapshotDialog` / `EditInvestmentSnapshotDialog` / `InvestmentSnapshotRow` renamed to `*QuantityPriceSnapshot*` to make the convention "name by shape, not by group" uniform. New `Create/EditAccruedInterestSnapshotDialog` + `AccruedInterestSnapshotRow` trio carries the accrued-interest shape — Total value + Accrued inputs, with derived "Of which principal" helper line. Bond/TD detail pages own their snapshot mutations and pass them in as props, same pattern as M4.3a-frontend.
- **Bond UI** (`BondsScreen`, `BondListRow`, `BondDetail`, `Create/EditBondDialog`): list row shows `series_code` (mono, line 1) + `<bond_type> · <issuer> · <coupon_rate>% <coupon_frequency>` (line 2) + maturity styled by urgency (line 3). 4-tier urgency in `lib/maturity.ts`: default (muted), approaching (≤90d, bold), imminent (≤30d, bold + amber, countdown format), matured (muted + ⚠ prefix).
- **TimeDeposit UI** (`TimeDepositsScreen`, `TimeDepositListRow`, `TimeDepositDetail`, `Create/EditTimeDepositDialog`): list row shows bank_name + rate·term + maturity. Create dialog auto-derives `maturity_date` from `placement_date + term_months` whenever either changes; user can override (banks sometimes nudge for holidays). Rollover-policy picker has a one-line helper caption.
- **Pre-M4.3b-frontend migration prep**:
  - `migrations/00008_rates_to_percent.sql` — `UPDATE` rates × 100 in 5 columns (`liabilities.interest_rate`, `property_details.annual_amortization_rate`, `vehicle_details.annual_depreciation_rate`, `bond_details.coupon_rate`, `time_deposit_details.interest_rate`). Frontend create/edit forms type `5.5` for "5.5%", no client-side scaling.
  - `migrations/00009_bond_series_code.sql` — `bond_details.series_code` (nullable TEXT). Required-vs-optional decision: nullable because corporate bonds without a published code exist. Stock.ticker is required (exchanges always have one); bond series codes are softer.
- **App.tsx nav**: `InvestmentSubtypeNav` extended to 5 values; tab order **Stocks → Mutual Funds → Bonds → Time Deposits → Gold** (equities → funds → fixed-income pair → physical); Selection union extended with `bond` + `time_deposit` variants.

## M4.3 design decisions (settled during the grilling round)

1. **Snapshot routes are per-group**: `/api/investments/{id}/snapshots`. Mirrors ADR-0022 and the M4.2 pattern.
2. **Subtypes shipped in two batches** to validate each snapshot shape independently:
   - M4.3a = Stock + MutualFund + Gold (quantity+price shape) — **done**
   - M4.3b = Bond + TimeDeposit (accrued-interest shape) — **done** (backend + frontend)
3. **XOR shape integrity is two-layer**: DB CHECK rejects rows that satisfy no shape or both; the repo's `validateInvestmentSnapshotShape(subtype, ...)` rejects rows that pick the wrong shape for their parent's subtype (Postgres CHECK can't reference another table). Returns `repo.ErrInvalidSnapshotShape`, mapped to 400 in handlers.
4. **Transactions stay out of M4.3** — deferred to M4.4 (Buy/Sell/Coupon/Dividend/Distribution/Fee/Maturity).
5. **Three-level nav** (Investments > {subtype}) is acceptable for M4.3-frontend; React Router migration still flagged for M4.9.
6. **Snapshot `amount` is dirty for the accrued-interest shape** — for Bond/TimeDeposit, `amount` is the total position value (already includes accrued interest); `accrued_interest` is a *breakdown* column for income-tracking visibility and is never additive at aggregation time. Documented in ADR-0022 and CONTEXT.md (the Snapshot definition).
7. **Floating-rate bonds (SBR, ST) use a plain `coupon_rate` field** — the user edits it on each rate reset. No structured rate_type / spread / base model; KISS, defer until UI needs filtering or display badges.
8. **Early TimeDeposit withdrawal folds into the `sold` status** — `sold` is the generic "fully exited before scheduled term" outcome per CONTEXT.md; the frontend renders a subtype-aware label ("Withdrawn early" for TD).

## Conventions to keep, not to break

These are not ADRs because they're tactical, but they're load-bearing:

- **One snapshot table per position group** (ADR-0022). Don't try to merge them or build a polymorphic snapshot table.
- **Belt + suspenders tenancy.** Every SQL query that touches a position-related table filters by `household_id` *in SQL*, not just in middleware. Snapshot queries JOIN the parent table to verify ownership. See `backend/queries/asset_snapshots.sql` for the pattern.
- **Subtype guards.** When an entity is in a shared table (`assets` and `investments`), `Delete{Subtype}` and `Update{Subtype}` must verify the subtype before mutating. See `DeleteBankAccount` calling `GetBankAccount` first, and `DeleteStock` calling `GetStock` first.
- **Investment subtype→snapshot-shape validation lives in the repo, not the DB.** `validateInvestmentSnapshotShape(subtype, quantity, pricePerUnit, accruedInterest)` switches on subtype and returns `ErrInvalidSnapshotShape` if the value-column combo is wrong. The DB's CHECK only enforces "exactly one shape." When adding a new investment subtype, update both the switch in this helper and the `subtype` CHECK in migration 00006.
- **No transaction wrapping** in `Create{Liability|Receivable}` because there's no extension table to also write. **Wrap in `pool.Begin` when there is** (e.g., `CreateBankAccount` writes assets + bank_account_details). This will apply to all five investment subtypes.
- **Snapshot UI is split by shape (three forks).** Amount-only (asset, liability, receivable) → `Create/EditSnapshotDialog` + `SnapshotRow`. Quantity+price (stock, mutual_fund, gold) → `Create/EditQuantityPriceSnapshotDialog` + `QuantityPriceSnapshotRow`. Accrued-interest (bond, time_deposit) → `Create/EditAccruedInterestSnapshotDialog` + `AccruedInterestSnapshotRow`. Each fork's `useMutation` is owned by the parent detail page and passed in as props. The convention is **name by shape, not by group** — if a new subtype shares a shape, reuse its dialog set; if a new shape appears, fork by shape.
- **`SnapshotChart` is shared.** Don't fork it per group — it's already generic over `{year_month, amount}[]`.
- **Title Case** for nav labels, page H1s, data-section card titles. **Sentence case** for descriptions, empty-state messages, verb-phrase button labels. See M4.1 close commit for examples.
- **Two-level nav** for groups with subtypes; **flat** for groups without. Liabilities = two-level. Receivables = flat. Investments will be two-level.
- **React Query useEffect gotcha.** Never put a `useMutation` result in a `useEffect` deps array — it's recreated every render and will loop. There's a comment to this effect in `EditSnapshotDialog`; replicate the pattern when needed.
- **Decimals are strings on the wire**, `decimal.Decimal` in Go, with DECIMAL(20,4) for amounts and DECIMAL(20,8) for rates/FX. ADR-0011.
- **Rates are stored as percentage** (e.g., `5.5` for 5.5%), not as decimal fraction. Frontend reads/writes the same number the user sees on screen — no client-side scaling. Applies to `liabilities.interest_rate`, `property_details.annual_amortization_rate`, `vehicle_details.annual_depreciation_rate`, `bond_details.coupon_rate`, `time_deposit_details.interest_rate`. Backtracked from decimal-fraction storage in migration 00008.
- **Maturity urgency styling** (`lib/maturity.ts`): 4-tier — default (>90d, muted), approaching (≤90d, bold), imminent (≤30d, bold + amber, countdown format), matured (muted + ⚠ prefix). Bond + TimeDeposit list rows + detail pages share this helper. Don't reinvent the date-comparison logic inline.
- **Soft-delete everything**, including snapshots. ADR-0007. Hard-delete is not a UI feature — "can be undone via the database" is the line we use in confirm dialogs.
- **Backend lint is enforced.** `golangci-lint run` from `backend/` must be clean. Config at repo root in `.golangci.yml`. `revive`'s `exported` and `package-comments` rules are deliberately disabled — don't reintroduce godoc-comment-on-every-export expectations for application code. New shared blank imports (e.g. SQL drivers) need a justifying comment.
- **Frontend lint is enforced.** `npm run lint` from `frontend/` must be clean. `react-refresh/only-export-components` is disabled for `components/ui/**` (shadcn-generated). `react-hooks/set-state-in-effect` is enforced everywhere else — no `setState` inside `useEffect` body.
- **Pagination clamp is derived during render**, not done in an effect. Pattern: `const effectivePage = Math.min(page, totalPages)`. Use `effectivePage` for slicing and for the `PaginationControls page` prop; keep raw `setPage` for click handlers. Don't reintroduce `useEffect(() => if (page > totalPages) setPage(totalPages))`.
- **Edit dialogs do not reset form state via `useEffect`.** Initial form state comes from the entity prop in `useState(() => toForm(entity))` or inline initializer. Parents pass `key={entity.id}` so React remounts the dialog on entity switch. Within the same entity, form state persists across open/cancel/reopen — by design.
- **Defer cleanup that returns an error must swallow it explicitly**: `defer func() { _ = tx.Rollback(ctx) }()`. Applies to `pgxpool.Tx.Rollback` and `sql.DB.Close()`. errcheck catches the bare form.
- **Tenancy test pattern**: every position group's `*_tenancy_test.go` covers both the cross-tenant rejection path (bob attempts X, expects `ErrNotFound`) and the alice-side happy-path CRUD success (update + delete on entity and snapshot, then verify Get/List). Cross-tenant alone leaves `Update*`/`Delete*`/`softDeleteAsset` success branches uncovered because the rejection short-circuits at the GetX guard.

## Things explicitly NOT to do

- **Don't autoflush commits.** When work seems ready, stage + show the diff + ask. Push only on explicit green light. After every push, watch CI to completion (`gh run list --branch <branch>` / `gh run watch <id>`); if a workflow fails, surface the failure with logs and ask the user whether to fix now or defer. Don't declare a commit done while runs are still queued or in_progress.
- **Don't dive into UI alone.** User has near-zero frontend skill and relies heavily on you for UI — but expects to be consulted on UX choices (form density, navigation, button labels). Always surface tradeoffs.
- **Don't fear backtracking on prior decisions** if they're suboptimal — pre-alpha migrations are not sacred. User explicitly accepted this. Flag the issue, propose the better path, let user decide.
- **Don't create planning/analysis documents** unless asked. Live state goes in this file or in memory; design decisions go in ADRs; nothing else.
- **Don't bypass `--no-verify` or `--no-gpg-sign`** on git commits.
- **Don't add features beyond the task.** No speculative abstractions. Three similar lines beats premature abstraction.
- **Don't add comments that just restate the code.** Only add when WHY is non-obvious.
- **Don't auto-start the next milestone** without explicit user instruction. User pauses between milestones to direct.

## How to run locally

```bash
# Backend
cd /Users/rad/Documents/Code/src/balances-v2
set -a && source .env && set +a
cd backend && go run ./cmd/balances serve

# Frontend (separate terminal)
cd frontend && npm run dev

# Migrations (auto-run on serve, but to run manually)
cd backend && go run ./cmd/balances migrate up
```

The backend is `serve`, not `server`. There is **no dev-login backdoor** — auth is real Google OAuth. For backend smoke tests against authenticated endpoints, pull a current session token from the `sessions` table:

```bash
docker exec balances-v2-postgres-1 psql -U balances -d balances \
  -c "SELECT s.id as token FROM sessions s WHERE s.expires_at > now() LIMIT 1;"
```

Pass via `Cookie: session=<token>` header.

## Lint locally before pushing

```bash
# Backend
cd backend && golangci-lint run

# Frontend
cd frontend && npm run lint
```

CI runs both on every push. golangci-lint config is at `.golangci.yml` (repo root); ESLint config is `frontend/eslint.config.js`. The Codecov config (`codecov.yml`) keeps coverage status informational-only — failing CI from coverage drops is a deliberate non-goal until alpha.

## Deferred items still on the list

- Property/vehicle amortization-rate UI helper (Q8a)
- Fee cash→quantity helper (Q12, lands in M4.6 with Transactions)
- TimeDeposit "duplicate matured TD" helper (Q14c-iv, M4.6)
- Side-by-side multi-currency dashboard view (Q15c, M5)
- Sole-owner user picker UI (currently defaults to current user)
- React Router migration (M4.9)
- Settings/Household page that holds the invite form (currently piggybacking on the bank-accounts tab)
- Diagnose `serve` not auto-applying migrations: HANDOFF claims migrations auto-run on `go run ./cmd/balances serve` but during M4.3a-frontend smoke testing, migration 00006 required a manual `migrate up`. Either the auto-migrate path is broken or the doc is wrong.
- Position lifecycle UI: editable status / terminated_at / termination_note (M4.8)
- **Per-bond `coupon_disposition` field** (escalation path): the M4.3b-frontend follow-up shipped a global `accrued=0` default in `CreateAccruedInterestSnapshotDialog` plus copy explaining the override path. If users find themselves repeatedly overriding (e.g. mostly secondary-market bond holders) or repeatedly forgetting to override, escalate to a per-bond enum `coupon_disposition: 'pays_out' | 'accrues'` on `bond_details` and pivot the form on that field. Currently no signal that we need it.
- **Bond lots/quantity modeling** (M4.4): the current schema captures total `face_value` only, not lots × per-lot face. Sufficient for snapshot-shape tracking; will deepen when Buy/Sell transactions land in M4.4 (each trade carries lot quantity + price).
- **Snapshot future-date validation**: `year_month` and `as_of_date` on the create/update snapshot endpoints currently accept any date, including future ones. A snapshot is by definition a past observation, so a snapshot with `year_month > current month` or `as_of_date > today` is nonsense. Scope: 5 create + 5 update handlers (asset, liability, receivable, investment quantity-price, investment accrued-interest), matching `max` attributes on the frontend date/month inputs, and 400-path tests. Application-layer validation only — existing rows (including the post-May-2026 BankAccount test snapshots inserted during the PaginationControls smoke test) are grandfathered.
- **Gold purity input UX**: free-text decimal works (`formatGoldPurity` renders "24K (.999+)", "22K", etc. correctly) but typing `0.999` for 24K is awkward. Carat picker considered and deferred — design constraint is *"must distinguish 24K (.999) from Antam bar (.9999) without sub-percent precision loss"*. Possible shape: `<select>` with 24K, 22K, 20K, 18K, 14K, 10K, **Custom** where 24K maps to `0.9999`.

## Updating this document

When you close a milestone, update this file in the closing commit. Don't let it drift more than one milestone behind reality.
