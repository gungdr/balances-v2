# Position storage, lifecycle, and Maturity disposition

The four position groups (Asset, Liability, Receivable, Investment) are each modelled as a separate
core table with subtype-specific extension tables where metadata is rich, and inline fields where it
is not. Every Position carries a lifecycle status independent of soft-delete. The Maturity
transaction is extended with disposition fields so it can express the real-world variants of bond
redemption and TimeDeposit rollover.

## Storage layout

Four core tables — `assets`, `liabilities`, `receivables`, `investments`. Each carries:

- `id`, `household_id`, `display_name` (required), `description`
- `ownership_type` (`'sole' | 'joint'`), `sole_owner_user_id` (FK to users, non-null when `sole`)
- `native_currency` (ISO code)
- `subtype` — a group-specific enum (omitted for `receivables`)
- `status` — a group-specific enum (default `'active'`), `terminated_at` (date, nullable),
  `termination_note` (text, nullable)
- audit fields (`created_by/at`, `updated_by/at`) and `deleted_at` (ADR-0007)

Subtype-specific metadata lives in 1:1 extension tables (`position_id` as shared PK/FK) where the
metadata set is rich. Where it fits cleanly inline (Liability, Receivable), no extension table is
used.

### Asset extensions

| Table | Fields |
|---|---|
| `bank_account_details` | `bank_name` (req), `account_number` (req), `account_type` (`'savings' \| 'current' \| 'other'`) |
| `property_details` | `property_type` (`'house' \| 'apartment' \| 'land' \| 'commercial'`), `address` (opt), `acquisition_date` (opt), `acquisition_cost` (opt), `annual_amortization_rate` (opt, for the frontend valuation helper) |
| `vehicle_details` | `vehicle_type` (`'car' \| 'motorcycle' \| 'other'`), `make` (opt), `model` (opt), `year` (opt), `plate_number` (opt), `annual_depreciation_rate` (opt) |

### Investment extensions

| Table | Fields |
|---|---|
| `stock_details` | `ticker` (req), `exchange` (req) |
| `mutual_fund_details` | `fund_code` (req), `fund_manager` (opt) |
| `bond_details` | `bond_type` (`'govt_primary' \| 'secondary_market'`), `issuer` (req), `face_value` (req), `coupon_rate` (req, annual %), `coupon_frequency` (default `'monthly'`), `maturity_date` (req) |
| `gold_details` | `form` (`'bar' \| 'coin' \| 'digital' \| 'jewelry'`), `purity` (decimal) |
| `time_deposit_details` | `bank_name` (req), `principal` (req), `interest_rate` (req, annual %), `term_months` (req), `placement_date` (req), `maturity_date` (req), `rollover_policy` (`'auto_renew_principal' \| 'auto_renew_with_interest' \| 'no_rollover'`) |

### Liability and Receivable (inline)

`liabilities` adds: `subtype` (`'personal' | 'institutional'`), `counterparty_name` (req),
`principal` (opt), `interest_rate` (opt), `term_months` (opt), `start_date` (opt), `maturity_date`
(opt).

`receivables` adds: `counterparty_name` (req), `due_date` (opt). No subtype.

## Lifecycle and status

Status enums vary per group to keep values meaningful:

- **Asset**: `'active' | 'closed' | 'sold' | 'disposed'`
- **Liability**: `'active' | 'paid_off' | 'forgiven' | 'written_off'`
- **Receivable**: `'active' | 'collected' | 'written_off'`
- **Investment**: `'active' | 'sold' | 'matured'`

