# User and Household entity shape

The two identity entities are kept minimal in v1. Most preference-shaped concerns (per-User
reporting currency override, default-ownership selector, profile picture, address, theme) are
deliberately omitted because they're additive and the default behaviour already covers the canonical
use case — a couple jointly tracking shared finances.

## Schema

### Households

| Field | Notes |
|---|---|
| `id` | UUID |
| `display_name` | required |
| `reporting_currency` | required, ISO code, default `'IDR'` — formalises the per-Household currency setting introduced by ADR-0002 |
| audit + soft-delete | per ADR-0007 |

### Users

| Field | Notes |
|---|---|
| `id` | UUID |
| `household_id` | FK to households |
| `display_name` | required |
| `email` | required, unique — auth-related; the precise auth shape (password vs OAuth vs passkey) is deferred to the tech-stack phase |
| `locale` | text, default `'id-ID'` — one User can prefer Indonesian UI while another prefers English |
| `time_zone` | text, default `'Asia/Jakarta'` — interprets "current month" in user-relative time |
| audit + soft-delete | per ADR-0007 |

Auth-specific columns (`password_hash`, OAuth provider identifiers, sessions table) are not modelled
here; their shape depends on which auth approach lands in the tech-stack round.

## Default ownership for new entries (frontend behaviour, not stored)

When a User opens an entry form:
- **Income**: defaults to `SoleOwner(current_user)`. Editable per-entry.
- **Snapshots, Transactions**: inherit the parent Position's `ownership`. Not normally edited.

No `default_ownership` preference is stored on the User. The override is per-entry; the audit fields
(`created_by`, `created_at`) record the actual actor regardless of which User the entry is
attributed to. This preserves the ADR-0004 rule that any User in the Household can enter data on
behalf of another — the husband can submit the wife's salary by flipping the selector to
`SoleOwner(wife)`; `created_by` will still record him.

## Per-User reporting currency override — deferred

The Household's `reporting_currency` is the canonical net-worth computation currency. The
materialized monthly report (ADR-0006) stores its rows in this currency. A side-by-side
multi-currency display (e.g., IDR and USD columns on the dashboard) is purely a *rendering* concern
— the existing per-month FX rate table (ADR-0002) provides the conversions needed to project any
historical month into any currency at display time. No schema change required.

Adding a per-User `display_currency` column later (so each User sees the dashboard in their own
preferred currency by default) is a one-column additive change. Not needed for v1.

## Considered alternatives

- **Per-User reporting currency override stored now.** Rejected — non-breaking to add later, no
  current pain.
- **`default_income_ownership` preference column on User.** Rejected — canonical case is
  sole-to-earner; per-entry override handles the rest.
- **Profile picture URL, address, demographic fields.** Deferred — nullable additions when needed.
- **Theme / UI preferences on User.** Rejected — pure frontend concern, can live in `localStorage`.
- **Multi-household membership for a User.** Already deferred by ADR-0004; reaffirmed here.

## Consequences

- Two small tables, easy to extend without breaking changes.
- Multi-currency dashboard displays remain a UI concern using the FX rate table; the materialized
  report stores a single canonical currency per Household.
- "Enter on behalf of" works without any schema affordance — the entry form's ownership selector is
  editable per-entry, and `created_by` records the actual actor.
- Auth-shape decisions (password vs OAuth vs passkey) bolt onto `users` later without disturbing
  this shape.
