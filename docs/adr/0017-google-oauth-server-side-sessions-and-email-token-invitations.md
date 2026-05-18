# Google OAuth, server-side sessions, email-token invitations

Authentication uses **Google OAuth as the sole identity provider** for v1. Sessions are server-side, stored in Postgres, identified by an httpOnly secure cookie. Adding a second User to a Household happens via a **time-limited email-token invitation** that resolves to the invitee's Google identity on first sign-in. Apple OAuth, passkeys, and password fallback are deliberately deferred — each is an additive layer.

## Why Google only (for v1)

The original draft considered Google + Apple. The narrower v1 picks Google alone because:

- Both Users have Google accounts. Both also have Apple accounts, but supporting both providers from day one doubles the integration and identity-linking surface for no immediate benefit.
- Apple OAuth has additional implementation complexity (private-key JWT for client auth, hide-my-email handling) that v1 doesn't need.
- Adding Apple later is non-breaking: a new column `apple_sub` on `users`, a second OAuth handler, and either provider works.
- Cross-platform reach is preserved — Google sign-in works equally well on macOS / Windows / iPhone / Android.

## Schema additions

### Users (extending [[adr-0010]])

- `google_sub` (text, unique, NOT NULL) — Google's stable subject identifier. **This is the immutable identity key** (the `email` field is for display and invitation matching only; users can change their Gmail address).
- `email` already exists on `users` per ADR-0010.

### Sessions

A new table:

| Field | Notes |
|---|---|
| `id` | random opaque token (e.g., 32-byte base64) — this *is* the cookie value |
| `user_id` | FK to `users` |
| `created_at` | timestamp |
| `expires_at` | timestamp; 30 days from last activity (sliding window) |
| `last_seen_at` | bumped on each authenticated request |
| `user_agent` | text, for the user's "active sessions" view if we build it later |

The session cookie is `httpOnly`, `secure`, `samesite=lax`, with the session `id` as its value. Server reads the cookie, looks up the row, ensures `expires_at > now()`, identifies the User. Revocation is a row delete.

### Household invitations

A new table:

| Field | Notes |
|---|---|
| `id` | UUID |
| `household_id` | FK |
| `invited_email` | text — must match the Google-supplied email at acceptance |
| `token` | text, random, single-use, included in the invite URL |
| `created_by` | FK to `users` |
| `created_at` | timestamp |
| `expires_at` | timestamp; default 72 hours |
| `used_at` | nullable timestamp; non-null = consumed |

## Flows

### First sign-in (founder)

1. User clicks "Sign in with Google."
2. Backend redirects to Google OAuth consent.
3. Google redirects back with an authorization code.
4. Backend exchanges code for ID token, validates it, extracts `sub` and `email`.
5. No matching `users.google_sub` → create a new `users` row, create a new `households` row, link them.
6. Create a `sessions` row, set the cookie, redirect to dashboard.

### Second-user invitation

1. Founder enters spouse's email → backend creates a `household_invitations` row, sends an email containing `https://.../accept-invite?token=...`.
2. Spouse clicks link in email → backend validates token (exists, not used, not expired).
3. Backend redirects to Google OAuth with state encoding the token.
4. Google redirects back; backend validates ID token; **also verifies that the Google-supplied email matches `invitation.invited_email`** (prevents link-forwarding misuse).
5. Create a `users` row linked to the existing `households` row, mark the invitation `used_at`.
6. Create a session, set cookie, redirect to dashboard.

### Subsequent sign-ins

1. Click "Sign in with Google."
2. Backend matches Google `sub` to existing `users.google_sub`.
3. Create a session row, set the cookie.

## Considered alternatives

- **Google + Apple together for v1.** Rejected — added Apple-specific complexity (private-key JWT, hide-my-email mapping) for marginal benefit at v1 scale. Apple is additive later.
- **Passwords with bcrypt/Argon2.** Rejected — owning password reset, lockout, rotation, and breach response indefinitely is real engineering work. Google handles all of it.
- **Passkeys (WebAuthn) primary.** Rejected for v1 — implementation cost is higher and the laptop-primary access pattern reduces the biometric UX advantage. Possible additive layer in a future ADR if mobile use grows.
- **Magic-link auth (email-only).** Rejected — slow steady-state login (wait for email each time), email reliability dependency.
- **JWT in localStorage.** Rejected — vulnerable to XSS, harder to revoke. Server-side sessions in cookies are the modern recommendation for same-origin browser apps.
- **JWT in httpOnly cookies.** Considered. Rejected for v1 — sessions table is simple, gives instant revocation, and matches our auditability stance. The signed-JWT-in-cookie pattern can be adopted later if the session table becomes a hot path (unlikely at this scale).
- **Invitation by token only (no email match).** Rejected — link forwarding could let an unintended person join the Household. Email-match-at-acceptance closes that loophole cheaply.

## Consequences

- The Go backend uses `golang.org/x/oauth2/google` for Google OAuth. Likely uses `coreos/go-oidc` for ID-token validation.
- Email delivery (for invitations) becomes a v1 dependency. Likely Resend, Postmark, or similar transactional-email service; concrete pick deferred.
- The `users.email` field is treated as mutable display/contact info; identity is keyed by `users.google_sub`.
- The `users` table needs a soft-delete-aware unique constraint on `google_sub` (per ADR-0007's note on partial indexes).
- Adding Apple OAuth later is a column add (`apple_sub`), a second auth handler, and an account-linking flow if a User wants both. Non-breaking.
- Adding passkeys later is a new table (`webauthn_credentials`) and an additional login path. Non-breaking.
- Session expiration uses a sliding 30-day window. Tunable; recorded here as the default.
