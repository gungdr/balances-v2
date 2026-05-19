-- name: CreateAsset :one
INSERT INTO assets (
    household_id, display_name, description, subtype,
    ownership_type, sole_owner_user_id, native_currency,
    created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $8
)
RETURNING *;

-- name: GetAssetByID :one
SELECT *
FROM assets
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListAssetsByHousehold :many
SELECT *
FROM assets
WHERE household_id = $1
  AND (sqlc.narg('subtype')::text IS NULL OR subtype = sqlc.narg('subtype')::text)
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateAsset :one
UPDATE assets
SET display_name = $3,
    description  = $4,
    updated_by   = $5,
    updated_at   = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteAsset :execrows
UPDATE assets
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;
