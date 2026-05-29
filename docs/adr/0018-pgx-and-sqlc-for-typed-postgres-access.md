# pgx and sqlc for typed Postgres access

The Go backend talks to Postgres via **`jackc/pgx`** as the driver and **`sqlc`** for type-safe
query code generation. Hand-written SQL lives in `.sql` files; `sqlc generate` produces typed Go
functions and structs that handlers and repositories call directly. No ORM, no query builder.

## Why pgx

- Actively maintained; the standard Go Postgres driver of 2025.
- Native support for all the PG features we use: JSONB, `DECIMAL`, custom types, listen/notify (if
  we ever need it), `COPY` for bulk operations.
- Works both as a native driver (`pgx.Conn`, `pgxpool.Pool`) and via the `database/sql` interface.
  We'll use the native API.
- `lib/pq` is the historical alternative; it's now in maintenance mode and discouraged for new
  projects.

## Why sqlc

- **SQL is the source of truth.** The schema we designed across ADRs 0001–0017 is rich (per-group
  position tables, subtype extensions, JSONB columns, partial indexes). sqlc lets the team —
  currently one backend engineer leaning on AI — write the SQL we'd write anyway and get typed Go to
  call it.
- **Compile-time validation.** sqlc parses each query against the schema; a renamed or removed
  column breaks the build, not production. Especially valuable for a project that may sit untouched
  for months between sessions.
- **JSONB and DECIMAL handled cleanly.** sqlc maps JSONB columns to specific Go types (struct or
  `json.RawMessage`); DECIMAL columns map to `shopspring/decimal.Decimal`, which is also the Go
  decimal type used for the precision shapes in ADR-0011.
- **No ORM impedance.** The materialized monthly report (ADR-0006 / ADR-0012) is a sequence of
  fairly involved aggregations with JSONB writes and `max(updated_at)` staleness scans. These are
  easy to express in hand-written SQL and awkward through an ORM.
- **Generated code is plain pgx.** No query-builder runtime, no struct tags driving behaviour. The
  generated functions are easy to read and easy to debug.

## Layout

```
backend/
  migrations/               # schema, driven by the migration tool (Q24)
    001_init.sql
    002_positions.sql
    ...
  queries/                  # hand-written SQL with sqlc directives
    positions.sql           # -- name: GetPositionByID :one  ...
    snapshots.sql
    income.sql
    reports.sql
    sessions.sql
    invitations.sql
  sqlc.yaml                 # codegen config
  internal/db/              # generated: Queries, types, sql.go files
    queries.sql.go          # generated
    models.go               # generated
```

Repositories wrap the generated `Queries` struct with tenancy-aware methods (per ADR-0005 — every
method takes `household_id` from the request context). Handlers call repositories; nothing calls
`Queries` directly outside the repository layer.

## Considered alternatives

- **Raw pgx with hand-written queries.** Viable runner-up. Trades sqlc's compile-time validation and
  codegen for less tooling complexity. Defensible for a tiny project; for ours, the schema and query
  surface are big enough that sqlc's payoff is worth it.
- **`sqlx`.** Thin wrapper on `database/sql` with struct scanning. Reduces boilerplate vs raw
  `database/sql`, but no compile-time validation and no support for the pgx native protocol
  features.
- **`bun`.** Modern, lightweight ORM-ish query builder. Less magic than GORM, but still adds an
  abstraction layer. Our hand-tuned aggregations don't benefit from a builder.
- **`GORM`.** Rejected — the most popular Go ORM, but its abstractions actively fight PG-specific
  features. JSONB, complex aggregations, partial indexes, and our materialized-report generation
  would all require GORM escape hatches.
- **`ent`.** Schema-first ORM (schema in Go). Powerful relationship handling; harder to reason about
  migrations because schema lives in Go code, not SQL. Misaligned with our SQL-first instinct.

## Consequences

- A `sqlc generate` step exists in the dev workflow. Run on schema or query changes. Easy to wire
  into a Makefile or shell alias.
- `sqlc.yaml` is committed; generated `*.sql.go` files are also committed so the build doesn't
  require sqlc on CI runners that aren't running generation.
- Custom Go types for JSONB columns (`UserBreakdowns`, `FXRatesUsed`, `StalePositions`) live in
  `internal/db/types.go` (hand-written) and are referenced from `sqlc.yaml` for column mapping.
- `shopspring/decimal.Decimal` is the canonical Go type for `DECIMAL(20, *)` columns. This matches
  ADR-0011's intent.
- Repositories own tenancy enforcement (read `household_id` from request context, pass to every
  generated query). Generated code itself is tenancy-agnostic.
- The query layer has no runtime SQL parsing — queries are validated at codegen time, executed as
  prepared statements at runtime.