A Position contributes to month M's net worth only if `terminated_at IS NULL OR terminated_at >=
end_of_month(M)`. Carry-forward (ADR-0006 / Q12b) does not extend a Position past its
`terminated_at`. Historical Snapshots and Transactions remain intact; the lifecycle only governs
forward inclusion.

**Reactivation creates a new Position row** rather than flipping `terminated_at` back to NULL. This
keeps periods of non-ownership unambiguous in the audit history. Applies uniformly, including to
TimeDeposit auto-rollovers: each rollover creates a fresh TimeDeposit row with a new
`placement_date`. The chain is implicit, not modelled as a parent-child link (consistent with
CONTEXT.md).

### M4.6 implementation notes (lifecycle UI)

- **Status and `terminated_at` are kept in lockstep by a DB biconditional CHECK** (`(status =
  'active') = (terminated_at IS NULL)`, migration 00012, on all four core tables). A non-active
  status *must* carry a termination date; an active status *must not*. The repo's
  `validatePositionLifecycle` mirrors this for friendlier 400s, and the API requires `terminated_at`
  whenever the status is non-active (the UI defaults it to today).
- **Lifecycle is a dedicated action, not part of Edit.** It operates on the *parent* table, so there
  are 4 endpoints (`PATCH /api/{assets,liabilities,receivables,investments}/{id}/lifecycle`), 4 repo
  methods, and 4 SQL queries — not one per subtype. The 10 subtype Edit dialogs/Update paths are
  untouched.
- **Maturity is enforced as terminal by a hard guard, not just UI.** A Maturity transaction flips
  the investment to `matured` + sets `terminated_at` atomically (one pgx tx), and any subsequent
  transaction on a non-active investment is rejected with `ErrPositionNotActive` → 409. This
  replaces the earlier frontend-only "hide the Maturity button once one exists" band-aid.
- **Same-row un-terminate is a *correction* affordance, not reactivation.** The terminate dialog
  lets a user switch a mis-set status back to Active (clearing `terminated_at` on the same row) to
  undo a mistake. This does **not** contradict the "reactivation creates a new row" rule above:
  genuine re-acquisition of a sold/closed position is still modelled as a fresh Create. The DB does
  not distinguish the two; the distinction is procedural. *(Flagged for revisit if audit-gap
  ambiguity ever bites — pre-alpha, accepted.)*

## Maturity transaction extension

The Maturity transaction carries explicit disposition fields so it can express all real-world
maturity events:

```
Maturity transaction:
  position_id, date
  principal_amount         (the principal at maturity)
  interest_amount          (interest accrued)
  principal_disposition    enum 'rolled_to_new' | 'cash_out'
  interest_disposition     enum 'rolled_to_new' | 'cash_out'
```

The three TimeDeposit bank policies, plus Bond redemption, map cleanly:

| Event | `principal_disposition` | `interest_disposition` | New row? | Cash to bank? |
|---|---|---|---|---|
| TD ARO with interest | `rolled_to_new` | `rolled_to_new` | yes (principal = old + interest) | nothing |
| TD ARO principal only | `rolled_to_new` | `cash_out` | yes (principal = old) | interest only |
| TD no rollover | `cash_out` | `cash_out` | no | principal + interest |
| Bond redemption | `cash_out` | `cash_out` | no | principal + final coupon |

The `time_deposit_details.rollover_policy` field is the *configured* policy and serves as a default
for the frontend Maturity-entry helper; the transaction records what actually happened (banks can
deviate; users can switch policies). Per ADR-0003, `cash_out` portions do not auto-update bank
balances.

## Considered alternatives

- **Single polymorphic `positions` table** with `group` + `subtype` enums. Rejected — the four
  groups have substantively different lifecycles (Investment has Transactions, others don't;
  Liabilities subtract from NW), and one table forces NULL handling for group-specific concerns in
  every row.
- **JSON `subtype_details` column** on each group table. Rejected — loses DB-level validation,
  blocks subtype-specific indexes (`bonds.maturity_date` for "maturing soon" views), and pushes
  schema into application code.
- **One table per subtype** (~11 tables, no group split). Rejected — cross-group queries within a
  group ("all assets") need UNIONs, and the group/subtype discriminator becomes harder to discover
  in DDL.
- **Status via final `$0` snapshot.** Rejected — conflates "balance = 0" with "no longer held" and
  pollutes every future month's report with a stale carry-forward of zero.
- **Status via soft-delete (ADR-0007).** Rejected — soft-delete is for entries that should disappear
  from history entirely; sold/closed Positions are real financial history that must remain in past
  months' reports.
- **Reactivation by clearing `terminated_at`.** Rejected — creates ambiguity about whether the
  Position was continuously held or had a gap. New row is more honest, and a frontend helper can
  copy details from the terminated row.
- **Maturity as a simple terminal event without disposition fields.** Rejected — couldn't
  distinguish ARO principal-only from ARO with-interest, both of which exist in real Indonesian
  banking.

## Consequences

- Position-related tables: 4 core + 8 extension = 12 tables. Each is small and stable once defined.
- Net worth computation must check `status` / `terminated_at` per Position when including in month
  M's aggregate.
- Carry-forward suppression on termination is a first-class concern in report generation.
- The frontend Maturity-entry form defaults dispositions from `rollover_policy` but allows override
  per event.
- Position metadata extension tables introduce 1:1 joins for drill-down views; the dashboard query
  (core columns only) doesn't pay this cost.
- `bank_account_details.account_number` and `time_deposit_details.bank_name` reference identifying
  numbers — plaintext storage is acceptable for single-Household v1; revisit with encryption-at-rest
  if real multi-Household ever launches.
