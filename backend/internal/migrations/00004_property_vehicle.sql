-- +goose Up
-- Property and vehicle subtype extension tables for the Asset group.
-- See ADR-0009 for the per-group + per-subtype storage strategy.
-- The assets.subtype enum (from 00003) already includes 'property' and
-- 'vehicle' so no change to the parent table is needed.

CREATE TABLE property_details (
    asset_id                 UUID            PRIMARY KEY REFERENCES assets(id),
    property_type            TEXT            NOT NULL
                                             CHECK (property_type IN ('house', 'apartment', 'land', 'commercial')),
    address                  TEXT,
    acquisition_date         DATE,
    acquisition_cost         DECIMAL(20, 4),
    annual_amortization_rate DECIMAL(20, 8)
);

CREATE TABLE vehicle_details (
    asset_id                 UUID            PRIMARY KEY REFERENCES assets(id),
    vehicle_type             TEXT            NOT NULL
                                             CHECK (vehicle_type IN ('car', 'motorcycle', 'other')),
    make                     TEXT,
    model                    TEXT,
    year                     INT,
    plate_number             TEXT,
    annual_depreciation_rate DECIMAL(20, 8)
);

-- +goose Down
DROP TABLE IF EXISTS vehicle_details;
DROP TABLE IF EXISTS property_details;
