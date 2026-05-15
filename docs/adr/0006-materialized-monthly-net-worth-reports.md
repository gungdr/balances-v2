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

## Consequences

- Every domain table that feeds reports needs `updated_at` and soft-delete semantics (ADR-0007).
- The staleness check is a small set of `MAX(updated_at)` queries scoped by Household and month — cheap, but must enumerate every input table; missing one creates silently stale reports.
- "Why does last May's number look different today?" is answerable via the `fx_rates_used` column and the input rows' `updated_at`.
- Schema can evolve: adding a new input source (e.g., manual adjustments) means adding it to the staleness check and the recompute function — pure code changes, no migration of historical reports.
