-- +goose Up
-- Project-wide rate convention switch: store rates as percentage (e.g., 5.5
-- for 5.5%) rather than decimal fraction (0.055). Backtrack on a pre-alpha
-- UX choice — typing 0.055 for "5.5%" was a constant mental conversion.
-- Storage type DECIMAL(20, 8) is unchanged; only the units convention shifts.
--
-- Affects five columns across four position groups and the two M4.3b
-- investment subtypes:
--   liabilities.interest_rate
--   property_details.annual_amortization_rate
--   vehicle_details.annual_depreciation_rate
--   bond_details.coupon_rate
--   time_deposit_details.interest_rate
--
-- After this migration, the frontend create/edit forms read/write the same
-- number the user sees on screen — no client-side scaling.

UPDATE liabilities          SET interest_rate            = interest_rate            * 100 WHERE interest_rate            IS NOT NULL;
UPDATE property_details     SET annual_amortization_rate = annual_amortization_rate * 100 WHERE annual_amortization_rate IS NOT NULL;
UPDATE vehicle_details      SET annual_depreciation_rate = annual_depreciation_rate * 100 WHERE annual_depreciation_rate IS NOT NULL;
UPDATE bond_details         SET coupon_rate              = coupon_rate              * 100;
UPDATE time_deposit_details SET interest_rate            = interest_rate            * 100;

-- +goose Down
UPDATE liabilities          SET interest_rate            = interest_rate            / 100 WHERE interest_rate            IS NOT NULL;
UPDATE property_details     SET annual_amortization_rate = annual_amortization_rate / 100 WHERE annual_amortization_rate IS NOT NULL;
UPDATE vehicle_details      SET annual_depreciation_rate = annual_depreciation_rate / 100 WHERE annual_depreciation_rate IS NOT NULL;
UPDATE bond_details         SET coupon_rate              = coupon_rate              / 100;
UPDATE time_deposit_details SET interest_rate            = interest_rate            / 100;
