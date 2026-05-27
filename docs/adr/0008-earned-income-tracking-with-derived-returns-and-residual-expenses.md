# Earned income tracking with derived returns and residual expenses

To approximate the Household's cashflow without contradicting the snapshot-based net-worth model (ADR-0001), only **earned income** is tracked explicitly. Investment returns are **derived** from snapshots and transactions already in the system. Living expenses are **derived** as the residual that closes the comprehensive-income identity.

```
ΔNet Worth = Earned Income + Investment Return + Asset Value Change − Living Expenses
```

This decomposes the per-month `ΔNet Worth` (which the materialized monthly report already produces — ADR-0006) into named line items the user can read as an income statement.

The **Asset Value Change** term (added during the M5 grilling) isolates the non-cash mark change of non-financial Assets — property + vehicle — so that depreciation/amortization no longer inflates the residual. See "M5 implementation notes" below for the derivation.

## What's tracked vs. derived

- **Earned Income** is a new flow-event entity. Each event records `date`, `amount`, `currency`, `category` (closed enum: Salary / BusinessIncome / RentalIncome / Gift / TaxRefund / InsurancePayout / Other), `description` (free-text sub-label), and `ownership` (`SoleOwner` or `Joint`). The description field allows fine-grained labelling within a category (e.g., base salary vs. per-diem under `Salary`) for drill-downs without polluting top-line categories.
- **Investment Return** per instrument per month is computed as `ΔSnapshot_value + cash_paid_out_to_bank − cash_paid_in_from_bank`. Cash paid out covers Sell proceeds, Coupons, Dividends, Distributions, and Maturities; cash paid in covers Buys. Fees are absorbed into the snapshot delta (since they reduce quantity, not require external cash). The formula gives the full economic return — realised + unrealised + yield − fees — for the period.
- **Living Expenses** are derived as `Earned Income + Investment Return − ΔNet Worth`. The user sees one number per month, which captures everything not explained by income or investment activity: living costs, taxes, interest on debt, charitable giving, etc.

## Decoupling from bank balances

Per ADR-0003's principle, Income events do not auto-update bank-account snapshots. The bank statement is the source of truth for cash balances; Income events feed the income-statement view only. Cross-validation between the two happens via the identity above, not via direct linkage.

This means the materialized monthly report (ADR-0006) gains additional columns — earned income total, investment return total, derived living expenses — alongside the existing net worth and breakdowns. The staleness check (ADR-0006) gains the `Income` table as an input: an Income write bumps `updated_at`, which invalidates the affected month's report.

## Considered alternatives

- **Track expenses as events too.** Rejected — re-introduces transaction-level cashflow tracking, which ADR-0001 explicitly rules out. The residual approach gives a single useful number per month with zero data-entry burden.
- **Don't track Income; infer it from snapshot deltas + transactions.** Rejected — there's no way to distinguish salary from a market rally without an explicit signal. The "unexplained NW increase" residual is too noisy to be useful as a cashflow proxy.
- **Auto-link Income to a specific bank account.** Rejected — same drift-risk reasoning as ADR-0003. Reconciliation between manually-entered income and bank statements is exactly the bug class we're avoiding.
- **User-defined income categories.** Deferred — the closed enum keeps reports comparable and prevents category sprawl. Migration to user-defined later is non-breaking.

## M5 implementation notes — return formula made precise

Per-instrument per-month: `Return(i, M) = [value(i, M) − value(i, M−1)] + Σ cash_out(M) − Σ cash_in(M)`, where `value` is the carry-forward snapshot value converted to reporting currency (CONTEXT → Net Worth), and transaction cash flows bucket by `transaction_date`'s year-month. Sum per-instrument returns into the five `investment_return_*` subtype columns (ADR-0012) and the total.

Transaction → cash-flow mapping (columns per migration 00010):

| Type | cash_in (bank→instrument) | cash_out (instrument→bank) |
|---|---|---|
| Buy | `amount` | — |
| Sell | — | `amount` |
| Coupon / Dividend / Distribution | — | `amount` |
| Fee | `amount` **only if `quantity IS NULL`** | — |
| Maturity | — | `principal_amount` if `principal_disposition='cash_out'` + `interest_amount` if `interest_disposition='cash_out'` |

- **Unit-deducting fees are NOT a cash flow** (`quantity` set): the deducted units lower the next snapshot, so the fee is already in `ΔSnapshot`. Only pure cash fees hit `cash_in`. This makes "fees absorbed into the snapshot delta" precise for both fee flavors.
- **Rolled maturity portions are NOT a cash flow**: a `rolled_to_new` portion is captured by snapshots (old position drops to 0, the new position's first snapshot carries the rolled amount). The formula yields the same total whether the user accrues interest in snapshots over the term or recognizes it lump-sum at maturity.
- **Birth month**: `value(M−1) = 0` when no snapshot ≤ M−1 — correct under the expected workflow (buy during the month, snapshot the position at month-end): `ΔSnapshot − cash_in` = unrealised gain since purchase.

**Timing noise & its mitigation.** A transaction in a month with no snapshot for that instrument produces a per-month return that is off (e.g. `−buy_cost` that month, `+value` the next) but **cumulatively correct** — and the residual `living_expenses` line absorbs the exact opposite noise, so the comprehensive-income identity always closes. We keep the correct formula rather than engineering phantom-snapshot alignment. Because the audience is non-technical, the mitigation is a **UX guardrail, not interpretation**: when an instrument has transactions in a month it wasn't snapshotted, the dashboard nudges the user to record that snapshot (surfaced alongside `stale_positions`). The fix is complete data, driven by the UI.

**Asset Value Change — isolating non-cash depreciation/amortization.** Property and vehicle values are entered as manually-declining snapshots (the per-subtype amortization/depreciation rate is only a UI helper). Their decline lands in `ΔNW`, and expanding the residual shows it leaking in as phantom spending:

```
LivingExpenses = EarnedIncome + InvestmentReturn − ΔNW
ΔNW            = ΔBank + ΔProp + ΔVeh + ΔInv + ΔRecv − ΔLiab
⇒ LivingExpenses = EarnedIncome + cash_out − cash_in − ΔBank − ΔProp − ΔVeh − ΔRecv + ΔLiab
```

The `ΔInv` terms cancel (investment marks are already in `InvestmentReturn`), so **property + vehicle revaluation is the only major non-cash distortion left** — making its isolation a *complete* fix, not a partial one. We add a line:

```
AssetValueChange     = Σ ΔSnapshot over property + vehicle positions  (signed; usually negative)
LivingExpenses(cash) = EarnedIncome + InvestmentReturn + AssetValueChange − ΔNW
```

Scope is **property + vehicle only** — bank accounts are cash (stay in the residual), investments have their own line, and receivable write-downs are genuine wealth losses left in the residual (revisit if material). Display: a non-cash **"Property & vehicle value change"** line in the income statement / waterfall; the residual is relabeled a cash-spending estimate. Stored on the report row per ADR-0012.

## Consequences

- Schema gains one new table (`income`) — flow events with no FK to Positions.
- The materialized monthly report (ADR-0006) extends to carry an income-statement view; the report's staleness check must include the Income table.
- "Where did my money go?" is answerable in aggregate (the residual) but not in detail (no expense items). This is a deliberate scope choice consistent with the snapshot philosophy.
- Recurring income (monthly salary) is handled at the frontend by a "duplicate last month" helper rather than a backend recurrence engine. Adding backend recurrence later is additive.
