-- +goose Up
-- M5 — Materialized monthly net-worth reports.
--
-- One row per (Household, year_month). The headline dashboard query (net worth
-- across every Position) is served from here rather than recomputed per read;
-- finer drill-downs stay on-the-fly against the source tables. Lazy generation
-- with a staleness watermark and manual rebuild — see ADR-0006.
--
-- Column layout follows ADR-0012 (hybrid: wide columns for closed-enum
-- breakdowns, JSONB for variable-cardinality breakdowns + audit snapshots).
--
-- This table is a regenerable CACHE, not domain data: it is fully derivable
-- from the snapshot / transaction / income / fx_rate inputs, feeds nothing
-- downstream, and carries no soft-delete (ADR-0007's "soft-delete everything"
-- targets domain mutations so deletes stay recoverable and feed staleness —
-- neither applies to a derived cache). Regeneration upserts in place keyed by
-- the unique (household_id, year_month). `generated_at` is the sole timestamp;
-- it doubles as the staleness comparison point against the inputs' updated_at.
--
-- Slice-1 scope (this migration ships the full schema, the engine fills part):
--   net worth + group breakdowns + user_breakdowns.nw + stale_positions are
--   populated now; the income-statement columns (earned_income_*,
--   investment_return_*, asset_value_change, derived_living_expenses) and the
--   fx_rates_used / missing_fx JSON arrive with M5 slices 2-3. They are
--   nullable both for that staged rollout and because the income-statement
--   lines are NULL on the first-month baseline (no prior month — see ADR-0006).
--
-- See ADR-0006  (Materialized monthly net-worth reports).
--     ADR-0012  (Monthly report row layout: hybrid columns + JSON).
--     ADR-0008  (Comprehensive-income identity: earned income / return /
--                asset value change / residual living expenses).
--     ADR-0011  (DECIMAL(20, 4) for monetary amounts).

CREATE TABLE monthly_reports (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID         NOT NULL REFERENCES households(id),
    year_month   DATE         NOT NULL,
    generated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Net worth — top-line + group breakdowns. Always computed.
    -- nw_liabilities is stored as a positive magnitude (the amount owed);
    -- nw_total = nw_assets + nw_receivables + nw_investments - nw_liabilities.
    nw_total       DECIMAL(20, 4)  NOT NULL DEFAULT 0,
    nw_assets      DECIMAL(20, 4)  NOT NULL DEFAULT 0,
    nw_liabilities DECIMAL(20, 4)  NOT NULL DEFAULT 0,
    nw_receivables DECIMAL(20, 4)  NOT NULL DEFAULT 0,
    nw_investments DECIMAL(20, 4)  NOT NULL DEFAULT 0,

    -- Earned income — top-line + by-category (closed enum, migration 00011).
    earned_income_total      DECIMAL(20, 4),
    earned_income_salary     DECIMAL(20, 4),
    earned_income_business   DECIMAL(20, 4),
    earned_income_rental     DECIMAL(20, 4),
    earned_income_gift       DECIMAL(20, 4),
    earned_income_tax_refund DECIMAL(20, 4),
    earned_income_insurance  DECIMAL(20, 4),
    earned_income_other      DECIMAL(20, 4),

    -- Investment return — top-line + by-subtype (closed enum, ADR-0009).
    investment_return_total        DECIMAL(20, 4),
    investment_return_stock        DECIMAL(20, 4),
    investment_return_mutual_fund  DECIMAL(20, 4),
    investment_return_bond         DECIMAL(20, 4),
    investment_return_gold         DECIMAL(20, 4),
    investment_return_time_deposit DECIMAL(20, 4),

    -- Non-cash mark change of property + vehicle (ADR-0008, M5 grilling).
    asset_value_change DECIMAL(20, 4),

    -- Residual cash-spending proxy (ADR-0008/0012). Signed.
    derived_living_expenses DECIMAL(20, 4),

    -- Variable-cardinality breakdowns + frozen audit snapshots (ADR-0012).
    user_breakdowns JSONB NOT NULL DEFAULT '{}',  -- keyed by user_id and "joint"
    fx_rates_used   JSONB NOT NULL DEFAULT '{}',  -- rates applied at generation (slice 3)
    stale_positions JSONB NOT NULL DEFAULT '[]',  -- position IDs carried-forward into this month
    missing_fx      JSONB NOT NULL DEFAULT '[]'   -- positions excluded for want of an FX rate (slice 3)
);

-- One row per Household per month; the conflict target for upsert-on-regen.
CREATE UNIQUE INDEX monthly_reports_household_year_month_idx
    ON monthly_reports(household_id, year_month);

-- +goose Down
DROP TABLE IF EXISTS monthly_reports;
