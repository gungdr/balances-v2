# Roadmap

The design phase is captured in `CONTEXT.md` and `docs/adr/0001–0021.md`. This document is the
implementation outline — six milestones, each shippable, each a useful place to pause and resume.

Reorder, split, or merge milestones as reality demands. This is a north-star, not a contract.

## Milestone 1 — Walking skeleton

**Goal:** end-to-end stack runs locally; the frontend can call the backend, the backend can talk to
Postgres, and the migration tool works.

**Done when:**
- `docker compose up` brings up Postgres, Mailpit, the Go backend, and the Vite dev server
- `balances migrate up` applies a (possibly empty) migration cleanly
- The frontend renders a "hello" page that fetches `/healthz` from the backend
- `/healthz` returns DB-server time, proving the connection

No business logic. No auth. The point is to confirm the wiring.

## Milestone 2 — Auth end-to-end

**Goal:** a real User can sign in.

**Done when:**
- Google OAuth login works in dev (with a dev OAuth app)
- A session cookie is issued and persisted in `sessions` (ADR-0017)
- The frontend has a "Sign in with Google" button and a "logged in as X" indicator
- Inviting a second User by email creates an `household_invitations` row and sends an email captured
  by Mailpit
- Clicking the invite link signs in the invitee and associates them with the Household

Proves the auth + Mailer + frontend roundtrip; everything else builds on it.

## Milestone 3 — First Position CRUD slice

**Goal:** one Position type (bank-account Asset) supports full CRUD + Snapshot entry.

**Done when:**
- A user can create, list, edit, and (soft-)delete a bank account from the UI
- A user can record monthly Snapshots against that bank account
- Tenancy enforcement is verified by a multi-Household integration test (ADR-0005, ADR-0021)
- The pattern (handler → repository → sqlc query → migration) is established

The first vertical slice through the stack. Establishes conventions for the rest.

## Milestone 4 — All Positions + Snapshots + Income

**Goal:** every Position type from ADR-0009 supports CRUD + Snapshots; Income events can be
recorded.

**Done when:**
- All Asset subtypes (bank_account, property, vehicle) work end-to-end
- All Liability + Receivable + Investment subtypes work end-to-end
- Investment Transactions (Buy, Sell, Coupon, Dividend, Distribution, Fee, Maturity) are entered and
  viewable
- Income events with the closed-enum categories from ADR-0008 are entered and viewable
- Position lifecycle (status, terminated_at) is editable from the UI (ADR-0009)

The "data entry" portion of the app is feature-complete.

## Milestone 5 — Materialized monthly report

**Goal:** the headline net-worth dashboard.

**Done when:**
- The `monthly_reports` table is populated via the lazy + staleness regeneration flow (ADR-0006)
- The dashboard shows total net worth, breakdowns by group + by User, comprehensive-income line
  items (earned income / investment return / derived expenses), and a time-series chart
- Manual rebuild (per-month and rebuild-all) works
- The `stale_positions` warning surfaces when months have carry-forward inputs
- Side-by-side currency display (Q15c) works using the FX rate table

The app's reason to exist.

## Milestone 6 — v1 polish

**Goal:** ready to depend on.

**Done when:**
- PDF export of monthly reports works (user requirement from Q22)
- Property/vehicle amortization-rate UI helper (Q8a) is in
- Fee cash→quantity helper (Q12 follow-up) is in
- TimeDeposit "duplicate matured TD" helper (Q14c-iv) is in
- Migrations consolidated — the accumulated pre-alpha migration files (currently ~7+, including
  amendments like the M4.3b-frontend `bond_details.series_code` add) are squashed into a single
  initial-schema migration before the first production deploy
- Hosting target is chosen and the app is deployed
- A real Resend domain is configured for production email
- Backup / restore for the production DB is documented

After M6, v1 is done. Future ADRs (passkeys, offline support, push notifications, Apple OAuth)
become incremental enhancements.
