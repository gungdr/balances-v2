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
- **M4.3b next**: Bond + TimeDeposit (accrued-interest snapshot shape). Adds two extension tables and exercises the second XOR branch.

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
- Bundle size: ~840KB / ~228KB gzipped (Recharts deferred code-split note in the deferred-items list, was ~790KB before M4.3a-frontend).

## M4.3 design decisions (settled during the grilling round)

1. **Snapshot routes are per-group**: `/api/investments/{id}/snapshots`. Mirrors ADR-0022 and the M4.2 pattern.
2. **Subtypes ship in two batches** to validate each snapshot shape independently:
   - M4.3a = Stock + MutualFund + Gold (quantity+price shape) — **done**
   - M4.3b = Bond + TimeDeposit (accrued-interest shape) — pending
3. **XOR shape integrity is two-layer**: DB CHECK rejects rows that satisfy no shape or both; the repo's `validateInvestmentSnapshotShape(subtype, ...)` rejects rows that pick the wrong shape for their parent's subtype (Postgres CHECK can't reference another table). Returns `repo.ErrInvalidSnapshotShape`, mapped to 400 in handlers.
4. **Transactions stay out of M4.3** — deferred to M4.4 (Buy/Sell/Coupon/Dividend/Distribution/Fee/Maturity).
5. **Three-level nav** (Investments > {subtype}) is acceptable for M4.3-frontend; React Router migration still flagged for M4.9.

## Conventions to keep, not to break

These are not ADRs because they're tactical, but they're load-bearing:

- **One snapshot table per position group** (ADR-0022). Don't try to merge them or build a polymorphic snapshot table.
- **Belt + suspenders tenancy.** Every SQL query that touches a position-related table filters by `household_id` *in SQL*, not just in middleware. Snapshot queries JOIN the parent table to verify ownership. See `backend/queries/asset_snapshots.sql` for the pattern.
- **Subtype guards.** When an entity is in a shared table (`assets` and `investments`), `Delete{Subtype}` and `Update{Subtype}` must verify the subtype before mutating. See `DeleteBankAccount` calling `GetBankAccount` first, and `DeleteStock` calling `GetStock` first.
- **Investment subtype→snapshot-shape validation lives in the repo, not the DB.** `validateInvestmentSnapshotShape(subtype, quantity, pricePerUnit, accruedInterest)` switches on subtype and returns `ErrInvalidSnapshotShape` if the value-column combo is wrong. The DB's CHECK only enforces "exactly one shape." When adding a new investment subtype, update both the switch in this helper and the `subtype` CHECK in migration 00006.
- **No transaction wrapping** in `Create{Liability|Receivable}` because there's no extension table to also write. **Wrap in `pool.Begin` when there is** (e.g., `CreateBankAccount` writes assets + bank_account_details). This will apply to all five investment subtypes.
- **Snapshot UI is split by shape.** Amount-only groups (asset, liability, receivable) share `CreateSnapshotDialog`/`EditSnapshotDialog`/`SnapshotRow` — pass the relevant `useMutation` results in as props, don't fork per group. Investments use a parallel set: `CreateInvestmentSnapshotDialog`/`EditInvestmentSnapshotDialog`/`InvestmentSnapshotRow` for the quantity+price shape (M4.3a). The fork is by snapshot *shape*, not by group; M4.3b's accrued-interest shape will need its own dialog set or will need one of these to grow a shape prop.
- **`SnapshotChart` is shared.** Don't fork it per group — it's already generic over `{year_month, amount}[]`.
- **Title Case** for nav labels, page H1s, data-section card titles. **Sentence case** for descriptions, empty-state messages, verb-phrase button labels. See M4.1 close commit for examples.
- **Two-level nav** for groups with subtypes; **flat** for groups without. Liabilities = two-level. Receivables = flat. Investments will be two-level.
- **React Query useEffect gotcha.** Never put a `useMutation` result in a `useEffect` deps array — it's recreated every render and will loop. There's a comment to this effect in `EditSnapshotDialog`; replicate the pattern when needed.
- **Decimals are strings on the wire**, `decimal.Decimal` in Go, with DECIMAL(20,4) for amounts and DECIMAL(20,8) for rates/FX. ADR-0011.
- **Soft-delete everything**, including snapshots. ADR-0007. Hard-delete is not a UI feature — "can be undone via the database" is the line we use in confirm dialogs.
- **Backend lint is enforced.** `golangci-lint run` from `backend/` must be clean. Config at repo root in `.golangci.yml`. `revive`'s `exported` and `package-comments` rules are deliberately disabled — don't reintroduce godoc-comment-on-every-export expectations for application code. New shared blank imports (e.g. SQL drivers) need a justifying comment.
- **Frontend lint is enforced.** `npm run lint` from `frontend/` must be clean. `react-refresh/only-export-components` is disabled for `components/ui/**` (shadcn-generated). `react-hooks/set-state-in-effect` is enforced everywhere else — no `setState` inside `useEffect` body.
- **Pagination clamp is derived during render**, not done in an effect. Pattern: `const effectivePage = Math.min(page, totalPages)`. Use `effectivePage` for slicing and for the `PaginationControls page` prop; keep raw `setPage` for click handlers. Don't reintroduce `useEffect(() => if (page > totalPages) setPage(totalPages))`.
- **Edit dialogs do not reset form state via `useEffect`.** Initial form state comes from the entity prop in `useState(() => toForm(entity))` or inline initializer. Parents pass `key={entity.id}` so React remounts the dialog on entity switch. Within the same entity, form state persists across open/cancel/reopen — by design.
- **Defer cleanup that returns an error must swallow it explicitly**: `defer func() { _ = tx.Rollback(ctx) }()`. Applies to `pgxpool.Tx.Rollback` and `sql.DB.Close()`. errcheck catches the bare form.
- **Tenancy test pattern**: every position group's `*_tenancy_test.go` covers both the cross-tenant rejection path (bob attempts X, expects `ErrNotFound`) and the alice-side happy-path CRUD success (update + delete on entity and snapshot, then verify Get/List). Cross-tenant alone leaves `Update*`/`Delete*`/`softDeleteAsset` success branches uncovered because the rejection short-circuits at the GetX guard.

## Things explicitly NOT to do

- **Don't autoflush commits.** User wants commit + push explicitly when they ask. Default to staging + showing diff.
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
- Recharts code-split (bundle is ~840KB / 228KB gz — warning on build)
- Diagnose `serve` not auto-applying migrations: HANDOFF claims migrations auto-run on `go run ./cmd/balances serve` but during M4.3a-frontend smoke testing, migration 00006 required a manual `migrate up`. Either the auto-migrate path is broken or the doc is wrong.
- Pagination footer in `{BankAccount,Property,Vehicle,Liability,Receivable,Stock,MutualFund,Gold}Detail.tsx` is the same `PaginationControls` block copy-pasted 8 times. Extract once it's clear the shape is stable.
- Position lifecycle UI: editable status / terminated_at / termination_note (M4.8)

## Updating this document

When you close a milestone, update this file in the closing commit. Don't let it drift more than one milestone behind reality.
