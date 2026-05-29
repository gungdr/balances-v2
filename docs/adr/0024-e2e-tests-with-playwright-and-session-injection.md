# E2E tests with Playwright and session injection

End-to-end browser tests run under **Playwright**, authenticating by **injecting a pre-seeded
server-side session cookie** rather than driving the real Google OAuth login. Tests execute against
a **dedicated `balances_e2e` database** in the existing Postgres container, seeded deterministically
by a Go `seed-e2e` subcommand. This adopts the Playwright layer that [[adr-0021]] deferred, without
weakening the OAuth-only auth posture of [[adr-0017]] or the tenancy guarantees of [[adr-0005]].

## Why not drive real Google login

Google actively blocks automated browser sign-in — headless/automation detection surfaces "this
browser or app may not be secure" and the flow fails non-deterministically. There is no sanctioned
throwaway/test-account path: the OAuth consent screen's "Test users" list only governs *who may
consent*, not how an automated browser authenticates, and Workspace service accounts are
server-to-server, not interactive sign-in. Automating a real Gmail account fights bot detection, is
brittle in CI, and skirts Google's terms. Driving the real IdP is therefore rejected as the
authentication path for E2E.

## The decision: bypass the IdP, not the session

Auth in this app is a server-side session keyed by an opaque cookie (`session=<id>`, per
[[adr-0017]]). `SessionMiddleware` reads the cookie, looks up the `sessions` row, checks `expires_at
> now()`, and loads the user. **Nothing in that path involves Google** — Google is only consulted at
login to *mint* a session.

So E2E tests skip login and start from an already-minted session:

1. A `seed-e2e` subcommand truncates the app tables and inserts a fixture household, its users, and
   an active `sessions` row with a known `id` and a future `expires_at`, then prints the session id
   to stdout.
2. Playwright's global-setup captures that id and, per test context, calls `context.addCookies({
   name: 'session', value: <id>, ... })`.
3. Every request thereafter is authenticated exactly as a real user's would be — the same
   middleware, the same session lookup, the same tenancy filters.

**This requires zero application-code change.** No test-only login endpoint, no `if (testMode)`
branch, no auth bypass compiled into the binary. The fixture session is a *real, valid* session that
simply happens to live only in the `balances_e2e` database. The app cannot be tricked into trusting
it anywhere else.

### Fixture shape

One household with two users (Alice + Bob, per the repo's neutral-fixtures convention), with the
active session belonging to Alice. Two users — not one — so household-member-driven UI (sole-owner
pickers, owner-name display) renders a realistic >1-member list. `google_sub` is NOT NULL unique, so
the fixture uses deterministic sentinel subs (e.g. `e2e-alice`, `e2e-bob`); the truncate-then-insert
seed keeps them unique across runs.

## Why a dedicated `balances_e2e` database

E2E tests create, edit, terminate, and (soft-)delete positions. Running them against the dev
database would:

- **Pollute** dev data — soft-delete-everything ([[adr-0007]]) means fixture rows never truly leave;
  they intermingle with hand-entered dev data in every list and picker.
- **Break determinism** — any "list shows N rows" assertion is hostage to whatever the developer
  entered by hand.
- **Mutate real dev state** — an edit/terminate/delete test would operate on positions entered
  manually.

A separate `balances_e2e` database in the **same** Postgres container avoids all three at near-zero
cost: no new infrastructure, and **auto-migrate-on-serve** ([[adr-0019]]) self-populates the schema
when the backend boots against the empty database. The only added moving part is launching the app
pointed at `balances_e2e` for the duration of the run (a Makefile target). A throwaway container per
run (mirroring the Go `testcontainers` path) was considered but rejected for now as more
orchestration than a second database in the box we already run.

## Why seed in Go, not SQL

The seed is a `cmd/balances` subcommand, not raw SQL embedded in Playwright global-setup. It reuses
the repo types and the real session-creation path, so it survives schema drift — a column rename
breaks the Go build loudly instead of producing a silently-wrong fixture at runtime. It also prints
the session id on stdout, giving global-setup a clean capture point.

## Scope: what E2E covers and what it does not

E2E exercises **multi-step UI flows through the real frontend and backend** — the surface
unit/component tests and Go integration tests cannot see. It explicitly does **not** take over:

- **Tenancy** stays in the Go repo suites ([[adr-0021]] #2) — cross-household leak tests belong
  against the real DB, not the browser.
- **Financial calculations** stay in `internal/finance` unit tests.
- **The login flow itself** is now covered by one E2E test driving the real
  button→redirect→callback→session flow against the local mock OIDC provider (option B, adopted —
  see Implementation notes). Session injection still authenticates every *other* test; the login
  test is the single case that exercises the OAuth wiring through the browser. `handleCallback` also
  remains unit-covered (~71%) via the `stubOAuthClient` seam.

## Considered alternatives

- **Automate a real Google account.** Rejected — bot detection, CI flake, terms friction. (See "Why
  not drive real Google login.")
- **Test-only login endpoint behind an env flag.** Considered. Rejected in favour of cookie
  injection because injection needs no application-code change and carries no risk of a test
  backdoor ever shipping in a production build. A misconfigured env flag is a strictly larger blast
  radius than a session row that only exists in a separate database.
- **Run E2E against the dev database.** Rejected — pollution, non-determinism, destructive mutation
  of hand-entered data. (See "Why a dedicated `balances_e2e` database.")
- **Throwaway Postgres container per E2E run.** Deferred — cleaner isolation but more orchestration
  than a second database buys us today; revisit if the e2e DB's shared-instance coupling ever bites.
- **Mock OIDC provider (option B).** **Adopted** (see Implementation notes). A fake OIDC server
  pointed at by `newGoogleOAuth`'s discovery URL lets one E2E test exercise the real login flow
  end-to-end. The seam is *not* the `googleOAuthClient` interface (that is the unit-test stub,
  compiled into the binary) but a config-driven issuer URL: production leaves `OIDC_ISSUER_URL` at
  the Google default, E2E points it at the local mock. Off-the-shelf servers
  (`navikt/mock-oauth2-server`, Dex, `oauth2-proxy/mockoidc`) were weighed but a ~120-line
  hand-rolled Go subcommand won — see Implementation notes for why.
- **Raw-SQL seed in Playwright global-setup.** Rejected — rots on the first schema change; a Go
  subcommand fails loudly at build time instead.

## Consequences

- New `cmd/balances seed-e2e` subcommand: truncate app tables, insert the Alice+Bob household +
  Alice's active session, print the session id.
- Frontend gains Playwright as a dev dependency, a Playwright config, and a global-setup that runs
  `seed-e2e`, captures the id, and registers the cookie on each context.
- A `make e2e` target orchestrates: ensure `balances_e2e` exists → launch the app pointed at it
  (auto-migrates) → run Playwright → tear down. The app instance for E2E is wired frontend↔backend
  against the e2e DB; exact ports are an implementation detail.
- Tenancy and finance coverage are unaffected — they remain in the Go suites by design.
- The login flow is verified by E2E via the mock OIDC provider (option B, adopted); the boot-time
  dependency on real Google OIDC discovery is gone for the E2E backend.
- [[adr-0021]]'s deferred-E2E section now points here.

## Implementation notes (option B — mock OIDC, adopted)

The login-flow gap above was closed by standing up a local fake OIDC provider rather than driving
Google.

**The seam is a config-driven issuer, not the `googleOAuthClient` interface.** `newGoogleOAuth`
discovers its provider from `OIDC_ISSUER_URL` (default `https://accounts.google.com`) and uses the
discovery-provided `provider.Endpoint()` instead of a hardcoded `google.Endpoint`. This is the
*only* production-code change, and it is behaviour-preserving for Google (discovery returns Google's
own endpoints). The E2E backend sets `OIDC_ISSUER_URL` to the mock. Crucially, this keeps the real
code path — `oidc.NewProvider`, real id_token signature verification against the provider's JWKS,
real `iss`/`aud` checks — so the test exercises the genuine wiring, not a stub. (The
`googleOAuthClient` stub remains, but only for the `handleCallback` *unit* tests.)

