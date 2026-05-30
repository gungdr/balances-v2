-- +goose Up
-- M6 — Add Risk Profile to investments (low / medium / high).
--
-- One classification covering all 5 subtypes (stock, mutual_fund, gold, bond,
-- time_deposit). Lives on the shared `investments` table (per the ADR-0022
-- principle: uniform-across-subtypes data sits on the parent row; subtype-
-- specific data goes in *_details). Drives a list-row shield-icon badge and
-- a chip-bar filter on each per-subtype list screen.
--
-- The dialog deliberately forces a manual choice on create (no default), so
-- the user thinks about it; existing rows are backfilled to 'medium' as a
-- neutral starting point. Pre-alpha — column lands NOT NULL in one step.

ALTER TABLE investments
    ADD COLUMN risk_profile TEXT
        CHECK (risk_profile IN ('low', 'medium', 'high'));

UPDATE investments SET risk_profile = 'medium' WHERE risk_profile IS NULL;

ALTER TABLE investments
    ALTER COLUMN risk_profile SET NOT NULL;

-- +goose Down
ALTER TABLE investments DROP COLUMN IF EXISTS risk_profile;
