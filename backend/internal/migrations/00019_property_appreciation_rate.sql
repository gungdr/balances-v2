-- +goose Up
-- M6 — Rename property_details.annual_amortization_rate to annual_appreciation_rate.
--
-- The old name was an accounting-taxonomy mistake: amortization is for
-- *intangible* assets (patents, goodwill). Tangible property typically
-- appreciates (house + land); some tangible property declines (HGB-leasehold
-- apartments, leasehold improvements). A signed rate captures both: positive
-- grows, negative declines, NULL means no helper. The column stays
-- DECIMAL(20, 8) with no CHECK — the sign carries the direction.
--
-- Vehicle's annual_depreciation_rate is left alone: depreciation is the
-- correct term for tangibles that wear out, and vehicles essentially always
-- depreciate. The frontend negates its (still-positive) value when feeding
-- the shared revaluation helper.
--
-- Existing dev data is NULLed because old values meant "loss %/yr" — a
-- direct rename would silently flip them into appreciation. Pre-alpha,
-- so this is just nuking test rows; users re-enter the correct sign.

UPDATE property_details SET annual_amortization_rate = NULL;

ALTER TABLE property_details
    RENAME COLUMN annual_amortization_rate TO annual_appreciation_rate;

-- +goose Down
-- Rename back; cannot restore the wiped values.
ALTER TABLE property_details
    RENAME COLUMN annual_appreciation_rate TO annual_amortization_rate;
