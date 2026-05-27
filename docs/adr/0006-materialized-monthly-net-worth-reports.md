# Materialized monthly net-worth reports

The dashboard's primary view — net worth over time with headline breakdowns — is served from a materialized table rather than recomputed on every read. One row per `(Household, year-month)`, holding the total net worth in reporting currency, breakdowns by group (Asset / Liability / Receivable / Investment), breakdowns by User attribution (per SoleOwner + Joint), the `fx_rates_used` at generation time, and a `generated_at` timestamp.

Drill-downs into a specific category, position, or sub-period are computed on-the-fly from the underlying snapshot and transaction tables. Materialization exists for the one query that aggregates across every Position in a Household — finer queries are inherently filtered and cheap.

Generation is **lazy with a staleness flag**. On read, the report row's `generated_at` is compared against `max(updated_at)` of the inputs that feed that month: Snapshots, Transactions, FX rates, Ownership changes, Position metadata, and Income events (added by ADR-0008). If any input is newer, the row is recomputed, written, and served. Otherwise the cached row is returned directly. Deletes are detectable because all domain tables use soft-delete (see ADR-0007), so a delete still bumps the row's `updated_at`.

The `fx_rates_used` column captures the rates applied at generation time — frozen on the row, separate from the authoritative FX rate table. This answers "what rates did *this* report use?" without joining back to a possibly-edited rate table, and lets us diff before / after a manual rebuild.

A manual **rebuild** action is offered at two scopes: per-month ("rebuild May 2026") for surgical fixes, and per-Household ("rebuild all months") for code changes or FX corrections that should propagate across history. Rebuild ignores `generated_at` and recomputes from scratch.

## Considered alternatives

- **Eager regeneration on every input write.** Rejected — a month-end data-entry session would trigger N recomputes for no read-side benefit. Lazy converges to the same result on first read.
- **Scheduled nightly recompute.** Rejected — up to 24h stale; the user enters a snapshot and expects updated totals immediately.
- **Pure on-demand (no materialization).** Rejected — defeats the purpose; recomputing across all Positions and FX conversions on every dashboard load is the cost we're trying to avoid.
- **Row per (Household, year-month, group)** or **row per (Household, year-month, Position).** Rejected — finer granularity duplicates data already present in snapshots, courts drift bugs, and doesn't help the dashboard query (which is the only consumer warranting a cache).
- **`household_state_version` integer instead of `max(updated_at)` staleness check.** Rejected in favour of soft-delete (ADR-0007), which also gives undelete capability.

## M5 implementation notes

- **Month coverage.** Reports run from the first month with any input data through the **current month inclusive**. The current (in-progress) month is generated as a **provisional** row — built from carry-forward balances plus whatever snapshots/income/transactions are entered so far — and labeled as such in the UI, so a user can see "net worth now" before month-end.
- **"Current month"** is the month containing `now()` in the **requesting user's `time_zone`** (default `Asia/Jakarta`). No household-level time zone in v1; promote to one if cross-time-zone households ever appear. The boundary only affects which month is defaulted/marked in-progress — the report rows themselves are zone-independent buckets.
- **First-month baseline.** The earliest month with data has no prior month, so `ΔNW` is undefined. That month is a **net-worth baseline only**: `nw_*` and `earned_income_*` (a tracked fact) are populated, but `investment_return_*` and `derived_living_expenses` are **suppressed** (NULL) — deriving them would count pre-existing wealth as one month's flow. The full income statement begins the second month. The UI labels the baseline month explicitly.

- **Staleness enumeration (complete — a missing input is a silently-stale report).** Carry-forward means an input ripples *forward*, so the check can't scope by `month == M`. Rule: **month M regenerates if `generated_at(M)` is older than the max `updated_at` across all inputs with effective-month ≤ M.** One uniform rule; biases toward over-invalidation (a recompute that finds no change is cheap and harmless; under-invalidation shows a wrong number). Inputs:

  | Input | Effective-month | Scope for M |
  |---|---|---|
  | 4 snapshot tables (asset/liability/receivable/investment) | snapshot `year_month` | ≤ M |
  | `income` | `year_month(date)` | ≤ M |
  | `investment_transactions` | `year_month(transaction_date)` | ≤ M |
  | `fx_rates` | `year_month` | ≤ M |
  | 4 parent position tables (assets/liabilities/receivables/investments) | none (timeless metadata) | household-wide max |
  | `households` | none | household-wide max (`reporting_currency`, `multi_currency_enabled`) |

  **Detail tables are deliberately excluded** (bank_account_details, stock_details, …): their attributes (rates, ticker, maturity_date) are display/metadata and feed neither net worth nor the income statement — snapshots are the truth. Ownership/status/`terminated_at` live on the *parent* tables (M4.5 follow-up #3) and are covered. **`users` is excluded** because Joint positions render as their own column rather than being split across members (ADR-0012 / M5 UI), so member count affects no figure; display-name edits are labels resolved on read. If Joint ever becomes a per-member split, `users` must join the staleness set.

## Consequences

- Every domain table that feeds reports needs `updated_at` and soft-delete semantics (ADR-0007).
- The staleness check is a small set of `MAX(updated_at)` queries scoped by Household and month — cheap, but must enumerate every input table; missing one creates silently stale reports.
- "Why does last May's number look different today?" is answerable via the `fx_rates_used` column and the input rows' `updated_at`.
- Schema can evolve: adding a new input source (e.g., manual adjustments) means adding it to the staleness check and the recompute function — pure code changes, no migration of historical reports.
