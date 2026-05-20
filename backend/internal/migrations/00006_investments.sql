-- +goose Up
-- Investment position group (M4.3a): Stock, MutualFund, Gold subtypes
-- with quantity+price-shape snapshots. Bond and TimeDeposit subtypes
-- ship in M4.3b with accrued-interest-shape snapshots.
--
-- See ADR-0009  (Position storage; investments have a subtype enum and
--                per-subtype extension tables).
--     ADR-0022  (One snapshot table per group; investment_snapshots has
--                subtype-conditional nullable columns + XOR CHECK).
--     ADR-0007  (Soft-delete cross-cutting).
--     ADR-0011  (DECIMAL(20, 4) for amounts; DECIMAL(20, 8) for rates
--                and instrument quantities).
--
-- The subtype enum carries all five values (including bond and
-- time_deposit) up front to avoid an ALTER in M4.3b. Likewise the
-- status enum carries 'matured' even though only 'active' and 'sold'
-- are reachable from the M4.3a subtypes.

CREATE TABLE investments (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID         NOT NULL REFERENCES households(id),
    display_name       TEXT         NOT NULL,
    description        TEXT,
    subtype            TEXT         NOT NULL
                                    CHECK (subtype IN ('stock', 'mutual_fund', 'bond', 'gold', 'time_deposit')),
    ownership_type     TEXT         NOT NULL CHECK (ownership_type IN ('sole', 'joint')),
    sole_owner_user_id UUID         REFERENCES users(id),
    native_currency    TEXT         NOT NULL,
    status             TEXT         NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'sold', 'matured')),
    terminated_at      DATE,
    termination_note   TEXT,
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         UUID         REFERENCES users(id),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,

    CHECK ((ownership_type = 'sole') = (sole_owner_user_id IS NOT NULL))
);

CREATE INDEX investments_household_id_idx ON investments(household_id) WHERE deleted_at IS NULL;

CREATE TABLE stock_details (
    investment_id UUID PRIMARY KEY REFERENCES investments(id),
    ticker        TEXT NOT NULL,
    exchange      TEXT NOT NULL
);

CREATE TABLE mutual_fund_details (
    investment_id UUID PRIMARY KEY REFERENCES investments(id),
    fund_code     TEXT NOT NULL,
    fund_manager  TEXT
);

CREATE TABLE gold_details (
    investment_id UUID           PRIMARY KEY REFERENCES investments(id),
    form          TEXT           NOT NULL CHECK (form IN ('bar', 'coin', 'digital', 'jewelry')),
    purity        DECIMAL(5, 4)  NOT NULL CHECK (purity > 0 AND purity <= 1)
);

CREATE TABLE investment_snapshots (
    id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id    UUID            NOT NULL REFERENCES investments(id),
    year_month       DATE            NOT NULL,
    amount           DECIMAL(20, 4)  NOT NULL,
    currency         TEXT            NOT NULL,
    quantity         DECIMAL(20, 8),
    price_per_unit   DECIMAL(20, 4),
    accrued_interest DECIMAL(20, 4),
    as_of_date       DATE,
    description      TEXT,
    created_by       UUID            REFERENCES users(id),
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by       UUID            REFERENCES users(id),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT investment_snapshot_shape CHECK (
        (quantity IS NOT NULL AND price_per_unit IS NOT NULL AND accrued_interest IS NULL)
        OR
        (quantity IS NULL AND price_per_unit IS NULL AND accrued_interest IS NOT NULL)
    )
);

CREATE UNIQUE INDEX investment_snapshots_investment_year_month_idx
    ON investment_snapshots(investment_id, year_month) WHERE deleted_at IS NULL;

CREATE INDEX investment_snapshots_investment_id_idx
    ON investment_snapshots(investment_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS investment_snapshots;
DROP TABLE IF EXISTS gold_details;
DROP TABLE IF EXISTS mutual_fund_details;
DROP TABLE IF EXISTS stock_details;
DROP TABLE IF EXISTS investments;
