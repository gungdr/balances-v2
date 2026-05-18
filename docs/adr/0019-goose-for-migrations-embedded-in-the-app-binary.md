# goose for migrations, embedded in the app binary

Schema migrations use **`pressly/goose`** with sequentially-numbered `.up.sql` / `.down.sql` files (`-- +goose Up` / `-- +goose Down` blocks within a single file). The migration runner is exposed as a **subcommand of the main app binary** (`balances migrate up`, `balances migrate status`, `balances migrate down 1`) rather than as a separate CLI tool. One artefact deploys; one place to look.

## Why goose

- **Embeddable.** Goose's Go library is easy to invoke from `main.go` as a subcommand. We avoid shipping a second binary and installing it on every environment (dev, CI, production).
- **Plain SQL files.** Same format we'd write by hand. Each migration is a single file containing both `Up` and `Down` directives, which keeps related changes physically adjacent.
- **Sequential numbering** (`00001_init.sql`, `00002_positions.sql`, …) sorts and reads naturally; the order is unambiguous at a glance.
- **sqlc-friendly.** `sqlc.yaml` is configured with `schema: "migrations"` so the same migration files drive sqlc's schema knowledge for codegen. There's no second source of truth describing the schema.
- **Small, focused dependency.**

## Layout

```
backend/
  cmd/
    balances/
      main.go               # registers `balances migrate` subcommand
  migrations/
    00001_init.sql          # -- +goose Up …  -- +goose Down …
    00002_positions.sql
    00003_snapshots.sql
    ...
  queries/                  # sqlc query files
  sqlc.yaml                 # schema: ../migrations
```

## Invocation surface

```
balances migrate up                  # apply all pending
balances migrate up-by-one           # apply next pending
balances migrate down 1              # roll back N
balances migrate status              # show current revision
balances migrate redo                # down + up the most recent
balances migrate version             # current version
```

Production deploy typically runs `balances migrate up` as part of the rollout (before the new server version takes traffic). Local dev runs the same command against the local Postgres.

## Considered alternatives

- **`golang-migrate/migrate`.** The most-popular Go migration tool. Same SQL file format, same workflow. Rejected for v1 because the embedded-subcommand ergonomic is cleaner with goose, and the popularity edge doesn't translate to a functional advantage here.
- **`ariga/atlas`.** Declarative schema management — describe the desired state, Atlas computes diffs and emits migrations. Genuinely powerful for large teams with many migration authors needing drift detection across environments. Rejected for v1 because the extra power is unused at solo-dev scale; manual SQL migrations are clearer and less ceremonial.
- **Migrations in a separate CLI binary** (any tool). Rejected — adds installation friction across environments. Embedding in the main binary means one Docker image carries everything; CI and production use the same artefact.
- **Timestamped filenames** (`20260518_120000_init.sql`). Rejected — they sort correctly but read worse than `00001_init.sql` for a small project where you're not coordinating concurrent branches.

## Consequences

- The schema's source of truth is the `migrations/` directory. sqlc reads it; production runs through it; dev environments are bootstrapped by running `balances migrate up` against a fresh Postgres.
- Down migrations must be written and tested for every Up — goose enforces the convention, and tests can exercise `up → down → up` cycles in CI to catch broken `Down` blocks early.
- The first migration (`00001_init.sql`) will encode the full schema designed across ADRs 0001–0018: all four position group tables, extension tables, snapshots, transactions, income, users, households, sessions, household_invitations, fx_rates, monthly_reports, plus indexes and constraints.
- Future schema changes ship as new migration files; existing files are immutable history (never edited in place).
- The migration runner has no special privileges in the codebase — it shares the same `pgx` connection config used by the app.
