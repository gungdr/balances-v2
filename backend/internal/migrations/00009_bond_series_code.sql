-- +goose Up
-- Add series_code to bond_details for structured-identifier parity with
-- MutualFund's fund_code and Stock's ticker. The pre-M4.3b-frontend grilling
-- caught the asymmetry — bond series (ORI021, SBR041, ST012, FR0089) had no
-- structured slot and would have lived in display_name as free-text, leading
-- to inconsistent variants across positions.
--
-- Nullable because: corporate bonds without a published code exist; users
-- without the code shouldn't be blocked. Stock.ticker is required because
-- exchanges always have one; bond series codes are softer in practice.

ALTER TABLE bond_details ADD COLUMN series_code TEXT;

-- +goose Down
ALTER TABLE bond_details DROP COLUMN series_code;
