# Handoff — pick this up cold

You are an agent resuming work on **balances-v2**. This document is the live state of the project: what's done, what's next, what to avoid. Pair it with the durable docs (`CONTEXT.md`, `docs/adr/*`, `docs/ROADMAP.md`) which describe the design rather than the live state.

Read these first, in order:
1. `CLAUDE.md` (project instructions; points to `docs/agents/*`)
2. `docs/ROADMAP.md` (six milestones)
3. `CONTEXT.md` (domain language)
4. This document
5. `docs/adr/*` (twenty-three design decisions; skim the index, read the ones touching your task)
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
- **Auto-migrate-on-serve side quest complete (post-M4.3b-frontend)**: `serveCmd` now calls `applyMigrations` before opening the pgxpool, mirroring the testutil pattern (`sql.Open` → `goose.SetBaseFS`/`SetDialect` → `goose.UpContext`). HANDOFF previously claimed migrations auto-ran on serve, but the wiring was never there — only the test infra and the `migrate` subcommand called goose. Reality now matches the doc: pulling a new migration file and running `serve` applies it on startup. The manual `go run ./cmd/balances migrate up` path still works (same goose stack), useful for status/down/up-by-one. Pre-alpha single-household app, so blocking startup on migration apply is acceptable.
- **M4.4 backend complete**: investment transaction ledger shipped end-to-end (migration 00010 + queries + repo + handlers + 17-subtest tenancy/shape test). Single polymorphic `investment_transactions` table with a `transaction_type` enum (`buy`/`sell`/`coupon`/`dividend`/`distribution`/`fee`/`maturity`) and a CASE-driven CHECK enforcing type→shape integrity at the DB level. Repo's `validateInvestmentTransactionType(subtype, type)` enforces the subtype→type compatibility matrix (Stock → Buy/Sell/Dividend/Fee; MutualFund → + Distribution; Bond → + Coupon + Maturity; Gold → Buy/Sell/Fee; TimeDeposit → Maturity only); `validateInvestmentTransactionShape` catches missing-required-field combos with friendlier errors than the DB CHECK. New sentinels `ErrInvalidTransactionType` and `ErrInvalidTransactionShape`, both mapped to 400. Per ADR-0003, transactions do not auto-propagate to bank-account snapshots.
- **M4.4 frontend complete**: per-shape dialog forks (Create + Edit) for Trade, CashIncome, Fee, Maturity = 8 dialogs total. One shared `TransactionRow` switches the Edit dialog based on `transaction_type` (the backend endpoint is unified, so one updateMutation drives all shapes). All 5 detail pages (Stock/MutualFund/Bond/Gold/TimeDeposit) gained a Transactions card alongside Snapshots, with subtype-appropriate "+ Type" buttons. Maturity dispositions default from `rollover_policy` (TD only) — `auto_renew_with_interest` → both rolled, `auto_renew_principal` → P rolled / I cash, `no_rollover` → both cash. Soft reconciliation warning on Stock/MF/Gold compares latest snapshot's quantity to Σ(Buys − Sells − Fee.qty_deducted); statements remain source of truth so it's display-only (per the M4.4 grilling decision). Frontend chunk: 242 kB → 276 kB main / 41 kB gz.
- **M4.5 (Income) next**: per ADR-0008, closed-enum categories (Salary, BusinessIncome, RentalIncome, Gift, TaxRefund, InsurancePayout, Other) with free-text description for sub-categorisation. Like transactions (ADR-0003 + M4.4), Income events don't auto-update bank snapshots.

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

## What M4.4 shipped

