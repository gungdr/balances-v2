## Snapshot table strategy: one table per position group

Monthly snapshots are stored in **four tables**, one per position group:
`asset_snapshots`, `liability_snapshots`, `receivable_snapshots`, and
`investment_snapshots`. Each snapshot table has a real foreign key to its
parent group table; there is no polymorphic FK. The three CONTEXT.md shapes
(amount only; quantity + price; accrued interest + total) collapse onto these
four tables with `investment_snapshots` carrying subtype-conditional nullable
columns plus a `CHECK` enforcing shape integrity.

`asset_snapshots` (from ADR-0009 / M3.1) is the first such table and the
template for the rest.

## Considered alternatives

- **Option A — single polymorphic `snapshots` table** with `position_type` enum
  and `position_id` referencing one of four group tables depending on type.
  Rejected — polymorphic FK loses DB-level referential integrity, and the
  nullable-column matrix grows fast as Investment subtypes pile on. Cross-
  position queries would be slightly simpler (no UNION), but at the cost of
  schema clarity we'd live with for years.
- **Option C — one table per *shape*** (`amount_snapshots`,
  `price_quantity_snapshots`, `interest_snapshots`). Rejected — shape doesn't
  map cleanly to user intent ("the user reads a bond statement" not "the user
  records an interest-shaped snapshot"), and `amount_snapshots` would still
  need polymorphic FK across Asset / Liability / Receivable. We'd also have to
  rename and migrate the existing `asset_snapshots` for no real win.
- **Option D — one table per Position subtype** (`bank_account_snapshots`,
  `property_snapshots`, …, ~11 tables). Rejected — table sprawl with little
  benefit; net-worth aggregation becomes long UNION ALLs across all snapshot
  tables; sqlc query duplication.

## Investment shape integrity

`investment_snapshots` will have:

| Column | Used by |
|---|---|
| `amount` (required) | all subtypes |
| `currency` (required) | all subtypes |
| `quantity` (nullable) | Stock, MutualFund, Gold |
| `price_per_unit` (nullable) | Stock, MutualFund, Gold |
| `accrued_interest` (nullable) | Bond, TimeDeposit |
| `year_month`, audit fields, soft-delete | all subtypes |

The required value column is named `amount` (not `total_value`) for cross-group
consistency with `asset_snapshots.amount`, `liability_snapshots.amount`, and
`receivable_snapshots.amount`. This lets the four snapshot tables present a
uniform `(year_month, amount, currency)` shape to net-worth aggregation and to
the shared frontend snapshot components.

A `CHECK` constraint enforces the XOR shape:

```sql
CHECK (
    (quantity IS NOT NULL AND price_per_unit IS NOT NULL AND accrued_interest IS NULL)
    OR
    (quantity IS NULL AND price_per_unit IS NULL AND accrued_interest IS NOT NULL)
)
```

Postgres can't reference other tables in a `CHECK`, so we can't enforce
"investment.subtype = 'stock' implies snapshot has quantity + price" at the
DB level. That part lives in the repository and is covered by integration
tests. The XOR check still catches "rows that satisfy no real shape" and
"rows that try to satisfy both," which is the main programming-error class.

## Consequences

- Four snapshot tables, each with a real FK to its parent group table.
- Net-worth aggregation is a `UNION ALL` of four queries, all carrying
  `amount + currency + year_month` (subtraction for liabilities applied
  at the aggregate level).
- The three amount-shape tables (`asset_*`, `liability_*`, `receivable_*`) have
  identical column lists. This minor duplication is acceptable; collapsing
  them would force polymorphic FK or rename gymnastics.
- The existing `asset_snapshots` from M3.1 needs no schema change — it's
  already the right shape and FK.
- Future per-group leak tests (mirroring `assets_tenancy_test.go`) follow the
  same pattern: every snapshot mutation verifies the parent position belongs
  to the requesting household via JOIN or CTE.
