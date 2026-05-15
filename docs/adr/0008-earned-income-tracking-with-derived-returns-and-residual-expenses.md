# Earned income tracking with derived returns and residual expenses

To approximate the Household's cashflow without contradicting the snapshot-based net-worth model (ADR-0001), only **earned income** is tracked explicitly. Investment returns are **derived** from snapshots and transactions already in the system. Living expenses are **derived** as the residual that closes the comprehensive-income identity.

```
ΔNet Worth = Earned Income + Investment Return − Living Expenses
```

This decomposes the per-month `ΔNet Worth` (which the materialized monthly report already produces — ADR-0006) into named line items the user can read as an income statement.

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

## Consequences

- Schema gains one new table (`income`) — flow events with no FK to Positions.
- The materialized monthly report (ADR-0006) extends to carry an income-statement view; the report's staleness check must include the Income table.
- "Where did my money go?" is answerable in aggregate (the residual) but not in detail (no expense items). This is a deliberate scope choice consistent with the snapshot philosophy.
- Recurring income (monthly salary) is handled at the frontend by a "duplicate last month" helper rather than a backend recurrence engine. Adding backend recurrence later is additive.