**Backend**
- `backend/internal/migrations/00010_investment_transactions.sql` — single `investment_transactions` table with a `transaction_type` enum and a CASE-driven CHECK enforcing type→shape (Buy/Sell need amount+quantity+price; Coupon/Dividend/Distribution need amount; Fee needs amount, optional paired quantity+price; Maturity needs principal+interest+both dispositions). Two indexes: `investment_id` and `(investment_id, transaction_date DESC)`.
- `backend/queries/investment_transactions.sql` — CRUD with `WITH owned_investment` parent-tenancy enforcement on Create; UPDATE/Get/List use the standard FROM-JOIN tenancy pattern. `transaction_type` is **not** in the UPDATE column list — immutable post-create (changing type would invalidate the shape).
- `backend/internal/repo/investment_transactions.go` — `CreateInvestmentTransaction` / `ListInvestmentTransactions` / `UpdateInvestmentTransaction` / `DeleteInvestmentTransaction` on `InvestmentRepo`. `validateInvestmentTransactionType(subtype, txnType)` enforces the per-subtype matrix; `validateInvestmentTransactionShape(p)` enforces the per-type field combo. `repo.TxnType*` constants and `repo.Disposition*` constants exported for cross-package use.
- `backend/internal/investments/transactions.go` + mount: routes at `/api/investments/{id}/transactions` (POST/GET on root, PATCH/DELETE on `{transactionID}`).
- `backend/internal/repo/investment_transactions_tenancy_test.go` — 17 subtests covering bob's rejection across List/Create/Update/Delete, the 4-direction subtype→type matrix (Coupon-on-Stock, Buy-on-TD, Maturity-on-Stock, Dividend-on-Bond), shape-rejection (Buy without quantity, Maturity without dispositions, Fee with qty but no price, Dividend with qty), and alice's happy-path List/Update/Delete + Maturity round-trip preserving dispositions.

