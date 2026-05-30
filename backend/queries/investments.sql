-- name: CreateInvestment :one
INSERT INTO investments (
    household_id, display_name, description, subtype,
    ownership_type, sole_owner_user_id, native_currency, risk_profile,
    created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
)
RETURNING *;

-- name: GetInvestmentByID :one
SELECT *
FROM investments
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListInvestmentsByHousehold :many
SELECT *
FROM investments
WHERE household_id = $1
  AND (sqlc.narg('subtype')::text IS NULL OR subtype = sqlc.narg('subtype')::text)
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateInvestment :one
UPDATE investments
SET display_name       = $3,
    description        = $4,
    ownership_type     = $5,
    sole_owner_user_id = $6,
    risk_profile       = $7,
    updated_by         = $8,
    updated_at         = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateInvestmentLifecycle :one
UPDATE investments
SET status           = $3,
    terminated_at    = $4,
    termination_note = $5,
    updated_by       = $6,
    updated_at       = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteInvestment :execrows
UPDATE investments
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;
