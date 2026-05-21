-- +goose Up
-- Investment subtypes for M4.3b: Bond + TimeDeposit. These exercise the
-- accrued-interest snapshot shape (the second XOR branch on
-- investment_snapshots from migration 00006). No changes to the parent
-- `investments` table or to `investment_snapshots` — both already carry
-- 'bond' / 'time_deposit' in their subtype CHECK and the accrued-interest
-- value column.
--
-- See ADR-0009  (Position storage; subtype extension tables; status enum).
--     ADR-0022  (Snapshot table strategy; `amount` is dirty for
--                accrued-interest shapes — already includes accrued).
--     ADR-0011  (DECIMAL(20, 4) for amounts; DECIMAL(20, 8) for rates).
--
-- coupon_frequency enum values are settled to monthly | quarterly |
-- semi_annual | annual. Indonesian retail (ORI/SBR/SR/ST) pays monthly;
-- tradeable govt FR series and most corporates pay semi-annually. Floating-
-- rate bonds (SBR, ST) carry the *current* rate in coupon_rate; the user
-- edits on each reset.
--
-- rollover_policy is informational for M4.3b — it serves as the default
-- for the Maturity-transaction helper in M4.6 (ADR-0009 §"Maturity
-- transaction extension"). The actual rollover mechanic is a Maturity
-- transaction with explicit principal_disposition / interest_disposition.
--
-- Maturity-date indexes are deferred until a "maturing soon" query
-- pattern exists; M4.2 set the precedent of not pre-indexing date columns
-- on extension tables (liabilities.maturity_date, receivables.due_date).

CREATE TABLE bond_details (
    investment_id    UUID            PRIMARY KEY REFERENCES investments(id),
    bond_type        TEXT            NOT NULL CHECK (bond_type IN ('govt_primary', 'secondary_market')),
    issuer           TEXT            NOT NULL,
    face_value       DECIMAL(20, 4)  NOT NULL,
    coupon_rate      DECIMAL(20, 8)  NOT NULL,
    coupon_frequency TEXT            NOT NULL DEFAULT 'monthly'
                                     CHECK (coupon_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
    maturity_date    DATE            NOT NULL
);

CREATE TABLE time_deposit_details (
    investment_id    UUID            PRIMARY KEY REFERENCES investments(id),
    bank_name        TEXT            NOT NULL,
    principal        DECIMAL(20, 4)  NOT NULL,
    interest_rate    DECIMAL(20, 8)  NOT NULL,
    term_months      INTEGER         NOT NULL CHECK (term_months > 0),
    placement_date   DATE            NOT NULL,
    maturity_date    DATE            NOT NULL,
    rollover_policy  TEXT            NOT NULL
                                     CHECK (rollover_policy IN ('auto_renew_principal', 'auto_renew_with_interest', 'no_rollover'))
);

-- +goose Down
DROP TABLE IF EXISTS time_deposit_details;
DROP TABLE IF EXISTS bond_details;
