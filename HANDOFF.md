# Handoff — pick this up cold

You are an agent resuming work on **balances-v2**. This document is the live state of the project:
what's true now, what's next, the conventions to keep, and the deferred backlog. Pair it with the
durable design docs (`CONTEXT.md`, `docs/adr/*`, `docs/ROADMAP.md`) and with `CHANGELOG.md` for the
blow-by-blow of what each milestone shipped.

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
- **M5** — materialized monthly net-worth report + dashboard, in three slices: net-worth headline,
  comprehensive-income lines, and side-by-side currency display (Q15c).
- **M6 (in progress)** — shipped so far (newest last; see `CHANGELOG.md` for blow-by-blow):
  - Snapshot importer (xlsx, all 10 groups + 5 investment subtypes).
  - Self-set `users.nickname` for compact owner labels.
  - List-screen polish swept across all 10 groups.
  - Header Google-profile-picture avatar (`users.picture_url`).
  - Backend-coverage backfill after the importer/lifecycle handlers (codecov backend back to 83.7%).
  - React Router migration + sidebar nav shell (ADR-0025 — delivers the M4.9 backlog item and fixes
    mobile tab overflow).
  - Snapshot/transaction future-date validation (5+5 snapshot + 1+1 transaction handlers; matching
    `max` attribute on frontend month/date inputs; injectable `now` clock for tests).
  - Income `regularity` flag (migration 00017; `routine|incidental`; `Repeat`/`Sparkles` row icons
    + chip-bar filter).
  - `investments.risk_profile` flag (migration 00018; `low|medium|high`; shared `RiskProfileBadge`
    + `RiskProfileFilter` across all 5 subtype list screens).
  - E2E smoke for the nickname + Google-picture features (mock-oidc emits a `picture` claim;
    `picture.spec.ts` + `nickname.spec.ts`).
  - Property/vehicle revaluation-rate UI helper (Q8a) — and a taxonomy fix renaming
    `annual_amortization_rate` → `annual_appreciation_rate` (migration 00019, signed % /yr);
    shared `lib/revaluation.ts` + sign-aware hint in `CreateSnapshotDialog`.
  - Dashboard month picker: 120-option `<select>` → `MonthPickerPopover` (shadcn Popover +
    year-nav + 4×3 month grid, disabled cells for months without a report).
  - Indonesian financial-vocab glossary (`docs/glossary-id.md`) — canonical EN↔ID dictionary that
    issues #5–#11 translate against.
  - Chrome extraction (issue #5): `AppShell`, `AppSidebar`, `SignInScreen`, `SettingsScreen`,
    `InviteForm`, `ConfirmDialog`, and the 3 group-home placeholders now route every literal
    through `t()`; `common`/`nav`/`settings` namespaces populated EN+ID. i18next swapped from
    `i18next-http-backend` to bundled-resource init (static JSON imports of every catalog) — see
    CHANGELOG for the language-tag-mismatch debug story behind the swap.
  - Dashboard extraction (issue #6): `DashboardScreen` (incl. headline, breakdown, by-person,
    FX-this-month, comprehensive-income panel, rebuild footer), `MonthPickerPopover`, and the
    shared `SnapshotChartImpl` legend now translate; `dashboard` namespace populated EN+ID,
    short month names added to `common.months.*`. i18next pluralisation (`_one`/`_other`) used
    for stale-positions + missing-FX lines.
  - Bank-accounts extraction (issue #7, **template** for #8–#11): `BankAccountsScreen` +
    `Detail` + `ListRow` + `Create/Edit` dialogs, the shared `Create/EditSnapshotDialog` +
    `SnapshotRow` + `ImportSnapshotsDialog` + `TerminatePositionDialog`, and the cross-list
    `ListHeadline` + `ShowInactiveToggle` all route through `t()`. Group-specific copy →
    `assets.bankAccount.*`; shared field labels → `common.fields.*`; shared dialogs →
    `common.snapshot/terminate/import.*`; `errors.failedToLoad` populated. `lib/lifecycle.ts`
    (`statusLabel` + new `statusOptions(group)`) and `lib/ownership.ts` (`ownershipLabel`)
    translate via the imported `i18n` instance with English `defaultValue` fallbacks so the
    node-env unit tests keep passing. Pattern doc lives at the top of `BankAccountsScreen.tsx`.
  - Properties + Vehicles extraction (issue #8): both asset subtypes end-to-end (5
    components each: `*Screen` / `*Detail` / `*ListRow` / `Create*Dialog` / `Edit*Dialog`)
    plus the sign-aware revaluation hint in the shared `CreateSnapshotDialog`. Group-specific
    copy lives under `assets.property.*` and `assets.vehicle.*` (closed enums
    `propertyTypes` + `vehicleTypes`; per-form fields including the
    `appreciationRate` / `depreciationRate` labels + placeholders;
    `appreciationRateValue: "{{value}} /yr"` / `/thn` suffix key). Shared
    snapshot/terminate/import dialogs reused from #7 with **no new shared keys**. The
    revaluation hint split into `revaluationHintAppreciate` (positive rate → "+X%
    appreciation" / "apresiasi X%") and `revaluationHintDepreciate` (negative rate →
    "−X% depreciation" / "penyusutan X%") so ID reads with verb forms, not a stray
    glyph. ID copy from the glossary: Properti, Kendaraan, Rumah/Apartemen/Tanah/
    Komersial, Mobil/Motor, Apresiasi/Penyusutan.
  - Liabilities + Receivables extraction (issue #9): both position groups end-to-end
    (5 components each: `*Screen` / `*Detail` / `*ListRow` / `Create*Dialog` /
    `Edit*Dialog`). Liabilities namespace carries the personal/institutional subtype
    enum + per-subtype screen titles/descriptions (`liabilities.screens.personal.*`
    + `.institutional.*`) so one screen renders either tab. `liabilities.json` also
    owns the loan-detail row keys (principal / interest-rate / term / period
    label+value), with the per-month term using i18next's `_one`/`_other` plural
    suffix. Receivables namespace owns the `detailSubtitleWithDue` /
    `rowDueSuffix` interpolation keys so the due-date snippet localises. **No new
    shared dialog keys** — the four shared dialogs from #7 drove both groups
    unchanged. ID copy from the glossary: Liabilitas Pribadi / Institusional,
    Piutang, Pihak lawan (counterparty), Pokok (principal), Suku bunga (interest
    rate), Tenor (term, common Indonesian finance loanword), Jatuh tempo (maturity
    / due date).
  - Income extraction (issue #11): the flat flow-event group end-to-end
    (`IncomeScreen` + `IncomeRow` + `Create/EditIncomeDialog`). `income` namespace
    carries: the 7 categories under `categories.*` (short row-chip labels:
    Salary / Business / Rental / Gift / Tax refund / Insurance / Other) and a
    parallel `categoryOptions.*` block with the longer dropdown forms ("Business
    income"); regularity copy (`regularity.routine` / `incidental` + the icon
    `*RowLabel` variants for the Repeat / Sparkles row icons); the three-chip
    `filter.{all,routine,incidental}` bar plus three matching `emptyAll` /
    `emptyRoutine` / `emptyIncidental` lines so the filter-empty noun reads
    naturally per locale; the delete-confirm summary as a single interpolated
    sentence. Sole-default semantics preserved (M4.5 grilling lineage). ID copy
    from the glossary: Pemasukan (Income), Gaji / Pendapatan usaha / Pendapatan
    sewa / Hadiah / Pengembalian pajak / Klaim asuransi / Lainnya (categories),
    Rutin / Insidental (regularity), Duplikat (Duplicate row-action verb).
  - Investments extraction (issue #10): all 5 subtypes end-to-end plus the
    shared transaction / snapshot dialog set — the largest slice by file
    count (30 components + 6 snapshot-fork files + 8 transaction-fork files
    + `TransactionRow` + the 3 `RiskProfile*` components + `lib/maturity.ts`).
    Per-subtype copy under `investments.{stock,mutualFund,bond,timeDeposit,
    gold}.*`; shape-shared transaction blocks (`trade.*` / `cashIncome.*` /
    `fee.*` / `maturityTxn.*`) plus `transactionType.*` (7 enum labels),
    `transactionRow.*` (detail templates + delete confirm + rolled-impact
    label), `disposition.*` (full + short forms for the maturity detail
    line). Snapshot dialogs split by shape under
    `quantityPriceSnapshot.*` + `accruedInterestSnapshot.*` + a shared
    `snapshotsCard.*` (chart titles + table headers) + `snapshotRow.*`.
    `riskProfile.*` covers badge labels + chip filter + select options +
    localised single-letter pips (L/M/H → R/S/T in ID). `lib/maturity.ts`
    switched to `i18n.t({ defaultValue: <english> })` mirroring
    `lib/lifecycle.ts` so the node-env unit tests still pass. ID copy
    from the glossary: Saham, Reksa Dana, Obligasi, Deposito, Emas
    (subtypes), Beli / Jual / Kupon / Dividen / Distribusi / Biaya /
    Jatuh Tempo (transaction types), Pokok / Nilai Nominal / Bunga
    Berjalan / Suku Bunga / Tenor / Penempatan / Tanggal Jatuh Tempo,
    Risiko Rendah / Sedang / Tinggi, Dicairkan / Digulung ke baru
    (maturity dispositions).
  - E2E locale pin (issue #12): the en-GB pin gets a single-source-of-truth
    convention doc at `frontend/e2e/README.md`. The pin itself was already
    in place via two layers (backend `seed-e2e` writes `locale='en-GB'`
    on Alice + Bob; `global-setup.ts` pre-seeds
    `localStorage['balances.locale']`); audit of every `getByText` on
    translated copy confirms each string still resolves to the canonical
    EN value. Spec writers exercise the ID UI by clicking the Settings
    language dropdown, never by mutating the seed.
  - Backend error-code envelope (issue #13, slices 1–3 of 4): ADR-0027
    designs the `{code, args}` wire shape (no `message` in prod); new
    `internal/httperr` package (`Envelope`, `Write`, `WriteRepo`,
    `WriteValidation`, `NewValidator` with JSON-tag-name func) and
    `internal/errs` leaf (sentinel error vars re-exported by
    `internal/repo/errors.go` to break the auth → httperr → repo →
    auth cycle). Every `http.Error(...)` site across
    `internal/{assets,liabilities,receivables,investments,income,
    fxrates,reports,auth-non-callback}` swapped to the envelope; ~23
    exported `Code` constants in `internal/httperr/codes.go`; new
    `CodeUnauthorized` for the middleware 401 (distinct from repo's
    unreachable `ErrUnauthenticated`). The OAuth callback redirects
    and the mock OIDC subcommand stay exempt per the ADR.
  - Frontend error-envelope sweep (issue #13, slice 4 of 4 — closes
    the issue): `@/api/client` retypes `ApiError.body` to
    `ErrorEnvelope | string | undefined` and exports
    `ErrorEnvelope` + `isEnvelope()`; new `src/lib/errorMessage.ts`
    helper resolves envelope → `errors:code.<CODE>` with `args`
    interpolated (VALIDATION fans out via sibling
    `errors:code.VALIDATION_RULE.<rule>` because JSON can't keep a
    string and an object at the same key — one structural deviation
    from the ADR sketch). 39 components delete their local
    `formatError` clone in favour of `errorMessage(mutation.error)`;
    `SettingsScreen`'s parallel `errText` helper swaps too. EN + ID
    `errors.json` populated for all 23 codes + the 7 validator-tag
    sub-keys actually used (`required`, `required_if`,
    `required_unless`, `email`, `gt`, `iso4217`, `oneof`). Net
    +188/−458 across 44 files; vitest 127/127, vite build green,
    backend suite green (no backend changes), Playwright E2E green
    locally.
  - Investment screens enhancements (issue #14, slice 14a of 4 —
    smallest-risk first): right-align sweep across the three shared
    detail-screen row components (`QuantityPriceSnapshotRow`,
    `AccruedInterestSnapshotRow`, `TransactionRow`) plus the matching
    `TableHead` cells on all 5 detail screens; bond detail Σ coupons
    + Σ fees totals strip above the Transactions table (maturity
    payouts deliberately excluded as terminal, not recurring); new
    `lib/transactionSearch.ts` (`matchesTxnSearch`) wired into all 5
    detail screens via a `data-testid="txn-search"` input above the
    Transactions table. Filter matches localised transaction-type
    label + description; investment transactions have no separate
    counterparty field, so the description doubles as that surface.
    New shared keys `transactions.searchPlaceholder`/`searchEmpty` +
    `bond.totalCouponsLabel`/`totalFeesLabel` populated EN+ID. Net
    +345/−183 across 11 files; vitest 127/127, vite build green,
    eslint 0 errors.
  - Investment screens enhancements (issue #14, slice 14c of 4):
    list-screen headline now shows aggregate Value / Cost / P/L per
    currency (`InvestmentListHeadline` swaps the existing
    `ListHeadline` on all 5 investment list screens), and a new
    `ListTimeGraph` renders one card per currency with the
    SnapshotChart's value-Area + cost-Line. New
    `lib/listAggregates.ts` (10 unit tests) sums per-currency
    {value, cost, pl} and builds carry-forward monthly series.
    New `hooks/useInvestmentBatch.ts` (`useInvestmentBatchSnapshots`
    + `useInvestmentBatchTransactions`) wraps `useQueries` with
    the same per-position query keys as the detail-screen hooks
    so the cache is shared. Stock/MF/Gold use ledger replay
    (`computeCostBasis`); Bond branches on `hasBuys` (ledger or
    flat face_value); TD always uses flat principal (no
    transactions fetch — TD ledger has only Maturity). New keys
    `investments.list.{totalCost,unrealizedPL,chartTitle,
    chartDescription}` EN+ID. Multi-currency households see one
    chart card per currency (no FX, matching the no-FX list
    convention); the structural fix for the per-list N parallel
    fetches is tracked in **#18** (backend cost_basis aggregate
    on each subtype's ListItem). Net +600/−16 across 12 files
    (7 modified + 5 new); vitest 153/153 (+10 new), vite build
    green, eslint 0 errors. Backend untouched.
  - Investment screens enhancements (issue #14, slice 14b of 4):
    cost-basis line on the detail-screen time graphs + headline
    `Total cost` / `Unrealized P/L` row beneath each H1. New pure
    helper `lib/costBasis.ts` exports `computeCostBasis`,
    `costBasisSeries`, `flatCostSeries` — avg-cost FIFO-ish (buys
    add cost + qty, sells reduce both proportionally, standalone
    fees capitalize, income/maturity ignored); 16 unit tests cover
    oversell, missing data, date-order independence, mid-month
    snapshot attribution. `SnapshotChart` (+ `Impl`) gain an
    optional `costSeries` prop and render a muted-slate `<Line>`
    under the value `<Area>` with a `<ChartLegend>`; non-investment
    detail screens omit the prop and render unchanged. Per-subtype
    cost-basis source: Stock/MF/Gold/Bond-secondary derive from the
    ledger via `costBasisSeries`; Bond govt-primary (no Buy txn)
    falls back to `flatCostSeries(face_value)`; TD always uses
    `flatCostSeries(principal)`. New `InvestmentHeadline`
    component (mounted under each detail H1) renders `Total cost: X`
    + `Unrealized P/L: ±Y (±Z%)` with emerald/destructive/muted P/L
    tone and `−` U+2212 minus glyph; suppresses the P/L line when
    `status !== 'active'` and surfaces `Matured on {date}` /
    `Sold on {date}` instead (works around the end-of-month-snap-
    at-0 problem for matured/sold positions — see #17 for the
    backend auto-snapshot follow-up). New keys
    `investments.headline.{totalCost,unrealizedPL,
    unrealizedPLEmpty,closed.{matured,sold,default}}` +
    `dashboard.chart.costLegend` (EN+ID); glossary gains
    Cost/Modal + Unrealized P/L + Fee/Biaya rows with rationale.
    Net +290/−12 across 15 files (12 modified + 3 new); vitest
    143/143 (+16 new), vite build green, eslint 0 errors. Backend
    untouched.
  - Investment screens enhancements (issue #14, slice 14d of 4 —
    closes the issue): `/investments` landing rebuilt from
    placeholder to a cross-subtype dashboard. Aggregates all 5
    subtypes into one `InvestmentListHeadline` (Value / Cost /
    P/L) plus, per currency, four chart cards: value+cost over
    time (reuses `SnapshotChart`), 100%-stacked category share
    over time (new `CategoryStackChart` — recharts AreaChart
    with `stackOffset="expand"`), and two pies (current
    category mix + risk-profile mix, new shared
    `InvestmentPieChart`). New pure `lib/homeAggregates.ts`
    (9 unit tests) wraps `aggregateListPositions` and layers
    monthly carry-forward category breakdown + current pies;
    `INVESTMENT_CATEGORIES` + `INVESTMENT_RISK_PROFILES`
    arrays provide stable ordering. Per-subtype cost-basis
    sources unchanged from 14b/14c: Stock/MF/Gold ledger-replay,
    Bond branches on `hasBuys`, TD flat principal. Single
    batched `useInvestmentBatchSnapshots`/`Transactions` across
    all subtypes (shares cache with detail screens and per-list
    screens). **No FX**, matching the 14c list convention:
    multi-currency households see one set of 4 cards per
    currency. **Color choices** documented in
    `CategoryStackChartImpl.tsx` + `InvestmentsHome.tsx`: 5
    distinct Tailwind 500-level hues for categories (cyan /
    violet / blue / emerald / yellow — gold gets a literal
    gold/yellow), traffic-light emerald/amber/red for risk
    (matches existing P/L tone language). New keys
    `investments.home.{subtitle,valueCostChart*,
    categoryStack*,categoryPie*,riskPie*,categoryLabel.*}`
    EN+ID; risk pie reuses existing `riskProfile.badge*` labels.
    Net +744/−6 across 9 files (3 modified + 6 new); vitest
    162/162 (+9 new), vite build green (3 new lazy chunks:
    CategoryStackChartImpl, InvestmentPieChartImpl, AreaChart),
    eslint 0 errors on new code. Backend untouched.
  - Date inputs 4-digit year cap (issue #15): `max="9999-12-31"`
    added to 17 unbounded `<input type="date">` sites across 13
    dialogs (bond/TD maturity, TD placement, liability start +
    maturity, receivable due, income date, property acquisition,
    terminated_at) so the picker no longer accepts a 6-digit
    year. Past-only inputs already capped via `max={todayDate()}`
    / `max={thisYearMonth()}` unchanged. Vitest 162/162, vite
    build green, eslint 0 errors. Net +17/0 across 13 files.
    Backend untouched.
  - Investment graphs include closed positions (issue #21):
    `lib/listAggregates.ts` + `lib/homeAggregates.ts` now keep
    terminated positions in their time series, capped at the
    position's `terminated_at` month — headline + count + pies
    stay active-only (current state), only the historical
    over-time views change. `Position` gains
    `terminated_at: string | null`, threaded through all 5 list
    screens + `InvestmentsHome`. Mid-month closures will read
    inflated until #17 (auto-snapshot on Maturity) lands; the
    aggregator comment notes the dependency. Vitest 164/164
    (+2), vite build green, eslint 0 errors. Net +171/−24
    across 10 files. Backend untouched.
  - Auto-snapshot on Maturity (issues #17, closes #16):
    `CreateInvestmentTransaction` for `TxnTypeMaturity` now
    upserts an `investment_snapshots` row at
    `firstOfMonth(transaction_date)` with `amount = principal +
    interest` and `accrued_interest = interest` — atomic with
    the existing flip to `matured`, idempotent via the
    importer's `UpsertInvestmentSnapshot`. Resolves the
    end-of-month-snap-at-0 misread (−100% P/L) for matured
    bond / TD positions; `InvestmentHeadline` short-circuit
    narrowed to `status === 'sold'` (sold manual-terminate flow
    still has no auto-snap). `headline.closed.matured` +
    `.default` i18n keys dropped EN+ID. Two new tenancy
    sub-tests (basic + idempotent upsert over a pre-maturity
    snap). Backend tests + golangci-lint green; vitest
    164/164; vite build + ESLint 0 errors. Net +148/−22 across
    5 files.
  - Backend `cost_basis` aggregate on investment ListItems (issue #18):
    each subtype's `*ListItem` now carries a `cost_basis decimal` so the
    list headline P/L is self-contained — Go ledger replay
    (`costBasisFromLedger`, mirroring `lib/costBasis.ts`) over a new batch
    query, Bond branching ledger-vs-face_value, TD flat principal. All 6
    list screens + `InvestmentsHome` read `item.cost_basis` for the
    headline (robust to a failed txn batch); the txn batch survives only
    for the time-graph cost series — full removal tracked in **#22**
    (monthly cost-basis series endpoint).
  - Monthly cost-basis series endpoint (issue #22): new
    `GET /api/investments/time-series` returns every position's monthly
    `value_series` + `cost_series` in one household-scoped call (Go
    `InvestmentTimeSeries`, cost sampled at snapshot months to mirror
    `lib/costBasis.ts`). Retires the per-position `useInvestmentBatch*`
    fan-out: all 6 list/home screens now drive their time graphs from one
    `useInvestmentTimeSeries` fetch; the old hook + all client-side
    `costBasisSeries`/`flatCostSeries` on the list screens are gone
    (detail screens keep `lib/costBasis.ts`). Closes the #18 follow-up.
  - Built-in instruction manual (issue #23): a "Help" button on every
    position detail screen launches a `driver.js` guided tour that
    spotlights each section with non-technical EN+ID copy teaching the
    workflow (cost/P&L derivation, chart reading, snapshot/transaction/
    maturity flows). Shared `HelpTourButton` takes translated `TourStep[]`
    and prunes steps whose `data-testid` anchor isn't rendered; chrome in
    new `common:tour.*`. POC on Bonds, rolled to all 10 detail screens
    (5-step variant for non-investment positions). Income out of scope
    (flat flow-event). Writing the bond copy surfaced #25.
  - Truthful 0-value close snapshot on maturity/termination (issue #25,
    fixes #16/#17 fallout): reverses #17's *data* approach (it wrote a
    `principal + interest` maturity snapshot that made the Dashboard
    investment-return line double-count the payout) while keeping its
    frontend affordances. Maturity + manual Sell/terminate now write a `0`
    close snapshot (subtype-shaped); un-terminate removes it. Engine
    unchanged — the formula was always correct, #17 just fed it a fictional
    value. Headline shows "Matured on {date}" (re-widened from sold-only);
    detail graph drops the trailing `0` and marks Sold/Matured. ADR-0008
    (liquidation-to-0 assumption made explicit) + ADR-0009 (close-snapshot
    rule) amended; help-tour copy gained an end-of-month "record bank
    balances too" recommendation. Subsumes the deferred "auto-snapshot on
    Sell" item.
  - Capital at entry is a transaction, never return (issue #27, placement-side
    mirror of #25): deploying principal into a `govt_primary` bond or a TD used
    to book the full principal as that month's return (no `cash_in` to cancel
    the `0→principal` snapshot jump). Bonds now seed a placement **Buy** at
    create (govt_primary, IDR-1M units at par; secondary records its own Buy),
    and `bond_details.face_value` is **dropped** (migration 00021) — outstanding
    nominal derives from the ledger (`outstanding_face`). TDs get an
    engine-synthesized placement `cash_in` from `principal` + `placement_date`
    (option a — no new txn type, no backfill). Placement month now nets to `0`;
    combined with #25, capital is excluded at both entry and exit. ADR-0008/0009
    amended. Resolves the deferred "bond lots/quantity modeling" backlog item.
  - Value-over-time graphs never skip months (issue #24): all monthly series
    now walk a continuous `monthRange` (`lib/months.ts`) with carry-forward,
    so gap months stay on the categorical X axis and the timeline reads
    proportionally instead of collapsing unequal gaps to equal spacing. Both
    list/home aggregators also drop a matured position's 0-value close
    snapshot (#25) so the summed line carries its last real value through the
    termination month instead of cratering to 0 — the detail-chart maturity
    trick, now on the aggregate graphs too. **(The carry-*through*-termination-
    month part was superseded by the rollover-seam fix below — closed positions
    now end the month *before* `terminated_at`.)** Plus two chart-readability fixes:
    the Sold/Matured marker label no longer clips off the chart edges
    (`textAnchor: 'end'` + top headroom), and the tooltip labels each line
    ("Value"/"Cost") instead of showing bare numbers.
  - Duplicate-matured-TD rollover helper (Q14c-iv): a matured TD whose principal/interest rolled
    over now shows a teaching callout offering "Create rollover deposit", which opens the Create-TD
    dialog pre-seeded from the matured position (placement = maturity date, principal = rolled sum).
    New pure `lib/rollover.ts` (`maturityRolloverPrefill` + shared `addMonths`); `CreateTimeDepositDialog`
    gained optional `prefill`/`trigger*` props. Frontend-only.
  - Aggregate graph rollover-seam fix (refines #24/#21): closed positions now end the month *before*
    `terminated_at` on the list/home time graphs (not carried *through* it), so a same-month rollover
    (R0 matures → R1 placed same month) no longer double-counts the seam month. Both aggregators drop
    the termination month via a `live(m) = m < termMonth` filter + a `>=` walk cap; the 0-close-drop
    block is deleted. Unifies the aggregate with the detail chart. Frontend-only.
  - Suppress rollover callout once a successor exists (issue #29): explicit-FK approach (option 1).
    Migration 00022 adds nullable self-ref `investments.rolled_from_investment_id`; TD create accepts
    + tenancy-validates it; `GetTimeDeposit` derives `rolled_from` / `rolled_to` `RolloverRef`s;
    `maturityRolloverPrefill` short-circuits when `rolled_to` is set. Hand-created successors stay
    unlinked (accepted scope). TD detail gained a **Rollover card** linking the immediate chain
    neighbours (predecessor + successor) via a router-unaware `onSelectTimeDeposit` callback.
  - Faster dev-server restart (issue #30): `make restart` now polls real readiness instead of
    blind `sleep 1`s — stops wait for the process to exit (SIGTERM → graceful, then SIGKILL
    escalation), starts poll backend `/healthz` + vite's `Local:` line. ~3s of dead sleep → ~1.6s
    and the command only returns once both servers actually serve. Shutdown grace period made
    adjustable via `SHUTDOWN_TIMEOUT` (config, default `10s`). Also detached the backgrounded
    jobs from the caller's stdout (`( cd DIR && exec nohup CMD ) > LOG 2>&1 < /dev/null &`) so a
    *piped* `make restart` (agent shell tools, `| tee`) no longer blocks for minutes on a pipe
    the lingering recipe sub-shell kept open — terminal use never saw it, captured callers did.
    `nohup` is retained (its `SIG_IGN` survives `go run`'s fork+exec to the real server) so the
    servers still outlive a closed terminal; verified by direct SIGHUP to the listening pid.
  - Mutual-fund `fund_type` (issue #20; migration 00023): a global closed enum on
    `mutual_fund_details` — the four universal ICI/Morningstar asset classes (money_market,
    fixed_income, equity, mixed) + structural wrappers (index, etf, target_date, commodity) +
    `other`. NOT on shared `investments` (subtype-specific → extension table, ADR-0022). Forced
    choice on create (no default, like risk_profile); legacy rows backfilled to `other`. New
    `MutualFundTypeSelect` in Create/Edit dialogs; list row shows the type as a muted chip in the
    Name column. EN/ID `mutualFund.fundType.{option,short}` populated. Syariah/ESG kept orthogonal
    (a future flag, never a fund_type value).
  - Position-control buttons (issue #31): per-position Add Snapshot + Import moved from the
    detail-screen top-right into the snapshots-card header (mirrors the transactions card). A
    follow-on pass tightened every create/manage button across all detail + list screens — terser
    labels (`New`/`Import`/`Close`/`Status`, literal `+ ` dropped) + lucide icons (Plus/Upload/
    Pencil/Trash2/Archive) — with tour + `snapshotsEmpty` copy and e2e selectors repointed, both
    locales. Also fixed a pre-existing `bond-snapshot.spec` gap (unfilled required `placement_date`
    since #27; Playwright isn't in CI). Frontend-only.
  - Fee cash→quantity helper (Q12): the unit-settled-fee dialogs (`Create/EditFeeTransactionDialog`)
    now auto-derive units deducted from cash ÷ conversion price (new pure `lib/feeQuantity.ts`,
    6 unit tests, 8dp). Fields reordered to read as a calculator (amount → price → derived units);
    the derive is non-destructive — once the user types into the units field (`qtyTouched`) it
    stops, and Edit seeds `qtyTouched` from the saved quantity so stored figures are never
    clobbered. New `fee.derivedHint` key EN+ID. Frontend-only.
  - E2E coverage for the help tours (issue #26): new `e2e/tour.spec.ts` (5 specs) drives the
    driver.js guided tours — launch/Next/Back/Done + progress text, anchoring via the
    `driver-active-element` class on each `data-testid` target, chart-step pruning (< 2 snapshots →
    4 steps) + closed-position header anchor, the 5-vs-7 step variants, and an EN→ID locale switch
    via the Settings dropdown. `make e2e` 21/21. Behavioural net, out of coverage (ADR-0021).
  - Logo / brand mark: snapshot-scale glyph + outlined IBM Plex Sans wordmark; canonical assets +
    regeneration recipe in `docs/brand/`. Wired into sidebar, mobile header, and sign-in (dark-only
    for now; both theme variants shipped). Per-user theme switcher deferred to issue #33.

A CI/coverage side quest (post-M4.2) stood up GitHub Actions: golangci-lint + `go test -race
-coverprofile` + Codecov + ESLint + `npm run build` on every push to `main` and every PR. Coverage
thresholds are informational-only until alpha. The jobs are now path-gated: a `changes` job resolves
the changed-file list with plain `git diff --name-only` (no third-party action, so no Node-runtime
deprecation or marketplace supply-chain surface) and emits `backend`/`frontend` flags. Backend jobs
run on `backend/**`, frontend on `frontend/**`, and the cross-cutting set — `ci.yml`, `Makefile`,
`codecov.yml`, `.golangci.yml` — on both. The classifier is fail-safe: any unresolvable diff range
(first push, force-push, base missing from history) runs every job, so the only failure mode is
running too much, never skipping a job whose paths changed. A `ci-gate` aggregator (`if: always()`)
always reports one stable status so a future branch protection has a safe required check. For the detailed writeup of any milestone above, see `CHANGELOG.md`.

## What's next

M6 is the v1-polish milestone (see `docs/ROADMAP.md`). Still open in M6:

- **PDF export** of monthly reports (user requirement, Q22).
- **Migration consolidation** — squash the ~15 accumulated pre-alpha migrations into one
  initial-schema migration before the first production deploy.
- **Deploy** — choose a hosting target and ship it; configure a real Resend domain for production
  email; document DB backup/restore. **SPA history fallback required** (serve `index.html` for
  unknown non-`/api` paths) now that routing is client-side — vite dev/preview already do it, the
  production static server must too (ADR-0025).

Don't auto-start the next item — the user pauses between milestones to direct. The deferred backlog
below holds the smaller, optional items.

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
  convention elsewhere because "incomes" reads as a count noun we don't intend. Ownership defaults
  to **Sole + current user** in the Create dialog (vs the position-level Joint default) — the
  salary-dominant income case argued for the divergence (M4.5 grilling). Category is mutable
  post-create because all categories share one row shape (unlike
  `investment_transactions.transaction_type` which would invalidate the DB CHECK). When adding new
  income categories: extend the migration 00011 CHECK, the validator `oneof=…` tag in both
  `createReq` and `updateReq` in `internal/income/income.go`, and the `IncomeCategory` union +
  `CATEGORY_LABEL` map in the frontend.
- **Transaction validation is two-layer.** DB CHECK enforces type→shape integrity (e.g., `buy/sell`
  rows must have quantity AND price_per_unit). The repo's
  `validateInvestmentTransactionType(subtype, type)` enforces the subtype→type matrix (e.g.,
  `Coupon` is only allowed on Bond); `validateInvestmentTransactionShape` re-checks the shape combo
  with friendlier error messages. When adding a new transaction type or subtype: update the
  type-enum CHECK in migration 00010, the per-type WHEN branch in the same CHECK, and the `allowed`
  matrix + switch in the two repo helpers. Each surfaces as `ErrInvalidTransactionType` or
  `ErrInvalidTransactionShape`, both 400.
- **`transaction_type` is immutable post-create.** Update payload omits it. To change a
  transaction's type, delete and re-create — changing it would invalidate the shape.
- **`SnapshotChart` is shared.** Don't fork it per group — it's already generic over `{year_month,
  amount}[]`.
- **Title Case** for nav labels, page H1s, data-section card titles. **Sentence case** for
  descriptions, empty-state messages, verb-phrase button labels. See M4.1 close commit for examples.
- **Routing is React Router** (ADR-0025). URLs mirror the domain hierarchy; every path comes from
  `src/lib/routes.ts` constants/builders, never a literal string — that's the deliberate link-safety
  convention (the stand-in for a type-safe router). Screens/details stay router-unaware (their
  `onSelect`/`onBack`/id-prop contract is unchanged); the `ListRoute`/`DetailRoute` wrappers in
  `App.tsx` bridge them to `useNavigate`/`useParams`. Adding a route = add a `routes.ts` entry + one
  wrapper line in the router config; don't reach for `useNavigate` inside a screen.
- **Nav is the shadcn Sidebar** (`AppSidebar`, data-driven from a single `NAV` array): persistent on
  desktop, drawer on phones. Subtyped groups (Assets, Liabilities, Investments) show always-expanded
  sub-items and get a placeholder **group home** page (`/assets`, `/liabilities`, `/investments`) —
  stubs for the future per-group dashboards. Flat groups (Receivables, Income) list at their root
  path, no home. Liability **detail nests under its subtype** (`/liabilities/personal/:id`) so the
  dynamic `:id` never overlaps the literal subtype segments. Add a destination = add it to `NAV`.
- **E2E navigates by URL.** Specs `goto('/path')` to enter a screen; for mid-test nav that must avoid
  a reload, click persistent sidebar `link`s (the old `getByRole('tab', …)` nav is gone). See
  `rebuild.spec` (preserves client-side `['reports']` invalidation) and `currency-display.spec`.
- **React Query useEffect gotcha.** Never put a `useMutation` result in a `useEffect` deps array —
  it's recreated every render and will loop. There's a comment to this effect in
  `EditSnapshotDialog`; replicate the pattern when needed.
- **Decimals are strings on the wire**, `decimal.Decimal` in Go, with DECIMAL(20,4) for amounts and
  DECIMAL(20,8) for rates/FX. ADR-0011.
- **Rates are stored as percentage** (e.g., `5.5` for 5.5%), not as decimal fraction. Frontend
  reads/writes the same number the user sees on screen — no client-side scaling. Applies to
  `liabilities.interest_rate`, `property_details.annual_amortization_rate`,
  `vehicle_details.annual_depreciation_rate`, `bond_details.coupon_rate`,
  `time_deposit_details.interest_rate`. Backtracked from decimal-fraction storage in migration
  00008.
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
- **Indonesian copy follows `docs/glossary-id.md`.** That file is the canonical EN↔ID dictionary
  (Liability→Liabilitas, Receivable→Piutang, Snapshot stays English, etc.). When a new term lands,
  extend the glossary in the same PR — don't decide translations inline in catalog JSON.
- **Pagination clamp is derived during render**, not done in an effect. Pattern: `const
  effectivePage = Math.min(page, totalPages)`. Use `effectivePage` for slicing and for the
  `PaginationControls page` prop; keep raw `setPage` for click handlers. Don't reintroduce
  `useEffect(() => if (page > totalPages) setPage(totalPages))`.
- **Edit dialogs do not reset form state via `useEffect`.** Initial form state comes from the entity
  prop in `useState(() => toForm(entity))` or inline initializer. Parents pass `key={entity.id}` so
  React remounts the dialog on entity switch. Within the same entity, form state persists across
  open/cancel/reopen — by design.
- **Defer cleanup that returns an error must swallow it explicitly**: `defer func() { _ =
  tx.Rollback(ctx) }()`. Applies to `pgxpool.Tx.Rollback` and `sql.DB.Close()`. errcheck catches the
  bare form.
- **E2E selectors use `data-testid` over structural DOM traversal.** Playwright specs target
  interacted/asserted elements via `page.getByTestId('...')` with a matching `data-testid` on the DOM
  node, never tag/CSS locators or `.filter({hasText})` chains. Test IDs are an explicit
  component↔spec contract that survives copy edits, restyling, and shadcn quirks (e.g. `CardTitle` is
  a `<div>`, not a heading). **No spec uses `page.locator()` structural selectors** — the last two
  (the StatusBadge `locator('span').filter(...)` in `lifecycle`/`maturity`) were replaced by
  `data-testid="status-badge"` + `toHaveText`. Stable role/label selectors (`getByRole('button'|
  'link')`, `getByLabel` on properly-associated inputs) and `getByText` for stable copy are fine to
  keep; the point is to ban brittle structural traversal, not to testid every button. When you add a
  new structural-locator need, add a test id instead.
- **Tenancy test pattern**: every position group's `*_tenancy_test.go` covers both the cross-tenant
  rejection path (bob attempts X, expects `ErrNotFound`) and the alice-side happy-path CRUD success
  (update + delete on entity and snapshot, then verify Get/List). Cross-tenant alone leaves
  `Update*`/`Delete*`/`softDeleteAsset` success branches uncovered because the rejection
  short-circuits at the GetX guard. **List must be tested with the entity still present** (alice
  creates entity + snapshot, then lists, asserts shape) — testing only the post-delete empty list
  leaves the detail+snapshot join loop in `List*` unexercised. Phase 2c fixed this for
  `ListProperties` + `ListVehicles` (both were at 21.9%); use those subtests as the template when
  adding a new group.
- **HTTP error responses ship the ADR-0027 envelope.** Every 4xx/5xx from `internal/*` goes through
  `internal/httperr` (`Write` / `WriteRepo` / `WriteValidation`) and ships
  `{"code": "<CODE>", "args": {...}}` — never raw `http.Error(...)`. Codes are the wire contract;
  human copy lives in the FE i18n catalogs (`errors:code.<CODE>`); no `message` field on the wire.
  Sentinel error vars live in `internal/errs` (leaf, dependency-free); `internal/repo/errors.go`
  re-exports them via aliases so `repo.ErrFoo` keeps working at call sites. **Exceptions:** the
  OAuth callback flow in `internal/auth/handlers.go:handleCallback` (redirect-based) and the
  mock OIDC subcommand in `cmd/balances/mockoidc.go` (dev-only) keep their plain `http.Error`
  bodies. New handlers reach for `httperr.Write(w, status, code, args)`, not `http.Error`. New
  validator-emitted errors need only the catalog entry — `WriteValidation` handles the field/rule
  extraction via the JSON-tag-name func registered by `httperr.NewValidator()`. Repo's
  `ErrUnauthenticated` stays deliberately unmapped (RequireAuth gates every route, so a repo
  seeing no user is a server bug, not a client error — falls through to 500 INTERNAL).
  Adding a new code: declare it in `internal/httperr/codes.go` + emit it + add the catalog entry
  in both locales.

## Things explicitly NOT to do

- **Don't autoflush commits.** When work seems ready, stage + show the diff + ask. Push only on
  explicit green light. After every push, watch CI to completion (`gh run list --branch <branch>` /
  `gh run watch <id>`); if a workflow fails, surface the failure with logs and ask the user whether
  to fix now or defer. Don't declare a commit done while runs are still queued or in_progress.
- **Don't dive into UI alone.** User has near-zero frontend skill and relies heavily on you for UI —
  but expects to be consulted on UX choices (form density, navigation, button labels). Always
  surface tradeoffs.
- **Don't fear backtracking on prior decisions** if they're suboptimal — pre-alpha migrations are
  not sacred. User explicitly accepted this. Flag the issue, propose the better path, let user
  decide.
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

CI runs both on every push. golangci-lint config is at `.golangci.yml` (repo root); ESLint config is
`frontend/eslint.config.js`. The Codecov config (`codecov.yml`) keeps coverage status
informational-only — failing CI from coverage drops is a deliberate non-goal until alpha.


## Deferred backlog

Optional / not-yet-scheduled items. The committed M6 work is under "What's next" above; the full
original wording of everything here — including items already resolved (side-by-side currency,
invite-form relocation, the `users.nickname` build, vitest setup) — is preserved verbatim in
`CHANGELOG.md`.

- **Link an existing TD as a rollover successor** (issue #29 gap). The #29 FK
  (`rolled_from_investment_id`) is set only by the rollover helper, so a successor created *by hand*
  stays unlinked and its source keeps showing the callout. If users hit this, add a "this deposit
  rolled over from…" picker on the Create/Edit TD form (or a "mark as rolled over" action on the
  matured source). Same FK already exists — only the UI + an update path are missing. No signal yet.
- **Per-bond `coupon_disposition` field** (escalation path). The bond accrued-interest snapshot
  dialog ships a global `accrued=0` default plus copy explaining the override path. If users
  repeatedly override (e.g. mostly secondary-market holders) or repeatedly forget to, escalate to a
  per-bond enum `coupon_disposition: 'pays_out' | 'accrues'` on `bond_details` and pivot the form on
  it. No signal yet that we need it.
- **Transaction-list aggregations.** No "transaction count" / "last transaction date" on the subtype
  list rows yet. Would add a column to `*ListItem` aggregates + a sqlc query; reuse the snapshot
  `listKey` invalidation pattern from `useInvestmentTransactions`.
- **Gold purity input UX.** Free-text decimal works (`formatGoldPurity` renders "24K (.999+)",
  "22K", etc.) but typing `0.999` for 24K is awkward. Carat picker deferred — constraint is "must
  distinguish 24K (.999) from Antam bar (.9999) without sub-percent precision loss". Possible shape:
  a `<select>` of 24K/22K/20K/18K/14K/10K + **Custom**, with 24K → `0.9999`.
- **Component tests (RTL + MSW + jsdom).** Deferred until component tests begin (ADR-0021). Vitest
  covers `lib/*` today. Do **not** add Playwright/E2E to the coverage metric — it's a behavioural
  net, not a coverage instrument.
- **Backend cost_basis aggregate on investment ListItems (issue #18).** Filed during the #14 slice
  14c grilling. Each subtype's list query gains a derived `cost_basis` column so the list payload is
  self-contained — today the 5 list screens fan out N parallel `useQueries` (snapshots +
  transactions) per subtype to compute cost on the client. Bond / TimeDeposit get easy wins
  (`face_value`, `principal` already in the row); Stock / MF / Gold need a SQL ledger replay or a
  simpler "cumulative buys − cumulative sells at avg" approximation (document the divergence vs
  `lib/costBasis.ts`'s precise replay). Once landed, drop `hooks/useInvestmentBatch.ts`'s
  transactions batch (snapshots batch still needed for the time graph until a parallel monthly-
  series endpoint exists).
## Updating this document

When you close a milestone, update this file in the closing commit — don't let it drift more than
one milestone behind reality. Keep it a **live-state pointer**: current status, what's next,
conventions, deferred backlog. Push the blow-by-blow detail of what shipped into `CHANGELOG.md`
(newest milestone first), not here. Hard-wrap prose at ~100 columns so the file stays diff-friendly
and readable by file tools.
