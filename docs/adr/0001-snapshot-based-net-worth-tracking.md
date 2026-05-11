# Snapshot-based net worth tracking

Most personal-finance apps (Mint, YNAB) track every individual cash-flow transaction and reconstruct balances by summing them. Balances v2 instead records end-of-month balance **snapshots** per position as the primary data; net worth is computed by summing snapshots, not by integrating cash flows.

The user's goal is net-worth tracking, not budgeting or cash-flow analysis. A monthly cadence with one number per position is low-friction enough to sustain manually, and it works for positions that have no transactions to record (properties, vehicles, illiquid debts). Investment instruments additionally maintain a transaction ledger for cost-basis and income reporting, but snapshots remain the source of truth for net worth.

Per-transaction expense tracking and budgeting/category breakdowns of spending are deliberate non-features. A future change to a transaction-based model would require schema changes and a rethink of what the app is for.
