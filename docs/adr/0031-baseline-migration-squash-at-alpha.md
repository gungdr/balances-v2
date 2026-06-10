# Baseline migration squash at alpha

At alpha the 25 incremental migrations `00001_init`…`00025_tags` are collapsed into a single
**`00001_baseline.sql`** (goose version 1), generated from `pg_dump --schema-only` of the
fully-migrated chain. Existing databases are **not rebuilt**: their goose markers are collapsed in
place (keep `version_id` 0 and 1, delete 2–25), justified by a verified **zero-drift** check. New
deployed environments (see [[adr-0030]]) apply only the baseline. This builds on [[adr-0019]]
(goose, embedded migrations).

## Why now

The incremental chain accumulated 25 files across pre-alpha. Alpha is the clean break: the deployed
environments in [[adr-0030]] are **fresh** and carry no migration history, there is **no production
database** whose history must be preserved, and a single baseline makes fresh provisioning and the
testcontainers suite ([[adr-0021]]) faster and quieter. Pre-alpha migrations are not sacred, so the
chain is replaced rather than appended to.

## The decision

### Generate from a dump, never by hand-merge

Twelve of the 25 migrations perform transforms (`DROP COLUMN`, `ALTER COLUMN … USING`, `RENAME`),
so the final schema is **not** a concatenation of the `CREATE` statements. The baseline is therefore
produced by applying the whole chain to an empty database and running
`pg_dump --schema-only --no-owner --no-privileges --exclude-table=goose_db_version`.

### Collapse existing markers in place, gated on a drift check

Rebuilding every existing database is avoided so the developer's real local test data survives. This
is safe **only** because the marker collapse freezes whatever schema the DB currently has — no
future migration will reconcile a mismatch. So the swap is gated on a verified equality:

1. **Parity** — re-applying the baseline to an empty DB reproduces the canonical chain schema exactly.
2. **Drift gate** — the live DB's `pg_dump --schema-only` equals the canonical schema. If it differs,
   the swap is unsafe and that DB must be rebuilt instead.

With both green, the baseline is named goose **version 1**, so collapsing an existing DB is just
`DELETE FROM goose_db_version WHERE version_id BETWEEN 2 AND 25` (rows 0 and 1 already exist). A
subsequent `migrate up` is a no-op; no table-recreation collision.

### Two pg_dump artifacts must be stripped for goose

`pg_dump` output is written for `psql`, not goose's database/sql driver:

- **`\restrict` / `\unrestrict`** — psql backslash meta-commands; goose would error on them. (They
  also carry a random per-dump nonce, which is pure diff noise during verification.)
- **`SELECT pg_catalog.set_config('search_path', '', false);`** — blanks the session search_path, so
  goose's unqualified `INSERT INTO goose_db_version` then fails with `relation … does not exist`.
  Safe to drop because every object in the dump is `public.`-qualified.

### Down drops tables explicitly, not the schema

The baseline's `-- +goose Down` issues `DROP TABLE IF EXISTS public.<t> CASCADE` per table rather
than `DROP SCHEMA public CASCADE`, which would also drop goose's own `goose_db_version` and break its
bookkeeping on rollback.

### Validation gate before declaring done

- Apply the baseline through goose (embedded) on a fresh DB; diff its schema against the live DB → identical.
- Run the full backend test suite; testcontainers migrates from the baseline across every package.

## Considered alternatives

- **Rebuild existing DBs from the baseline.** Rejected — the drift gate passed, so the in-place
  marker collapse preserves the developer's local test data at no correctness cost. (Still the
  required path for any DB that *fails* the drift gate.)
- **Hand-merge the `CREATE` statements.** Rejected — the 12 transform migrations make a naive merge
  diverge from the real schema.
- **Keep the 25-file chain.** Rejected — slower fresh provisioning and noise for every new
  environment, with no offsetting benefit now that there is no history to preserve.

## Consequences

- Granular migration history leaves the working tree (recoverable via git). The data-transform DML
  in `00008/00017/00018/00019/00023` is dropped — correct, because every deployed environment starts
  empty and those backfills are no-ops on empty tables.
- Any **other** existing database (a second laptop, a teammate's local) needs the same in-place
  collapse *after* passing the drift gate, or a rebuild if it fails it.
- Future migrations continue sequentially at **`00002`**. Versions 2–25 collide only with the
  deleted pre-squash files, which exist solely in git history and never coexist with the new ones in
  any live database, so goose sees no conflict.
- `go run … serve` recompiles from source on restart, so a restarted dev server embeds the baseline
  and no-ops — there is no stale-binary collision window.
