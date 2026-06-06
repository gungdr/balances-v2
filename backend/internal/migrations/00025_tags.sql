-- +goose Up
-- M6 — User-defined position Tags (issue #28, ADR-0028). A Tag is a
-- household-defined grouping label a User attaches to a Position to slice it
-- on a breakdown report ("by bank", "by goal", "by risk bucket" — the User
-- supplies the meaning, the schema bakes in none).
--
-- color is a free-form palette key/hex chosen from a fixed frontend swatch;
-- left un-CHECKed on purpose so the palette can evolve without a migration
-- (the FE enforces the swatch). Soft-deleted per ADR-0007; the partial unique
-- index lets a deleted name be reused.

CREATE TABLE tags (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID         NOT NULL REFERENCES households(id),
    name         TEXT         NOT NULL,
    color        TEXT         NOT NULL,
    created_by   UUID         REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   UUID         REFERENCES users(id),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX tags_household_id_idx ON tags(household_id) WHERE deleted_at IS NULL;

-- Name unique per household among the living (case-insensitive).
CREATE UNIQUE INDEX tags_household_name_live
    ON tags (household_id, lower(name)) WHERE deleted_at IS NULL;

-- One nullable Tag per Position, on the four shared parent tables (subtype
-- rows hang off these). Income is excluded — it is a flow event, not a
-- Position. ON DELETE is left as the default (RESTRICT): Tags are soft-deleted,
-- never hard-deleted through the app, so the FK is never orphaned at runtime.
ALTER TABLE assets       ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE liabilities  ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE receivables  ADD COLUMN tag_id UUID REFERENCES tags(id);
ALTER TABLE investments  ADD COLUMN tag_id UUID REFERENCES tags(id);

-- +goose Down
ALTER TABLE investments  DROP COLUMN tag_id;
ALTER TABLE receivables  DROP COLUMN tag_id;
ALTER TABLE liabilities  DROP COLUMN tag_id;
ALTER TABLE assets       DROP COLUMN tag_id;

DROP TABLE tags;
