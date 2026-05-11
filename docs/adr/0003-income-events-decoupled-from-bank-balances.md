# Investment cash events do not update bank balances

When an Investment generates a cash event — Coupon, Dividend, Distribution, Maturity (cash inflows), or Fee (cash outflow) — the Transaction is logged on the instrument for performance / yield / cost reporting only. It does **not** update any bank-account snapshot. Bank balances are read off bank statements at month-end as the source of truth.

Fee transactions additionally record a `fee_quantity_deducted` when the manager settles by removing units from the instrument (typical for gold and some mutual-fund classes). The quantity reduction will surface in the instrument's next snapshot when the user reads it off their statement; the Transaction records the cause for auditability and yield reporting.

This eliminates a class of drift bugs: if cash events auto-updated balances, the user's running ledger would have to agree with the bank statement, and any disagreement (timing, fees, intra-month transfers) becomes a reconciliation problem. Decoupling gives each ledger one source of truth — the bank for bank balances, the user's manual transaction log for instrument-level performance.

## Consequences

- Realized investment gains "disappear" from the instrument when sold and "reappear" in the next bank-account snapshot. This is acceptable because the user reasons in terms of net-worth totals, not cash flows.
- "Where did this coupon end up?" cannot be answered directly by the system. The user can reconstruct it from their bank statement.
- For instruments with unit-deducting fees, snapshot quantity should reconcile to `Σ(Buys.qty) − Σ(Sells.qty) − Σ(Fees.qty_deducted)` — any mismatch surfaces a data-entry error.
- A future "auto-link cash events to a chosen account" feature would be additive (a flag on the instrument or transaction) and wouldn't break existing data.
