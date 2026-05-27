-- +goose Up
-- M5 slice 3 — manual FX rates + the multi-currency toggle.
--
-- Every monetary value is stored in its native currency (ADR-0002); net-worth
-- aggregation converts non-reporting currencies through a per-month rate.
-- v1 enters rates manually; an external feed (Frankfurter/ECB) is a deferred
-- swap-in that writes the same rows (ADR-0002 "M5 implementation notes").
--
-- fx_rates is household-scoped for tenancy uniformity. `rate` is the number of
-- reporting-currency units per 1 unit of `currency` (DECIMAL(20,8) per ADR-0011).
-- By convention the rate is the month-end rate for `year_month` — there is no
-- as-of-date; `created_at` is audit-only (when entered, not the rate's month).
-- The reporting currency itself needs no row (its rate is implicitly 1). For a
-- month M a currency converts at its most recent rate with year_month <= M
-- (carry-forward, mirroring snapshots); a held currency with no rate <= M is
-- excluded from the converted totals and surfaced as missing_fx, never 1:1.
-- Soft-delete so edits/deletes feed the report staleness check (ADR-0006).
--
-- households.multi_currency_enabled (default false) gates UI exposure and
-- whether conversion runs — NOT storage (currency stays on every row). When
-- false the household is single-currency: the report engine sums native
-- amounts directly and this table stays empty/dormant. See CONTEXT.md
-- (Multi-currency reporting) and ADR-0002.
--
-- See ADR-0002 (Multi-currency: native + reporting),
--     ADR-0006 (staleness inputs),
--     ADR-0011 (DECIMAL(20, 8) for rates),
--     ADR-0007 (soft-delete).

CREATE TABLE fx_rates (
    id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID            NOT NULL REFERENCES households(id),
    year_month   DATE            NOT NULL,
    currency     TEXT            NOT NULL,
    rate         DECIMAL(20, 8)  NOT NULL,
    created_by   UUID            REFERENCES users(id),
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by   UUID            REFERENCES users(id),
    updated_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

-- One rate per (Household, month, currency); the conflict/lookup key.
CREATE UNIQUE INDEX fx_rates_household_year_month_currency_idx
    ON fx_rates(household_id, year_month, currency) WHERE deleted_at IS NULL;

CREATE INDEX fx_rates_household_id_idx
    ON fx_rates(household_id) WHERE deleted_at IS NULL;

ALTER TABLE households
    ADD COLUMN multi_currency_enabled BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE households DROP COLUMN IF EXISTS multi_currency_enabled;
DROP TABLE IF EXISTS fx_rates;
