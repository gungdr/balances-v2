-- +goose Up
-- Assets schema: the Asset position group with the bank_account subtype
-- extension table and amount-shaped monthly snapshots.
-- See ADR-0009 (Position storage, lifecycle, Maturity disposition),
--     ADR-0007 (Soft-delete cross-cutting),
--     ADR-0011 (DECIMAL(20, 4) for monetary amounts),
--     Q12a (snapshots keyed by (position_id, year_month) with optional
--           as_of_date for audit).
--
-- Property and vehicle subtype extension tables are deferred to M4.
-- The assets.subtype enum already accepts those values so M4 only adds
-- the extension tables, not a schema change here.

CREATE TABLE assets (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID         NOT NULL REFERENCES households(id),
    display_name       TEXT         NOT NULL,
    description        TEXT,
    subtype            TEXT         NOT NULL CHECK (subtype IN ('bank_account', 'property', 'vehicle')),
    ownership_type     TEXT         NOT NULL CHECK (ownership_type IN ('sole', 'joint')),
    sole_owner_user_id UUID         REFERENCES users(id),
    native_currency    TEXT         NOT NULL,
    status             TEXT         NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'closed', 'sold', 'disposed')),
    terminated_at      DATE,
    termination_note   TEXT,
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         UUID         REFERENCES users(id),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,

    -- Ownership consistency: sole_owner_user_id is set iff ownership_type='sole'.
    CHECK ((ownership_type = 'sole') = (sole_owner_user_id IS NOT NULL))
);

CREATE INDEX assets_household_id_idx ON assets(household_id) WHERE deleted_at IS NULL;

CREATE TABLE bank_account_details (
    asset_id       UUID  PRIMARY KEY REFERENCES assets(id),
    bank_name      TEXT  NOT NULL,
    account_number TEXT  NOT NULL,
    account_type   TEXT  NOT NULL CHECK (account_type IN ('savings', 'current', 'other'))
);

CREATE TABLE asset_snapshots (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id    UUID            NOT NULL REFERENCES assets(id),
    year_month  DATE            NOT NULL,
    amount      DECIMAL(20, 4)  NOT NULL,
    currency    TEXT            NOT NULL,
    as_of_date  DATE,
    description TEXT,
    created_by  UUID            REFERENCES users(id),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by  UUID            REFERENCES users(id),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- One snapshot per Asset per month (soft-delete-aware unique per ADR-0007).
CREATE UNIQUE INDEX asset_snapshots_asset_year_month_idx
    ON asset_snapshots(asset_id, year_month) WHERE deleted_at IS NULL;

CREATE INDEX asset_snapshots_asset_id_idx
    ON asset_snapshots(asset_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS asset_snapshots;
DROP TABLE IF EXISTS bank_account_details;
DROP TABLE IF EXISTS assets;
