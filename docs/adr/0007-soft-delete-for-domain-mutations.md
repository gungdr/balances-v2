# Soft-delete for domain mutations

All domain tables — Households, Users, the four Position groups (Asset, Liability, Receivable, Investment), Snapshots, Transactions, and the FX rate table — use **soft-delete**: a nullable `deleted_at` timestamp. Deleting a row sets `deleted_at` and bumps `updated_at`; the row remains physically present. Default queries filter `deleted_at IS NULL`.

The immediate trigger is the materialized monthly report's staleness check (ADR-0006), which compares the report's `generated_at` against `max(updated_at)` of input rows. A hard `DELETE` doesn't bump any surviving row's `updated_at`, so a deletion would silently leave a stale cached report. Soft-delete makes deletes visible to the staleness check via the deleted row's own `updated_at`.

A useful side effect: any data-entry mistake — a snapshot entered against the wrong Position, a fat-fingered transaction — is recoverable by flipping `deleted_at` back to `NULL`. The v1 UI doesn't need to expose this, but the capability exists for ad-hoc DB-level recovery.

## Considered alternatives

- **`household_state_version` integer**, bumped on every write or delete inside a Household; staleness check becomes a single integer compare. Rejected — structurally simpler but offers no undelete path, and the `max(updated_at)` check is already cheap when scoped by Household and month.
- **Audit / history table per domain table**, with hard deletes on the live table mirroring rows into history. Rejected — heavier schema for a household-scale app, and the audit motivation here is modest (undo recent mistakes, not full forensic history).
- **Hard-delete everywhere, accept the staleness gap.** Rejected — the materialized report would silently serve wrong totals after any deletion until manually rebuilt.

## Consequences

- Every domain repository defaults to filtering `deleted_at IS NULL`. A query that forgets this filter leaks deleted rows into reports.
- Unique constraints on natural keys (e.g., one Snapshot per `(position_id, year-month)`) must account for soft-deleted rows — either include `deleted_at` in the unique index, or use a partial index `WHERE deleted_at IS NULL`.
- "Compact / purge" of long-deleted rows can be added later as a maintenance job without schema change; the column is already nullable.
- Cross-table cascades (deleting a Position should soft-delete its Snapshots and Transactions) are an application-layer concern, not a DB-level `ON DELETE CASCADE` (which would hard-delete).
