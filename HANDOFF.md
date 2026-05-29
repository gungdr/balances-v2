# Handoff — pick this up cold

You are an agent resuming work on **balances-v2**. This document is the live state of the
project: what's true now, what's next, the conventions to keep, and the deferred backlog. Pair
it with the durable design docs (`CONTEXT.md`, `docs/adr/*`, `docs/ROADMAP.md`) and with
`CHANGELOG.md` for the blow-by-blow of what each milestone shipped.

Read these first, in order:
1. `CLAUDE.md` (project instructions; points to `docs/agents/*`)
2. `docs/ROADMAP.md` (six milestones)
3. `CONTEXT.md` (domain language)
4. This document
5. `docs/adr/*` (twenty-four design decisions; skim the index, read the ones touching your task)
6. `CHANGELOG.md` (only when you need the detailed history of an already-shipped milestone)
7. `git log --oneline -20` (most recent direction)

## Where we are now

M1–M5 are complete; **M6 (v1 polish) is in progress.** CI is green.

- **M1–M3** — walking skeleton, Google OAuth + invites, first vertical slice (bank-account asset
  with snapshots), all tenancy-tested.
- **M4.1** — property + vehicle asset subtypes through the full stack; two-level nav; Title Case.
- **M4.2** — liability + receivable groups end-to-end.
- **M4.3** — investments group, all five subtypes (stock, mutual_fund, gold, bond, time_deposit),
  backend + frontend.
- **M4.4** — investment transaction ledger (Buy/Sell/Coupon/Dividend/Distribution/Fee/Maturity),
  backend + frontend.
- **M4.5** — Income: a flat flow-event entity (no subtype/snapshots/transactions/lifecycle).
- **M4.6** — position lifecycle UI (status / terminated_at) across all groups.
- **M5** — materialized monthly net-worth report + dashboard, in three slices: net-worth
  headline, comprehensive-income lines, and side-by-side currency display (Q15c).
- **M6 (in progress)** — shipped so far: snapshot importer (xlsx, all 10 groups + 5 investment
  subtypes), self-set `users.nickname` for compact owner labels, list-screen polish swept across
  all 10 groups, and a backend-coverage backfill after the importer/lifecycle handlers landed
  untested (codecov backend back to 83.7%).

A CI/coverage side quest (post-M4.2) stood up GitHub Actions: golangci-lint + `go test -race
-coverprofile` + Codecov + ESLint + `npm run build` on every push to `main` and every PR.
Coverage thresholds are informational-only until alpha. For the detailed writeup of any
milestone above, see `CHANGELOG.md`.

## What's next

M6 is the v1-polish milestone (see `docs/ROADMAP.md`). Still open in M6:

- **PDF export** of monthly reports (user requirement, Q22).
- **Property/vehicle amortization-rate UI helper** (Q8a).
- **Fee cash→quantity helper** (Q12).
- **TimeDeposit "duplicate matured TD" helper** (Q14c-iv): when a Maturity transaction has
  `principal_disposition = 'rolled_to_new'`, a fresh TD must receive the rolled amount. Today the
  user creates it manually. Helper pre-fills a Create-TD dialog from the matured row with
  `placement_date = maturity_date` and `principal = old.principal + rolled_interest`.
- **Migration consolidation** — squash the ~15 accumulated pre-alpha migrations into one
  initial-schema migration before the first production deploy.
- **Deploy** — choose a hosting target and ship it; configure a real Resend domain for production
  email; document DB backup/restore.

Don't auto-start the next item — the user pauses between milestones to direct. The deferred
backlog below holds the smaller, optional items.

## Conventions to keep, not to break

These are not ADRs because they're tactical, but they're load-bearing:

