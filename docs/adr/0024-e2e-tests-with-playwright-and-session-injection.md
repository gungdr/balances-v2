# E2E tests with Playwright and session injection

End-to-end browser tests run under **Playwright**, authenticating by **injecting a pre-seeded server-side session cookie** rather than driving the real Google OAuth login. Tests execute against a **dedicated `balances_e2e` database** in the existing Postgres container, seeded deterministically by a Go `seed-e2e` subcommand. This adopts the Playwright layer that [[adr-0021]] deferred, without weakening the OAuth-only auth posture of [[adr-0017]] or the tenancy guarantees of [[adr-0005]].

## Why not drive real Google login

Google actively blocks automated browser sign-in — headless/automation detection surfaces "this browser or app may not be secure" and the flow fails non-deterministically. There is no sanctioned throwaway/test-account path: the OAuth consent screen's "Test users" list only governs *who may consent*, not how an automated browser authenticates, and Workspace service accounts are server-to-server, not interactive sign-in. Automating a real Gmail account fights bot detection, is brittle in CI, and skirts Google's terms. Driving the real IdP is therefore rejected as the authentication path for E2E.

## The decision: bypass the IdP, not the session

Auth in this app is a server-side session keyed by an opaque cookie (`session=<id>`, per [[adr-0017]]). `SessionMiddleware` reads the cookie, looks up the `sessions` row, checks `expires_at > now()`, and loads the user. **Nothing in that path involves Google** — Google is only consulted at login to *mint* a session.

So E2E tests skip login and start from an already-minted session:

1. A `seed-e2e` subcommand truncates the app tables and inserts a fixture household, its users, and an active `sessions` row with a known `id` and a future `expires_at`, then prints the session id to stdout.
2. Playwright's global-setup captures that id and, per test context, calls `context.addCookies({ name: 'session', value: <id>, ... })`.
3. Every request thereafter is authenticated exactly as a real user's would be — the same middleware, the same session lookup, the same tenancy filters.

**This requires zero application-code change.** No test-only login endpoint, no `if (testMode)` branch, no auth bypass compiled into the binary. The fixture session is a *real, valid* session that simply happens to live only in the `balances_e2e` database. The app cannot be tricked into trusting it anywhere else.

### Fixture shape

One household with two users (Alice + Bob, per the repo's neutral-fixtures convention), with the active session belonging to Alice. Two users — not one — so household-member-driven UI (sole-owner pickers, owner-name display) renders a realistic >1-member list. `google_sub` is NOT NULL unique, so the fixture uses deterministic sentinel subs (e.g. `e2e-alice`, `e2e-bob`); the truncate-then-insert seed keeps them unique across runs.

## Why a dedicated `balances_e2e` database

E2E tests create, edit, terminate, and (soft-)delete positions. Running them against the dev database would:

- **Pollute** dev data — soft-delete-everything ([[adr-0007]]) means fixture rows never truly leave; they intermingle with hand-entered dev data in every list and picker.
- **Break determinism** — any "list shows N rows" assertion is hostage to whatever the developer entered by hand.
- **Mutate real dev state** — an edit/terminate/delete test would operate on positions entered manually.

A separate `balances_e2e` database in the **same** Postgres container avoids all three at near-zero cost: no new infrastructure, and **auto-migrate-on-serve** ([[adr-0019]]) self-populates the schema when the backend boots against the empty database. The only added moving part is launching the app pointed at `balances_e2e` for the duration of the run (a Makefile target). A throwaway container per run (mirroring the Go `testcontainers` path) was considered but rejected for now as more orchestration than a second database in the box we already run.

## Why seed in Go, not SQL

The seed is a `cmd/balances` subcommand, not raw SQL embedded in Playwright global-setup. It reuses the repo types and the real session-creation path, so it survives schema drift — a column rename breaks the Go build loudly instead of producing a silently-wrong fixture at runtime. It also prints the session id on stdout, giving global-setup a clean capture point.

## Scope: what E2E covers and what it does not

E2E exercises **multi-step UI flows through the real frontend and backend** — the surface unit/component tests and Go integration tests cannot see. It explicitly does **not** take over:

- **Tenancy** stays in the Go repo suites ([[adr-0021]] #2) — cross-household leak tests belong against the real DB, not the browser.
- **Financial calculations** stay in `internal/finance` unit tests.
- **The login flow itself** is *not* covered while session injection is the only mechanism. `handleCallback` is unit-covered (~71%) via the `stubOAuthClient` seam, so the OAuth wiring is not a dark corner. Covering the real button→redirect→callback→session flow waits on the deferred mock-OIDC work below.

## Considered alternatives

- **Automate a real Google account.** Rejected — bot detection, CI flake, terms friction. (See "Why not drive real Google login.")
- **Test-only login endpoint behind an env flag.** Considered. Rejected in favour of cookie injection because injection needs no application-code change and carries no risk of a test backdoor ever shipping in a production build. A misconfigured env flag is a strictly larger blast radius than a session row that only exists in a separate database.
- **Run E2E against the dev database.** Rejected — pollution, non-determinism, destructive mutation of hand-entered data. (See "Why a dedicated `balances_e2e` database.")
- **Throwaway Postgres container per E2E run.** Deferred — cleaner isolation but more orchestration than a second database buys us today; revisit if the e2e DB's shared-instance coupling ever bites.
- **Mock OIDC provider (option B).** Deferred, not rejected. A fake OIDC server (`mock-oauth2-server`, Dex) pointed at by `newGoogleOAuth`'s discovery URL would let one E2E test exercise the real login flow end-to-end, reusing the existing `googleOAuthClient` seam. Worth one smoke test later; out of scope for the first E2E landing.
- **Raw-SQL seed in Playwright global-setup.** Rejected — rots on the first schema change; a Go subcommand fails loudly at build time instead.

## Consequences

- New `cmd/balances seed-e2e` subcommand: truncate app tables, insert the Alice+Bob household + Alice's active session, print the session id.
- Frontend gains Playwright as a dev dependency, a Playwright config, and a global-setup that runs `seed-e2e`, captures the id, and registers the cookie on each context.
- A `make e2e` target orchestrates: ensure `balances_e2e` exists → launch the app pointed at it (auto-migrates) → run Playwright → tear down. The app instance for E2E is wired frontend↔backend against the e2e DB; exact ports are an implementation detail.
- Tenancy and finance coverage are unaffected — they remain in the Go suites by design.
- The login flow remains unverified by E2E until the mock-OIDC option is adopted; this is an accepted, recorded gap, mitigated by `handleCallback` unit coverage.
- [[adr-0021]]'s deferred-E2E section now points here.
