# User-defined position tags

A **Tag** is a household-defined label a User can attach to any Position to group it on a
breakdown report. Each Position carries **at most one** Tag (a nullable FK); Positions with none
fall into an **Untagged** bucket. A new report sums Position value by Tag, per currency, so the
household can answer "how much sits behind each grouping I care about" — by bank, by goal, by risk
bucket, by anything they choose to name. Tags are orthogonal to every existing domain field
(notably the bank-account / time-deposit `bank_name`), carry no built-in financial meaning, and are
free-add only (no seed list).

## Why now

Issue #28 began as "reshape Banks from free text into a lookup, attach it to positions, and report
totals per institution." The general need underneath it is **customized asset grouping**: a User
wants to slice their positions along an axis the app does not model — which institution holds a
position, which life goal it serves, which risk bucket it belongs to — and read the totals and
proportions for that slice.

Baking any one such axis into the schema (a bank lookup, a custodian FK, a goal enum) would solve a
single case while inviting the next one as another migration. Instead the household gets a
**neutral grouping primitive** and supplies the meaning. "By bank," "by goal," "by risk" all become
Tag values the User names — no fixed taxonomy, no financial semantics in the model. Because a Tag
asserts nothing about *where value is held* or *what a position is*, it composes cleanly with every
group without special-casing.

## The decision

### A Tag is a household-scoped, soft-deleted lookup

```sql
CREATE TABLE tags (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID        NOT NULL REFERENCES households(id),
    name         TEXT        NOT NULL,
    color        TEXT        NOT NULL,              -- one of a fixed swatch palette
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);
-- name unique per household among the living
CREATE UNIQUE INDEX tags_household_name_live
    ON tags (household_id, lower(name)) WHERE deleted_at IS NULL;
```

`color` is required at create — the User picks from a fixed swatch palette so a tag keeps a stable
hue across the pie and table. Free-add only: there is no seed list. Soft-delete follows
[[adr-0007]]; a deleted Tag's FK references go NULL-at-read (the Position falls back to Untagged)
rather than cascading a hard delete.

### One nullable `tag_id` on each shared Position table

The FK lives on the four shared Position parents, not the subtype extension tables:

```sql
ALTER TABLE assets       ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE liabilities  ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE receivables  ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE investments  ADD COLUMN tag_id UUID REFERENCES tags(id);
```

This covers all ten groups (three asset subtypes, two liability subtypes, receivable, five
investment subtypes) with four columns, because the subtype rows hang off these four parents.
**Income is excluded** — it is a flow event, not a Position (CONTEXT "Income is a flat flow event"),
and net-worth grouping is a position concept.

### Single tag, not many — for clean proportions

A Position carries **at most one** Tag. The deciding reason is the report: with multiple tags per
Position, "proportion by tag" double-counts and the slices sum past 100%, so a pie stops meaning
anything. One optional FK makes Tags a **partition** — every Position lands in exactly one slice
(its Tag, or Untagged), proportions sum to 100%, and the pie is well-defined without a
normalisation rule. Multi-tag is a deferred escalation (a `position_tags` join table) if a real
multi-membership need appears; there is no signal for it yet, and YAGNI applies.

### Tenancy: belt + suspenders, as everywhere

Assigning a Tag validates `tag.household_id == position.household_id` in SQL, not just middleware —
the same rule every position-touching query already follows. A Tag from another household is
`ErrNotFound` on assign, never a silent cross-tenant link.

### The report: Σ value by Tag, per currency

A new household-scoped aggregate endpoint returns, per `(tag, currency)`, the sum of each
Position's **most recent snapshot value with `year_month ≤ now`** (the same carry-forward valuation
net worth uses, CONTEXT "Net Worth"). Conventions:

- **Per currency, no FX** — matching the list/home-screen convention; a multi-currency household
  sees one breakdown per currency rather than a converted total.
- **Liabilities are their own negative slice**, not netted into a tag's assets — a tag mixing a
  mortgage and a savings account should show both magnitudes, not their difference.
- **Untagged** is a real bucket in the output, so proportions are honest.
- Terminated Positions follow the net-worth rule: they contribute only for months ≤ their
  `terminated_at`, so a sold/closed Position drops out of the current-value breakdown.

UI: a dedicated `/tags` route (flat nav group, like Receivables / Income) renders a pie
(proportion) + table (sums) per currency. Tag management (create / rename / recolor / delete) is a
card in Settings, mirroring the locale + theme cards ([[adr-0026]]). Assignment is a single-select
Tag dropdown defaulting to "No tag" in every Position Create/Edit dialog.

## Out of scope

- **The bank lookup / institution framing.** `bank_name` on bank accounts and time deposits stays
  free text and untouched; Tags do not replace it. The original "banks as a lookup" idea is
  superseded, not deferred.
- **Multi-tag per Position** (join table) — deferred until a real need appears.
- **Tagging Income** — excluded by the position/flow-event split.

## Consequences

- One migration (00025): the `tags` table + four `tag_id` columns + the four sqlc query sets gain a
  tag parameter on create/update and select the column. No backfill — every existing Position reads
  as Untagged.
- The Position Create/Edit dialogs across all ten groups gain a shared Tag-select component;
  Settings gains a Tags card; a new `/tags` report screen and one nav entry land.
- Because the FK is nullable and defaults NULL, the feature is fully additive — no existing flow
  changes behaviour until a User creates and assigns a Tag.
