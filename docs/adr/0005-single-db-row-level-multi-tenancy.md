# Single-database row-level multi-tenancy

Multiple Households share a single database and the same set of tables. Every domain row carries a `household_id` foreign key. Tenancy is enforced at the application layer: a middleware reads the authenticated User's Household once per request and injects it into the request context; every repository function then filters by that `household_id`.

The threat model is cross-Household leakage between unrelated tenants, not intra-Household privacy — Users within a Household are designed to have full mutual access. With filtering done at a single chokepoint (a context-aware repository layer), the surface for forgetting a filter is small.

## Considered alternatives

- **Database-per-tenant.** Rejected — too much operational overhead for an app with potential casual sharing among Households.
- **Schema-per-tenant.** Rejected — same overhead concerns; provisioning per Household and migrating multiple schemas is awkward.
- **Postgres Row-Level Security (RLS).** Deferred — adds belt-and-suspenders enforcement at the DB level, but the v1 threat model doesn't warrant the operational complexity (policy maintenance, debugging surprises in tests). Adoption later is non-breaking — RLS layers on top of existing application-level filters.

## Consequences

- Every domain table includes `household_id`; every repository query filters on it.
- A migration or test that forgets `household_id` could leak across Households — guard with integration tests that exercise multi-Household scenarios from day one.
- "Export this Household's data" is a single-WHERE-clause query.
