# Hosting and deployment for alpha

This ADR closes the hosting question deferred in [[adr-0013]]. For alpha the stack runs on
**managed free/near-free tiers**: the React SPA on **Cloudflare Pages**, the Go API on **Fly.io**,
PostgreSQL on **Neon**, and mail on **Resend** (already chosen in [[adr-0020]]). Deployment is
**tag-driven** off the release tags from [[adr-0029]]. Only **one environment is deployed at the
start — `preview`**; the developer's own machine serves as `dev` via a Cloudflare Tunnel, and
`demo`/`production` are provisioned only when a real RC / production ship exists.

## Why now

[[adr-0013]] packaged the app as portable Docker and explicitly deferred the hosting target "until
there's something deployable," foreseeing "Cloud Run / Render / Koyeb for backend; Neon / Supabase
for DB; Vercel / Cloudflare Pages for frontend." Alpha is that moment. The targets below are picked
to honour ADR-0013's portability constraint: each is consumed as a generic primitive (a container,
a Postgres connection string, a static-file host, an SMTP endpoint) with **no vendor SDK coupling**,
so moving off any one of them is a configuration change, not a rewrite.

## The decision

### Environments — start with one deployed

| Env | Where | Purpose | Status |
|---|---|---|---|
| `dev` | the maintainer's laptop, exposed via Cloudflare Tunnel | personal sandbox; unstable, stale data, missed migrations expected | **laptop, not deployed** |
| `preview` | Fly + Neon + CF Pages | alpha releases | **deployed now** |
| `demo` | Fly + Neon + CF Pages | beta / RC | **deferred** to first RC |
| `production` | Fly + Neon + CF Pages | real users | **deferred** |

Provisioning all four now is rejected as premature surface for a pre-alpha solo project — each env
is a subdomain + DB + Fly app + OAuth client + secrets + mail config to maintain. `demo` and
`production` are stood up the day they are first needed, reusing the same wiring.

### `dev` is the laptop behind a Cloudflare Tunnel

- `cloudflared` runs in the **foreground** (a `make` target), mapping
  `dev.<personal-domain>` → local `vite` / API ports through a persistent outbound connection —
  no inbound ports, no public IP.
- This gives a **stable hostname** for the Google OAuth redirect URI and lets other devices (phone)
  reach the running local instance, which `localhost` cannot. The OAuth "redirect limitation" was
  really "other devices can't resolve `localhost`"; a stable host fixes it.
- Availability is intentionally laptop-bound: tunnel down when the laptop sleeps or `cloudflared`
  stops. This matches the "unstable, stale, personal" intent — `dev` *is* local, not a service.
- It is single-user. Other contributors run their own local `dev`; there is no shared dev service.
- The tunnel serves whatever local data is loaded. Reset/reseed scripts keep it sane and are the
  hygiene path before showing `dev` to anyone (and align with the rule against exposing real test
  data).

### Targets

- **SPA → Cloudflare Pages.** Free, trivial custom subdomains, built-in per-PR preview deploys.
  Built with `vite build`, deployed via `wrangler pages deploy frontend/dist`.
- **Go API → Fly.io.** Deploys the ADR-0013 Docker image directly. Chosen over Koyeb specifically
  for **`release_command`**, which runs `goose up` pre-rollout and **blocks the deploy if the
  migration fails** — the deciding factor for a DB-backed app. Pay-as-you-go per-machine billing
  with **scale-to-zero** keeps an idle `preview` at pennies and makes adding `demo`/`production`
  just another app on the same model.