**Frontend**
- `frontend/src/hooks/useInvestmentTransactions.ts` — list/create/update/delete hooks. No `listKey` (transactions aren't denormalized onto subtype list rows; if that changes later, take the snapshot-listKey pattern).
- Shape-forked dialog set: `Create/EditTradeTransactionDialog` (Buy + Sell — txnType prop fixes title and direction), `Create/EditCashIncomeTransactionDialog` (Coupon + Dividend + Distribution), `Create/EditFeeTransactionDialog`, `Create/EditMaturityTransactionDialog`. Trade dialog derives `cash = qty × price` client-side and ships all three on the wire (mirrors `CreateQuantityPriceSnapshotDialog`). Maturity defaults its two dispositions from an optional `rolloverPolicy` prop — TD passes it; Bond doesn't.
- `frontend/src/components/TransactionRow.tsx` — single row component that picks the right Edit dialog based on `transaction.transaction_type` (the backend endpoint is unified, so one updateMutation suffices). Renders a colour-coded Cash impact column (Buy/Fee out → destructive, Sell/Coupon/Dividend/Distribution in → emerald, Maturity → emerald cash-out portions, "rolled" when both portions roll). Subline under Type shows shape-specific details (qty×price, P/I + disposition badges, etc.).
- `frontend/src/lib/reconciliation.ts` — `reconcileQuantity(latestSnapshot, transactions)` returns `{ expected, actual, matches }` for Stock/MF/Gold detail pages. Display-only soft warning; not enforced.
- All 5 detail pages (`StockDetail`/`MutualFundDetail`/`BondDetail`/`GoldDetail`/`TimeDepositDetail`) gained a Transactions Card below Snapshots, with subtype-appropriate "+ Type" buttons, a separate transaction-page state (PAGE_SIZE = 12, same as snapshots), and a row layout (Date / Type / Cash impact / Notes / Actions).

## M4.4 design decisions (settled during the pre-implementation grilling)

The architectural core of these is captured in **ADR-0023** (investment
transaction table strategy: single polymorphic table, type→shape CHECK,
subtype→type matrix in the repo). The tactical decisions below sit on
top of that ADR.


1. **Single polymorphic `investment_transactions` table** with type enum + nullable per-shape columns + DB-level CHECK on type→shape (mirrors `investment_snapshots` per ADR-0022). Per-type tables were rejected — chronological "all transactions for instrument X" queries are natural in one table; cross-type sqlc queries would be 7-way UNIONs.
2. **TimeDeposit gets Maturity only.** Initial placement lives in `time_deposit_details.principal` via the Create dialog; no redundant "Buy" placement transaction. Bond gets the full set (Buy + Sell + Coupon + Fee + Maturity) because secondary-market trades exist.
3. **Bond face_value stays as total** (not per-lot). Deepening to lots was deferred — current schema is sufficient for snapshot-shape tracking; revisit if a real reconciliation need surfaces.
4. **Reconciliation is display-only.** A snapshot quantity that disagrees with `Σ(Buys.qty) − Σ(Sells.qty) − Σ(Fees.qty_deducted)` shows a soft amber warning on the detail page. Statements remain the source of truth (ADR-0003 philosophy). No write-time block.
5. **transaction_type is immutable post-create.** Changing it would invalidate the shape; users delete + re-create instead.
6. **One Trade/CashIncome dialog handles multiple types via a `txnType` prop** rather than splitting Buy/Sell or Coupon/Dividend/Distribution into separate files. Fields are identical within shape; the title/verb pivots on the prop. Honours "name by shape, not by group" by analogy.
7. **Maturity's `rolloverPolicy` prop is optional** — TD passes it (defaults dispositions from the bank's configured policy), Bond doesn't (no policy, defaults to both cash-out).

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
- **Transaction UI is split by shape (four forks).** Trade (Buy/Sell) → `Create/EditTradeTransactionDialog`; CashIncome (Coupon/Dividend/Distribution) → `Create/EditCashIncomeTransactionDialog`; Fee → `Create/EditFeeTransactionDialog`; Maturity → `Create/EditMaturityTransactionDialog`. **One shared `TransactionRow`** routes to the right Edit dialog via switch on `transaction.transaction_type` because the backend update endpoint is unified (one route, one updateMutation per page). Dialogs within a shape that cover multiple types take a `txnType` prop rather than splitting per type. If a new transaction shape appears, fork by shape and add a new `Edit*Dialog` branch to `TransactionRow`.
- **Transaction validation is two-layer.** DB CHECK enforces type→shape integrity (e.g., `buy/sell` rows must have quantity AND price_per_unit). The repo's `validateInvestmentTransactionType(subtype, type)` enforces the subtype→type matrix (e.g., `Coupon` is only allowed on Bond); `validateInvestmentTransactionShape` re-checks the shape combo with friendlier error messages. When adding a new transaction type or subtype: update the type-enum CHECK in migration 00010, the per-type WHEN branch in the same CHECK, and the `allowed` matrix + switch in the two repo helpers. Each surfaces as `ErrInvalidTransactionType` or `ErrInvalidTransactionShape`, both 400.
- **`transaction_type` is immutable post-create.** Update payload omits it. To change a transaction's type, delete and re-create — changing it would invalidate the shape.
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
- Position lifecycle UI: editable status / terminated_at / termination_note (M4.8)
- **Per-bond `coupon_disposition` field** (escalation path): the M4.3b-frontend follow-up shipped a global `accrued=0` default in `CreateAccruedInterestSnapshotDialog` plus copy explaining the override path. If users find themselves repeatedly overriding (e.g. mostly secondary-market bond holders) or repeatedly forgetting to override, escalate to a per-bond enum `coupon_disposition: 'pays_out' | 'accrues'` on `bond_details` and pivot the form on that field. Currently no signal that we need it.
- **Bond lots/quantity modeling**: M4.4 settled this as defer — Buy/Sell bond transactions carry `quantity` (lot-style) + `price_per_unit`, but `bond_details.face_value` remains a user-edited total with no enforced reconciliation against the transaction ledger. Will revisit only if real usage shows the disconnect is confusing.
- **Snapshot future-date validation**: `year_month` and `as_of_date` on the create/update snapshot endpoints currently accept any date, including future ones. A snapshot is by definition a past observation, so a snapshot with `year_month > current month` or `as_of_date > today` is nonsense. Scope: 5 create + 5 update handlers (asset, liability, receivable, investment quantity-price, investment accrued-interest), matching `max` attributes on the frontend date/month inputs, and 400-path tests. Application-layer validation only — existing rows (including the post-May-2026 BankAccount test snapshots inserted during the PaginationControls smoke test) are grandfathered. **Apply the same to transaction_date on the M4.4 transactions endpoints** (5 transaction shapes share one endpoint, so just one create + one update path to guard).
- **TimeDeposit "duplicate matured TD" helper**: when a Maturity transaction has `principal_disposition = 'rolled_to_new'`, a fresh TD position must exist to receive the rolled amount. Currently the user creates the new TD manually. ROADMAP M6 + HANDOFF Q14c-iv flagged a "duplicate this TD" helper that pre-fills a Create TD dialog from the matured row's details with `placement_date = maturity_date` and `principal = old.principal + rolled_interest`. Defer until M4.6 polish — the manual path is workable.
- **Transaction-list aggregations**: no "transactions count" or "last transaction date" surfaced on the subtype list rows yet. Would add a column to `*ListItem` aggregates and a sqlc query. If/when it lands, take the snapshot `listKey` pattern in `useInvestmentTransactions` for invalidation.
- **Maturity is uniquely terminal — hard guard pending M4.8**: a TD or Bond matures exactly once, so the Maturity transaction should also flip `investments.status: active → matured` and set `terminated_at = transaction_date`. Currently neither happens — the M4.4 frontend has a band-aid that hides the `+ Maturity` button when one is already recorded (in `BondDetail` + `TimeDepositDetail`, via `transactions?.some(t => t.transaction_type === 'maturity')`), but the backend will still accept a second one if the request bypasses the UI. Belongs in M4.8 lifecycle work alongside editable status/terminated_at/termination_note. Backend hard guard scope: (1) partial unique index `CREATE UNIQUE INDEX ON investment_transactions (investment_id) WHERE transaction_type = 'maturity' AND deleted_at IS NULL`; (2) repo-level status flip inside `CreateInvestmentTransaction` when type=maturity; (3) reject all transaction creates when parent status != 'active'.
- **Gold purity input UX**: free-text decimal works (`formatGoldPurity` renders "24K (.999+)", "22K", etc. correctly) but typing `0.999` for 24K is awkward. Carat picker considered and deferred — design constraint is *"must distinguish 24K (.999) from Antam bar (.9999) without sub-percent precision loss"*. Possible shape: `<select>` with 24K, 22K, 20K, 18K, 14K, 10K, **Custom** where 24K maps to `0.9999`.
- **Path-filtered CI**: `.github/workflows/ci.yml` currently runs all three jobs (backend-lint / backend-test / frontend-checks) on every push and PR, including doc-only changes (`docs/**`, `*.md`, ADRs, HANDOFF). Add `paths:` filters so backend jobs run only on `backend/**` changes and frontend job runs only on `frontend/**`. **Cross-cutting files must trigger both**: `.github/workflows/ci.yml`, `Makefile`, `codecov.yml`, `.golangci.yml`, root configs. **Required-check gotcha**: if branch protection is ever enabled requiring these jobs, a skipped job blocks merges (GitHub treats skipped ≠ success). Fix is a `ci-gate` aggregator job with `if: always()` that depends on the three, succeeds when each is success-or-skipped, and is the only required check. No branch protection today, so low risk now — but structure with the aggregator from day one to avoid retrofitting. Codecov caveat: `fail_ci_if_error: true` is fine when backend job skips (no run = no missing-report complaint), but if a Codecov status check is later wired into branch protection, same skipped-≠-success problem applies.

## Updating this document

When you close a milestone, update this file in the closing commit. Don't let it drift more than one milestone behind reality.