**Why a hand-rolled Go server over an off-the-shelf one.** `go-jose/go-jose/v4` is already in the
tree (transitive via go-oidc), so a ~120-line `cmd/balances mock-oidc` subcommand signs id_tokens
and serves a JWKS with **zero new modules** in `go.sum`, using the exact JOSE library go-oidc
verifies with (no version skew). `oauth2-proxy/mockoidc` is v0/untagged (a maintenance risk for a
permanent fixture); `navikt/mock-oauth2-server` adds a JVM container and lifecycle orchestration. We
need exactly one happy-path login round-trip, not refresh/PKCE/multi-user/error coverage, so the
richer servers don't pay for themselves. This also extends the ADR's "seed in Go, not SQL"
reasoning: the fixture provider lives in the same typed binary and fails loudly at build time.

**What the mock does.** Serves `/.well-known/openid-configuration`, `/jwks`, `/authorize` (approves
immediately — no login form — and 302s back to `redirect_uri` with a fresh single-use code + the
caller's `state`), and `/token` (validates client creds via either `client_secret_basic` or
`client_secret_post`, then returns a signed id_token). The id_token carries `sub=e2e-alice` /
`alice@example.com`, the same fixture identity `seed-e2e` inserts (shared constants in
`cmd/balances`), so login lands as the *seeded* Alice. A fresh RSA key is generated per boot; tokens
live only as long as the process.

**Orchestration.** `make e2e` builds the binary, launches `mock-oidc` (:8090), waits for its
discovery endpoint, then hands off to Playwright and kills the mock on exit. The mock must be up
*before* the backend boots because `auth.New` runs discovery at startup. Playwright's backend
`webServer` env points `OIDC_ISSUER_URL` / client creds / `OAUTH_REDIRECT_URL` / `FRONTEND_URL` at
the e2e ports; the callback returns to the backend directly and the host-scoped (`localhost`,
port-agnostic) session cookie is shared with the e2e frontend, mirroring the real dev wiring.
`login.spec.ts` overrides the project's injected `storageState` with an empty one so it starts
unauthenticated and exercises the sign-in screen.
