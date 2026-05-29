# Monthly report row layout: hybrid columns and JSON

The materialized monthly report (ADR-0006, extended by ADR-0008) uses a hybrid storage approach:
wide columns for closed-enum breakdowns whose cardinality is stable, JSON for variable-cardinality
breakdowns. Per-Position / per-instrument detail is **not** stored on the row — it's computed on
read from underlying tables when a user drills in.

## Column layout

### Net worth — top-line + group breakdowns

`nw_total`, `nw_assets`, `nw_liabilities`, `nw_receivables`, `nw_investments`. Five columns, stable
cardinality (the four Position groups are domain-fixed).

### Earned income — top-line + by-category

`earned_income_total`, plus one column per Income category (closed enum, Q13a):
`earned_income_salary`, `earned_income_business`, `earned_income_rental`, `earned_income_gift`,
`earned_income_tax_refund`, `earned_income_insurance`, `earned_income_other`. Eight columns.

### Investment return — top-line + by-subtype

`investment_return_total`, plus one column per Investment subtype (closed enum, ADR-0009):
`investment_return_stock`, `investment_return_mutual_fund`, `investment_return_bond`,
`investment_return_gold`, `investment_return_time_deposit`. Six columns.

### Asset value change — non-cash mark change of non-financial assets

`asset_value_change` — stored, signed (usually negative). The sum of `ΔSnapshot` over property +
vehicle positions for the month (carry-forward aware). Isolates depreciation / leasehold
amortization / revaluation out of the residual so living expenses reads as cash spending. Added
during the M5 grilling — see ADR-0008. First-month baseline: NULL (no prior month).

### Derived

`derived_living_expenses` — stored, not computed at display. Formula: `earned_income_total +
investment_return_total + asset_value_change − ΔNW(year_month)`. Locked in at generation; the
report's staleness machinery (ADR-0006) ensures it stays current when inputs change. With
`asset_value_change` isolated and investment marks already captured in `investment_return_total`,
this residual is a cash-spending proxy. The dashboard relabels it "Living expenses (estimated)" when
positive and "Unexplained increase" when negative.

### Variable-cardinality breakdowns — JSON columns

| Column | Shape |
|---|---|
| `user_breakdowns: jsonb` | Keyed by `user_id` and `"joint"`. Each value: `{nw, earned_income, investment_return}`. JSON because Household User count is variable. Joint is its own key, never split across members (CONTEXT → Net Worth) — so member count doesn't affect figures and `users` is not a report input (ADR-0006). |
| `fx_rates_used: jsonb` | Per ADR-0006. Snapshot of rates applied at generation time. Empty when the Household is single-currency (`multi_currency_enabled = false`, ADR-0002). |
| `stale_positions: jsonb` | Array of Position IDs whose contribution was carried-forward (Q12b). The UI surfaces this as an "incomplete data" warning. |
| `missing_fx: jsonb` | Array of `{position_id, currency}` for foreign-currency Positions excluded from the converted totals because no FX rate exists at or before this month (ADR-0002). Distinct from `stale_positions`; the UI surfaces it as "net worth excludes N positions — no rate entered." |

The **transaction-without-snapshot nudge** (an instrument with a transaction in month M but no
snapshot in M, per ADR-0008's timing-noise mitigation) is **computed on read**, not stored — it's a
cheap per-month function of snapshots + transactions, and storing it would add a column for a pure
derivation.

### Core fields

`id`, `household_id`, `year_month`, `generated_at`, plus audit + soft-delete per ADR-0007.

## What's NOT stored — computed on read

- **Per-instrument investment return** — computed from snapshots + transactions for that month,
  using the formula in ADR-0008.
- **Per-Position net worth** — read directly from the position's snapshot for that month.
- **Per-currency aggregates** — projected through `fx_rates_used` on demand.
- **Individual Income event listings** — query the `income` table filtered by household and
  year-month.

These would couple the report row's width to portfolio size, which is a bad coupling: storage grows
with each new position, and migrations become unwieldy. Computing on read is cheap when scoped to
one Household, one month.

## Considered alternatives

- **All-JSON** (single `breakdowns: jsonb` for every slice). Rejected — wins schema flexibility but
  loses indexable, directly-queryable columns. Multi-month analytics (`SELECT earned_income_salary
  FROM monthly_reports ORDER BY year_month`) become JSON-extraction queries; charting code lives in
  SQL rather than Go.
- **Wide columns for everything, including per-User and per-Position.** Rejected — per-User column
  count is variable (current `2` users, could be more), and per-Position would couple row width to
  portfolio size.
- **Store per-instrument return on the row.** Rejected — couples schema to portfolio scale.
  Drill-down queries are inherently filtered (one instrument at a time) and cheap to compute on
  read.
- **Compute `derived_living_expenses` at display.** Rejected — every consumer would re-derive the
  same formula; storing once is simpler and the staleness check keeps it correct.
- **NW-by-subtype columns (`nw_bank_accounts`, `nw_properties`, etc.).** Deferred — could be added
  later if dashboard demand justifies it. Currently each subtype-level slice can be computed on read
  by summing snapshots filtered by subtype.

## Consequences

- The report row is ~29 columns plus four JSON columns. Comfortable in Postgres; well within
  sensible-row-width.
- Adding a new Income category or Investment subtype is a schema migration (one new column).
  Acceptable given how rarely the closed enums change, and existing rows simply backfill with zero
  or get marked stale and regenerate.
- Per-instrument and per-Position drill-downs are query-time concerns, not storage-time.
- The dashboard "headline view" is a single-row read with no joins.
