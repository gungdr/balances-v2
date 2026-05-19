-- name: CreateVehicleDetails :one
INSERT INTO vehicle_details (
    asset_id, vehicle_type, make, model, year,
    plate_number, annual_depreciation_rate
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetVehicleDetailsByAssetID :one
SELECT *
FROM vehicle_details
WHERE asset_id = $1;

-- name: ListVehicleDetailsByAssetIDs :many
SELECT *
FROM vehicle_details
WHERE asset_id = ANY($1::uuid[]);

-- name: UpdateVehicleDetails :one
UPDATE vehicle_details
SET vehicle_type             = $2,
    make                     = $3,
    model                    = $4,
    year                     = $5,
    plate_number             = $6,
    annual_depreciation_rate = $7
WHERE asset_id = $1
RETURNING *;