- **PostgreSQL → Neon.** Free tier that *persists* (unlike Render's withdrawn free PG), scale-to-
  zero, and **database branching** — one Neon project with a branch per environment instead of N
  separate databases to babysit. Treated strictly as a Postgres connection string per ADR-0013; no
  Neon-specific extensions.
- **Mail → Resend.** Already adopted in [[adr-0020]]; Mailpit remains local-dev only, so every
  non-local env needs a real SMTP/API path. Resend's free tier covers alpha volume.

### Single origin per environment (SPA + API behind one Cloudflare hostname)

Each environment is served from **one hostname** (e.g. `preview.<domain>`). Cloudflare routes
`/api/*` to the Fly app and everything else to the Pages SPA. The backend already mounts every route
under `r.Route("/api", …)` (`internal/httpserver/server.go`; plus a top-level `/healthz` used only by
Fly's internal check), so the path passes through **unchanged** — `/api/tags` stays `/api/tags`,
never `/api/api/...` (path-preserving proxy, no rewrite). The `/api` prefix is the routing
discriminator.

This is deliberate, not cosmetic. Auth is **server-side session cookies** ([[adr-0017]]). Split
origins (a Pages domain + a separate Fly domain) would force `SameSite=None; Secure` cross-site
cookies, which Safari ITP and Chrome's third-party-cookie phase-out drop — silently breaking login.
Single origin keeps the session cookie **first-party**, sidestepping that entirely. The SPA history
fallback ([[adr-0025]]) applies only to the non-`/api` paths Cloudflare routes to Pages, so it never
collides with the API.

Per-env cookie/config: `COOKIE_SECURE=true`, and `FRONTEND_URL` / `BACKEND_URL` /
`OAUTH_REDIRECT_URL` all point at the single hostname.

### Tag-driven deployment

A single `.github/workflows/deploy.yml` triggers on `v*` tag push and routes by tag shape:

```
v0.6.0-alpha.N   → preview     (auto)
v0.6.0-rc.N      → demo        (auto, once demo exists)
v0.6.0           → production  (manual approval via GitHub Environment)
```

- Secrets and per-env config live in **GitHub Environments** (`preview` / `demo` / `production`).
  The `production` environment carries a **required reviewer**, adding a second hard gate on top of
  the merge signoff from [[adr-0029]].
- The backend job runs `flyctl deploy` against the env's Fly app; `goose up` runs inside Fly as the
  `release_command`. A Neon branch can dry-run a migration before it reaches a long-lived env.
- The frontend job builds and `wrangler pages deploy`s to the env's Pages project.
- Each env has its own Google OAuth client / redirect URI and its own Resend + DB secrets.

## Considered alternatives

- **Koyeb for the API.** Rejected — no clean pre-deploy hook, so migrations would ride the start
  command (runs every boot, races on scale-up); free tier caps at one service, so `demo`/`production`
  force payment or juggling anyway. Fly's `release_command` and per-machine billing win. Koyeb
  remains the fallback if Fly changes terms.
- **A deployed `dev` environment.** Rejected for now — the laptop tunnel matches the stated
  "unstable / stale / personal" intent at zero infra. Revisit only if `dev` must be reachable while
  the laptop is off.
- **Render.** Rejected — withdrew its free Postgres tier and cold-starts free web services.
- **Provisioning all four environments now.** Rejected — premature maintenance surface before a
  single alpha user; `demo`/`production` are stood up on first real need.
- **One VPS running the whole stack** (a deferred option in ADR-0013). Rejected for alpha — more ops
  than managed free tiers for no current benefit; still viable later via the same Docker artifacts.

## Consequences

- New prerequisites to build: a multi-stage **Dockerfile** (none exists yet), a **`fly.toml`** per
  app with the `goose up` `release_command`, a Neon project + per-env branches, Cloudflare Pages
  projects, a verified Resend domain, a per-env Google OAuth client, and GitHub Environments +
  secrets. The workflow YAML is the small part; this provisioning is the real work.
- `dev` is reachable only while the laptop and foreground `cloudflared` are running — by design.
- Running cost at alpha ≈ **$0–2/mo** (Fly scale-to-zero; Neon, Cloudflare Pages, Resend free).
- Adding `demo` then `production` later is another Fly app + Neon branch + the already-wired tag
  pattern and GitHub Environment.
- Vendor-shift risk (ADR-0013's stated concern) stays bounded: no vendor SDK lock-in, `pg_dump`
  portability holds, and the image runs anywhere — so leaving Fly/Neon/Cloudflare is a config
  change, not a migration.
- A future ADR records `production` specifics (backups, observability, custom domain, rollout
  policy) when it is stood up.
