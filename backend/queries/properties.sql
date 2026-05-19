-- name: CreatePropertyDetails :one
INSERT INTO property_details (
    asset_id, property_type, address,
    acquisition_date, acquisition_cost, annual_amortization_rate
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetPropertyDetailsByAssetID :one
SELECT *
FROM property_details
WHERE asset_id = $1;

-- Batch fetch — used to populate details for a list of assets in one query
-- (avoids N+1 lookups when listing properties for a household).
-- name: ListPropertyDetailsByAssetIDs :many
SELECT *
FROM property_details
WHERE asset_id = ANY($1::uuid[]);

-- name: UpdatePropertyDetails :one
UPDATE property_details
SET property_type            = $2,
    address                  = $3,
    acquisition_date         = $4,
    acquisition_cost         = $5,
    annual_amortization_rate = $6
WHERE asset_id = $1
RETURNING *;
