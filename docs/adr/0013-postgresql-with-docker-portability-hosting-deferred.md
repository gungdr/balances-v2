# PostgreSQL with Docker portability; hosting deferred

The database engine is **PostgreSQL**. The application is packaged as Docker containers so the same artefacts run locally (OrbStack on macOS), on a paid VPS, on a homelab Proxmox box, or on free-tier cloud services. The specific hosting target is **deferred** — pinned only when there's something deployable.

## Why PostgreSQL

The schema designed across ADRs 0001–0012 lines up tightly with Postgres-specific strengths:

- **JSONB columns** are central — `fx_rates_used`, `user_breakdowns`, `stale_positions`, and other variable-cardinality breakdowns (ADR-0012). Postgres JSONB is the strongest implementation among free relational engines; queries can index and extract from inside JSON.
- **Real `DECIMAL(20, 4)` / `DECIMAL(20, 8)`** (ADR-0011) — arbitrary-precision arithmetic with no float caveats.
- **Partial indexes** — necessary for efficient soft-delete queries (`WHERE deleted_at IS NULL`, see ADR-0007 and ADR-0009 Q14b notes). Postgres supports them natively; MySQL does not.
- **Mature staleness scans** — the materialized monthly report's `max(updated_at)` checks (ADR-0006) benefit from Postgres's expressive index support.
- **Row-Level Security** is available later if the deferred RLS option in ADR-0005 ever gets adopted as belt-and-suspenders alongside application-level filtering.
- **Generous free hosted tiers** (Neon, Supabase, Aiven) and ubiquitous self-host options.

## Why Docker portability and deferred hosting

The deployment story should not couple the codebase to any specific provider:

- **Local development** uses Docker via OrbStack on macOS (lightweight Docker Desktop alternative; fast disk and network performance on Apple Silicon).
- **Same `docker-compose.yml`** runs locally, on a paid VPS (DigitalOcean / Hetzner), inside a Proxmox LXC container, or behind a managed-PG provider's connection string. Only environment variables change between targets.
- **No vendor-specific SDKs** for managed services. If we use Neon or Supabase later, they're treated strictly as Postgres connection strings — no Supabase auth/storage SDK coupling, no Neon-specific extensions.
- **Standard backups**: `pg_dump` works on any target. Data is never trapped.

The hosting decision (free cloud combo vs paid VPS vs Proxmox homelab) is intentionally deferred — it's reversible, doesn't influence schema or code, and benefits from being made when there's a buildable app to point at real targets.

## Considered alternatives

- **SQLite.** Rejected — JSON1 support exists but is weaker than Postgres JSONB; no real `DECIMAL` type; single-writer semantics conflict with the multi-tenancy design from ADR-0005. The SQLite → Postgres migration later would touch JSON columns, decimal handling, and indexing — substantial enough to be worth avoiding by starting on Postgres.
- **MySQL / MariaDB.** Rejected — lack of partial indexes forces filter-in-every-query workarounds for the soft-delete pattern; JSON support is workable but less ergonomic; the free hosted tier landscape has narrowed (PlanetScale free tier removed in 2024). PG meets the same "free now, serious later" goal more cleanly.
- **CockroachDB / TiDB.** Rejected — distributed SQL is overkill for a household-scale finance app; operational complexity outweighs benefits.
- **Pinning a hosting target now.** Rejected — the free-tier landscape shifts every few quarters (Fly.io, Railway, PlanetScale all removed free tiers in 2024). Locking in early invites avoidable rework when a provider changes terms.

## Consequences

- Codebase assumes Postgres semantics throughout (JSONB operators, partial indexes, `DECIMAL`). Migration to another engine would require schema rework.
- Local dev requires Docker (via OrbStack on macOS). A separate "run without containers" path is not maintained.
- Hosting choice happens later, informed by real deployment needs. Likely future candidates: Cloud Run / Render / Koyeb for backend; Neon / Supabase for DB; Vercel / Cloudflare Pages for frontend; or a single VPS that runs the whole stack.
- Future ADR will record the actual hosting target when picked, including any backup, observability, and CI/CD details specific to that environment.
