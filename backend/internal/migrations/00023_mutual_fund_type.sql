-- +goose Up
-- M6 — Add Fund Type to mutual funds (issue #20).
--
-- A global (not Indonesia-specific) classification. The first four values are
-- the universal ICI / Morningstar top-level asset classes — money market,
-- fixed income (bond), equity (stock), mixed (hybrid/balanced/allocation). The
-- next four are the structural wrappers households actually name: index funds,
-- ETFs, target-date/lifecycle funds, and commodity funds. `other` absorbs the
-- niche tail (municipal/tax-exempt, alternative/hedge, sector). The enum value
-- stays neutral English; locale files carry the display name (e.g. Saham /
-- Pendapatan Tetap in id). Syariah/ESG are orthogonal flavours, not types — a
-- separate flag if ever needed, never a fund_type value.
--
-- Subtype-specific data, so it lives on mutual_fund_details, NOT the shared
-- investments table (ADR-0022: uniform-across-subtypes data on the parent
-- row; subtype-specific data in *_details). Mirrors gold_details.form — a
-- closed enum enforced by a CHECK on the extension table.
--
-- The create dialog forces a deliberate choice (no default), like
-- risk_profile. Existing rows have no known classification, so they backfill
-- to 'other'. Pre-alpha — the column lands NOT NULL in one step.

ALTER TABLE mutual_fund_details
    ADD COLUMN fund_type TEXT
        CHECK (fund_type IN (
            'money_market', 'fixed_income', 'equity', 'mixed',
            'index', 'etf', 'target_date', 'commodity', 'other'
        ));

UPDATE mutual_fund_details SET fund_type = 'other' WHERE fund_type IS NULL;

ALTER TABLE mutual_fund_details
    ALTER COLUMN fund_type SET NOT NULL;

-- +goose Down
ALTER TABLE mutual_fund_details DROP COLUMN IF EXISTS fund_type;
