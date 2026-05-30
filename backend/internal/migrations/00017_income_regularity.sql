-- +goose Up
-- M6 — Add Regularity flag to Income (routine vs incidental).
--
-- A two-value classification orthogonal to `category`: salary, business
-- income, and rental income are typically routine; gifts, tax refunds, and
-- insurance payouts are typically incidental. The flag drives a list-row
-- icon and a chip filter on the Income screen, and gives reports an axis
-- for separating recurring cash flow from one-off bumps.
--
-- Backfill is 'routine' because the dominant existing-row case is salary
-- (see M4.5 grilling decisions). Pre-alpha; no staged migration needed,
-- the column lands NOT NULL in one step.

ALTER TABLE income
    ADD COLUMN regularity TEXT
        CHECK (regularity IN ('routine', 'incidental'));

UPDATE income SET regularity = 'routine' WHERE regularity IS NULL;

ALTER TABLE income
    ALTER COLUMN regularity SET NOT NULL;

-- +goose Down
ALTER TABLE income DROP COLUMN IF EXISTS regularity;
