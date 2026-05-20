-- +goose Up
-- Liability and Receivable position groups with amount-shaped snapshots.
-- See ADR-0009 (Position storage; liabilities have a subtype enum and
--               inline metadata; receivables have no subtype and inline
--               metadata).
--     ADR-0022 (One snapshot table per group; amount-shape tables share
--               column lists with asset_snapshots).
--     ADR-0007 (Soft-delete cross-cutting).
--     ADR-0011 (DECIMAL(20, 4) for amounts; DECIMAL(20, 8) for rates).

CREATE TABLE liabilities (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID         NOT NULL REFERENCES households(id),
    display_name       TEXT         NOT NULL,
    description        TEXT,
    subtype            TEXT         NOT NULL CHECK (subtype IN ('personal', 'institutional')),
    ownership_type     TEXT         NOT NULL CHECK (ownership_type IN ('sole', 'joint')),
    sole_owner_user_id UUID         REFERENCES users(id),
    native_currency    TEXT         NOT NULL,
    status             TEXT         NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'paid_off', 'forgiven', 'written_off')),
    terminated_at      DATE,
    termination_note   TEXT,
    counterparty_name  TEXT         NOT NULL,
    principal          DECIMAL(20, 4),
    interest_rate      DECIMAL(20, 8),
    term_months        INT,
    start_date         DATE,
    maturity_date      DATE,
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         UUID         REFERENCES users(id),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,

    CHECK ((ownership_type = 'sole') = (sole_owner_user_id IS NOT NULL))
);

CREATE INDEX liabilities_household_id_idx ON liabilities(household_id) WHERE deleted_at IS NULL;

CREATE TABLE liability_snapshots (
    id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    liability_id  UUID            NOT NULL REFERENCES liabilities(id),
    year_month    DATE            NOT NULL,
    amount        DECIMAL(20, 4)  NOT NULL,
    currency      TEXT            NOT NULL,
    as_of_date    DATE,
    description   TEXT,
    created_by    UUID            REFERENCES users(id),
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by    UUID            REFERENCES users(id),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX liability_snapshots_liability_year_month_idx
    ON liability_snapshots(liability_id, year_month) WHERE deleted_at IS NULL;

CREATE INDEX liability_snapshots_liability_id_idx
    ON liability_snapshots(liability_id) WHERE deleted_at IS NULL;

CREATE TABLE receivables (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID         NOT NULL REFERENCES households(id),
    display_name       TEXT         NOT NULL,
    description        TEXT,
    ownership_type     TEXT         NOT NULL CHECK (ownership_type IN ('sole', 'joint')),
    sole_owner_user_id UUID         REFERENCES users(id),
    native_currency    TEXT         NOT NULL,
    status             TEXT         NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'collected', 'written_off')),
    terminated_at      DATE,
    termination_note   TEXT,
    counterparty_name  TEXT         NOT NULL,
    due_date           DATE,
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         UUID         REFERENCES users(id),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,

    CHECK ((ownership_type = 'sole') = (sole_owner_user_id IS NOT NULL))
);

CREATE INDEX receivables_household_id_idx ON receivables(household_id) WHERE deleted_at IS NULL;

CREATE TABLE receivable_snapshots (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id   UUID            NOT NULL REFERENCES receivables(id),
    year_month      DATE            NOT NULL,
    amount          DECIMAL(20, 4)  NOT NULL,
    currency        TEXT            NOT NULL,
    as_of_date      DATE,
    description     TEXT,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by      UUID            REFERENCES users(id),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX receivable_snapshots_receivable_year_month_idx
    ON receivable_snapshots(receivable_id, year_month) WHERE deleted_at IS NULL;

CREATE INDEX receivable_snapshots_receivable_id_idx
    ON receivable_snapshots(receivable_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS receivable_snapshots;
DROP TABLE IF EXISTS receivables;
DROP TABLE IF EXISTS liability_snapshots;
DROP TABLE IF EXISTS liabilities;
