# Household-scoped data with Sole / Joint ownership

The app is shared by multiple Users within a single **Household**. A Household is the unit of access and aggregation: every Position, Snapshot, and Transaction belongs to exactly one Household. All Users within a Household have full read/write access to all Household data — there are no per-user permissions in v1, because the canonical use case is a couple jointly tracking shared finances and approval workflows would only add friction.

Each Position carries an **Ownership** attribute — either `SoleOwner(user_id)` or `Joint` — used purely for net-worth-breakdown reporting, not access control. Either spouse can edit the other's SoleOwner positions; the field is a label, not a gate. Ownership captures the Household's *intent* for attribution, not the legal deed or registered account holder.

A User belongs to exactly one Household in v1; multi-household membership ("personal + business") is deferred to keep all queries unambiguously scoped by the User's single Household. Adding a join table later is a non-breaking change.

## Considered alternatives

- **No Ownership attribute (Household total only).** Rejected — Users want per-User net-worth views to track individual progress, not just the Household total.
- **Share-percentage Ownership (e.g., 60/40).** Rejected — adds UI complexity (entering and displaying splits), arithmetic complexity (every breakdown becomes weighted), and rebalancing concerns on transactions. The discriminated `Sole | Joint` covers the common case; a 60/40 property can be approximated with two SoleOwner positions if it ever arises.
- **Per-user permissions / approval flows.** Deferred — within a Household trust is the default; couples tracking shared finances don't want approval gates.