- **One snapshot table per position group** (ADR-0022). Don't try to merge them or build a 
polymorphic snapshot table.
- **Belt + suspenders tenancy.** Every SQL query that touches a position-related table filters by 
`household_id` *in SQL*, not just in middleware. Snapshot queries JOIN the parent table to verify 
ownership. See `backend/queries/asset_snapshots.sql` for the pattern.
- **Subtype guards.** When an entity is in a shared table (`assets` and `investments`), 
`Delete{Subtype}` and `Update{Subtype}` must verify the subtype before mutating. See 
`DeleteBankAccount` calling `GetBankAccount` first, and `DeleteStock` calling `GetStock` first.
- **Investment subtype→snapshot-shape validation lives in the repo, not the DB.** 
`validateInvestmentSnapshotShape(subtype, quantity, pricePerUnit, accruedInterest)` switches on 
subtype and returns `ErrInvalidSnapshotShape` if the value-column combo is wrong. The DB's CHECK 
only enforces "exactly one shape." When adding a new investment subtype, update both the switch in 
this helper and the `subtype` CHECK in migration 00006.
- **No transaction wrapping** in `Create{Liability|Receivable}` because there's no extension table 
to also write. **Wrap in `pool.Begin` when there is** (e.g., `CreateBankAccount` writes assets + 
bank_account_details). This will apply to all five investment subtypes.
- **Snapshot UI is split by shape (three forks).** Amount-only (asset, liability, receivable) → 
`Create/EditSnapshotDialog` + `SnapshotRow`. Quantity+price (stock, mutual_fund, gold) → 
`Create/EditQuantityPriceSnapshotDialog` + `QuantityPriceSnapshotRow`. Accrued-interest (bond, 
time_deposit) → `Create/EditAccruedInterestSnapshotDialog` + `AccruedInterestSnapshotRow`. Each 
fork's `useMutation` is owned by the parent detail page and passed in as props. The convention is 
**name by shape, not by group** — if a new subtype shares a shape, reuse its dialog set; if a new 
shape appears, fork by shape.
- **Transaction UI is split by shape (four forks).** Trade (Buy/Sell) → 
`Create/EditTradeTransactionDialog`; CashIncome (Coupon/Dividend/Distribution) → 
`Create/EditCashIncomeTransactionDialog`; Fee → `Create/EditFeeTransactionDialog`; Maturity → 
`Create/EditMaturityTransactionDialog`. **One shared `TransactionRow`** routes to the right Edit 
dialog via switch on `transaction.transaction_type` because the backend update endpoint is unified 
(one route, one updateMutation per page). Dialogs within a shape that cover multiple types take a 
`txnType` prop rather than splitting per type. If a new transaction shape appears, fork by shape 
and add a new `Edit*Dialog` branch to `TransactionRow`.
- **Income is a flat flow event, distinct from positions.** No subtype, no extension tables, no 
snapshots, no transactions, no lifecycle (`status`/`terminated_at`/`termination_note`). The 
mass-noun route lives at `/api/income` (singular collection) — diverges from the plural-collection 
convention elsewhere because "incomes" reads as a count noun we don't intend. Ownership defaults to 
**Sole + current user** in the Create dialog (vs the position-level Joint default) — the 
salary-dominant income case argued for the divergence (M4.5 grilling). Category is mutable 
post-create because all categories share one row shape (unlike 
`investment_transactions.transaction_type` which would invalidate the DB CHECK). When adding new 
income categories: extend the migration 00011 CHECK, the validator `oneof=…` tag in both 
`createReq` and `updateReq` in `internal/income/income.go`, and the `IncomeCategory` union + 
`CATEGORY_LABEL` map in the frontend.
- **Transaction validation is two-layer.** DB CHECK enforces type→shape integrity (e.g., `buy/sell` 
rows must have quantity AND price_per_unit). The repo's `validateInvestmentTransactionType(subtype, 
type)` enforces the subtype→type matrix (e.g., `Coupon` is only allowed on Bond); 
`validateInvestmentTransactionShape` re-checks the shape combo with friendlier error messages. When 
adding a new transaction type or subtype: update the type-enum CHECK in migration 00010, the 
per-type WHEN branch in the same CHECK, and the `allowed` matrix + switch in the two repo helpers. 
Each surfaces as `ErrInvalidTransactionType` or `ErrInvalidTransactionShape`, both 400.
- **`transaction_type` is immutable post-create.** Update payload omits it. To change a 
transaction's type, delete and re-create — changing it would invalidate the shape.
- **`SnapshotChart` is shared.** Don't fork it per group — it's already generic over `{year_month, 
amount}[]`.
- **Title Case** for nav labels, page H1s, data-section card titles. **Sentence case** for 
descriptions, empty-state messages, verb-phrase button labels. See M4.1 close commit for examples.
- **Two-level nav** for groups with subtypes; **flat** for groups without. Liabilities = two-level. 
Receivables = flat. Investments will be two-level.
- **React Query useEffect gotcha.** Never put a `useMutation` result in a `useEffect` deps array — 
it's recreated every render and will loop. There's a comment to this effect in 
`EditSnapshotDialog`; replicate the pattern when needed.
- **Decimals are strings on the wire**, `decimal.Decimal` in Go, with DECIMAL(20,4) for amounts and 
DECIMAL(20,8) for rates/FX. ADR-0011.
- **Rates are stored as percentage** (e.g., `5.5` for 5.5%), not as decimal fraction. Frontend 
reads/writes the same number the user sees on screen — no client-side scaling. Applies to 
`liabilities.interest_rate`, `property_details.annual_amortization_rate`, 
`vehicle_details.annual_depreciation_rate`, `bond_details.coupon_rate`, 
`time_deposit_details.interest_rate`. Backtracked from decimal-fraction storage in migration 00008.
- **Maturity urgency styling** (`lib/maturity.ts`): 4-tier — default (>90d, muted), approaching 
(≤90d, bold), imminent (≤30d, bold + amber, countdown format), matured (muted + ⚠ prefix). Bond + 
TimeDeposit list rows + detail pages share this helper. Don't reinvent the date-comparison logic 
inline.
- **Soft-delete everything**, including snapshots. ADR-0007. Hard-delete is not a UI feature — "can 
be undone via the database" is the line we use in confirm dialogs.
- **Backend lint is enforced.** `golangci-lint run` from `backend/` must be clean. Config at repo 
root in `.golangci.yml`. `revive`'s `exported` and `package-comments` rules are deliberately 
disabled — don't reintroduce godoc-comment-on-every-export expectations for application code. New 
shared blank imports (e.g. SQL drivers) need a justifying comment.
- **Frontend lint is enforced.** `npm run lint` from `frontend/` must be clean. 
`react-refresh/only-export-components` is disabled for `components/ui/**` (shadcn-generated). 
`react-hooks/set-state-in-effect` is enforced everywhere else — no `setState` inside `useEffect` 
body.
- **Pagination clamp is derived during render**, not done in an effect. Pattern: `const 
effectivePage = Math.min(page, totalPages)`. Use `effectivePage` for slicing and for the 
`PaginationControls page` prop; keep raw `setPage` for click handlers. Don't reintroduce 
`useEffect(() => if (page > totalPages) setPage(totalPages))`.
- **Edit dialogs do not reset form state via `useEffect`.** Initial form state comes from the 
entity prop in `useState(() => toForm(entity))` or inline initializer. Parents pass 
`key={entity.id}` so React remounts the dialog on entity switch. Within the same entity, form state 
persists across open/cancel/reopen — by design.
- **Defer cleanup that returns an error must swallow it explicitly**: `defer func() { _ = 
tx.Rollback(ctx) }()`. Applies to `pgxpool.Tx.Rollback` and `sql.DB.Close()`. errcheck catches the 
bare form.
- **E2E selectors use `data-testid`.** Playwright specs target interacted/asserted elements via 
`page.getByTestId('...')` with a matching `data-testid` on the DOM node, not brittle structural 
locators (`locator('label:has-text(…) select')`, `locator('p').filter({hasText:'≈'})`). Test IDs 
are an explicit component↔spec contract that survives copy edits, restyling, and shadcn quirks 
(e.g. `CardTitle` is a `<div>`, not a heading). Stable role/label selectors (`getByRole('tab')`, 
`getByLabel` on properly-associated inputs) are fine to keep. Established in 
`currency-display.spec.ts` (Q15c); the 12 earlier specs predate the convention and still use 
role/text — retrofit only if/when touched, not as a speculative sweep.
- **Tenancy test pattern**: every position group's `*_tenancy_test.go` covers both the cross-tenant 
rejection path (bob attempts X, expects `ErrNotFound`) and the alice-side happy-path CRUD success 
(update + delete on entity and snapshot, then verify Get/List). Cross-tenant alone leaves 
`Update*`/`Delete*`/`softDeleteAsset` success branches uncovered because the rejection 
short-circuits at the GetX guard. **List must be tested with the entity still present** (alice 
creates entity + snapshot, then lists, asserts shape) — testing only the post-delete empty list 
leaves the detail+snapshot join loop in `List*` unexercised. Phase 2c fixed this for 
`ListProperties` + `ListVehicles` (both were at 21.9%); use those subtests as the template when 
adding a new group.
- **HTTP error mapping skips unreachable repo sentinels.** `repoErrorStatus` / `writeRepoError` in 
the 4 position-group HTTP packages map only sentinels reachable through HTTP — `ErrNotFound` (and 
investments-specific 400 sentinels) yes, `ErrUnauthenticated` no. `RequireAuth` gates every route 
in each package's `Mount`, so a repo's `currentUser()` always finds a user; if a future misconfig 
ever leaked one, the fall-through to 500 is correct (server bug, not client error). Don't 
reintroduce the `ErrUnauthenticated` case.

## Things explicitly NOT to do

- **Don't autoflush commits.** When work seems ready, stage + show the diff + ask. Push only on 
explicit green light. After every push, watch CI to completion (`gh run list --branch <branch>` / 
`gh run watch <id>`); if a workflow fails, surface the failure with logs and ask the user whether 
to fix now or defer. Don't declare a commit done while runs are still queued or in_progress.
- **Don't dive into UI alone.** User has near-zero frontend skill and relies heavily on you for UI 
— but expects to be consulted on UX choices (form density, navigation, button labels). Always 
surface tradeoffs.
- **Don't fear backtracking on prior decisions** if they're suboptimal — pre-alpha migrations are 
not sacred. User explicitly accepted this. Flag the issue, propose the better path, let user decide.
- **Don't create planning/analysis documents** unless asked. Live state goes in this file or in 
memory; design decisions go in ADRs; nothing else.
- **Don't bypass `--no-verify` or `--no-gpg-sign`** on git commits.
- **Don't add features beyond the task.** No speculative abstractions. Three similar lines beats 
premature abstraction.
- **Don't add comments that just restate the code.** Only add when WHY is non-obvious.
- **Don't auto-start the next milestone** without explicit user instruction. User pauses between 
milestones to direct.

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

The backend is `serve`, not `server`. There is **no dev-login backdoor** — auth is real Google 
OAuth. For backend smoke tests against authenticated endpoints, pull a current session token from 
the `sessions` table:

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

CI runs both on every push. golangci-lint config is at `.golangci.yml` (repo root); ESLint config 
is `frontend/eslint.config.js`. The Codecov config (`codecov.yml`) keeps coverage status 
informational-only — failing CI from coverage drops is a deliberate non-goal until alpha.


## Deferred backlog

Optional / not-yet-scheduled items. The committed M6 work is under "What's next" above; the full
original wording of everything here — including items already resolved (side-by-side currency,
invite-form relocation, the `users.nickname` build, vitest setup) — is preserved verbatim in
`CHANGELOG.md`.

- **React Router migration** (M4.9).
- **Snapshot future-date validation.** `year_month` and `as_of_date` on the create/update
  snapshot endpoints currently accept any date, including future ones. A snapshot is by
  definition a past observation, so `year_month > current month` or `as_of_date > today` is
  nonsense. Scope: 5 create + 5 update handlers (asset, liability, receivable, investment
  quantity-price, investment accrued-interest), matching `max` attributes on the frontend
  date/month inputs, and 400-path tests. Application-layer validation only — existing rows are
  grandfathered. Apply the same to `transaction_date` on the M4.4 transaction endpoints (5 shapes
  share one endpoint, so one create + one update path to guard).
- **Per-bond `coupon_disposition` field** (escalation path). The bond accrued-interest snapshot
  dialog ships a global `accrued=0` default plus copy explaining the override path. If users
  repeatedly override (e.g. mostly secondary-market holders) or repeatedly forget to, escalate to
  a per-bond enum `coupon_disposition: 'pays_out' | 'accrues'` on `bond_details` and pivot the
  form on it. No signal yet that we need it.
- **Bond lots/quantity modeling.** Buy/Sell bond transactions carry `quantity` + `price_per_unit`,
  but `bond_details.face_value` stays a user-edited total with no enforced reconciliation against
  the ledger. Revisit only if real usage shows the disconnect is confusing.
- **Transaction-list aggregations.** No "transaction count" / "last transaction date" on the
  subtype list rows yet. Would add a column to `*ListItem` aggregates + a sqlc query; reuse the
  snapshot `listKey` invalidation pattern from `useInvestmentTransactions`.
- **Gold purity input UX.** Free-text decimal works (`formatGoldPurity` renders "24K (.999+)",
  "22K", etc.) but typing `0.999` for 24K is awkward. Carat picker deferred — constraint is "must
  distinguish 24K (.999) from Antam bar (.9999) without sub-percent precision loss". Possible
  shape: a `<select>` of 24K/22K/20K/18K/14K/10K + **Custom**, with 24K → `0.9999`.
- **Path-filtered CI.** `.github/workflows/ci.yml` runs all three jobs on every push/PR,
  including doc-only changes. Add `paths:` filters (backend jobs on `backend/**`, frontend on
  `frontend/**`); cross-cutting files (`ci.yml`, `Makefile`, `codecov.yml`, `.golangci.yml`, root
  configs) must trigger both. Required-check gotcha: under branch protection a skipped job blocks
  merges (skipped ≠ success) — add a `ci-gate` aggregator (`if: always()`, succeeds when each dep
  is success-or-skipped) as the single required check from day one. No branch protection today, so
  low risk now.
- **Nickname feature not e2e-smoke-tested.** `users.nickname` shipped without a Playwright spec
  (Google-OAuth-only). Eyeball the Settings "Your name" card + an owner picker on the dev server,
  or add a spec once E2E auth injection covers it.
- **Component tests (RTL + MSW + jsdom).** Deferred until component tests begin (ADR-0021). Vitest
  covers `lib/*` today. Do **not** add Playwright/E2E to the coverage metric — it's a behavioural
  net, not a coverage instrument.

## Updating this document

When you close a milestone, update this file in the closing commit — don't let it drift more than
one milestone behind reality. Keep it a **live-state pointer**: current status, what's next,
conventions, deferred backlog. Push the blow-by-blow detail of what shipped into `CHANGELOG.md`
(newest milestone first), not here. Hard-wrap prose at ~100 columns so the file stays
diff-friendly and readable by file tools.
