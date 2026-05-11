# Multi-currency: native amount + reporting currency

Every monetary value is stored as `(amount, currency)` in its **native currency**. Each user has a `reporting_currency` setting (default IDR). Net-worth aggregation looks up a per-month FX rate for each non-reporting currency — entered manually in v1; an external rate-feed API can replace manual entry later without a schema change.

Storing native amounts preserves auditability against the user's bank statements (their source of truth) and avoids irrecoverable loss of original-currency information. A separate reporting layer keeps aggregation simple and lets historical FX assumptions be revised without rewriting source data.

## Considered alternatives

- **Single currency (IDR everywhere).** Rejected — converting at entry time loses the original number forever, breaking auditability against statements.
- **Store both native and IDR-equivalent on every row.** Rejected — couples FX assumptions to historical rows; rate corrections require migrations of all snapshots.
