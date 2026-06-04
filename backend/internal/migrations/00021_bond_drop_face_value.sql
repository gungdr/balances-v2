-- +goose Up
-- M6 / issue #27 — Drop bond_details.face_value; outstanding nominal is now
-- derived from the ledger.
--
-- Once a primary bond's placement is recorded as a Buy (like secondary-market
-- bonds always were), a bond's held nominal falls out of the transactions:
--   outstanding face = (Σ buy_qty − Σ sell_qty) × 1,000,000
-- and its cost basis = Σ amount (handles premium/discount where cash ≠ nominal).
-- Keeping a hand-maintained face_value scalar alongside that ledger would be a
-- duplicated source of truth that drifts on every buy/sell edit (ADR-0003,
-- derive-don't-duplicate). So the column goes.
--
-- Pre-existing primary bonds were backfilled with per-tranche Buys reconstructed
-- from their snapshot value-steps before this migration, so dropping the column
-- loses no information.

ALTER TABLE bond_details DROP COLUMN face_value;

-- +goose Down
-- Restore as nullable-with-default; the original per-row values cannot be
-- recovered (they now live only in the reconstructed Buy ledger).
ALTER TABLE bond_details ADD COLUMN face_value DECIMAL(20, 4) NOT NULL DEFAULT 0;
