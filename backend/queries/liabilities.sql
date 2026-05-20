-- name: CreateLiability :one
INSERT INTO liabilities (
    household_id, display_name, description, subtype,
    ownership_type, sole_owner_user_id, native_currency,
    counterparty_name, principal, interest_rate,
    term_months, start_date, maturity_date,
    created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14
)
RETURNING *;

-- name: GetLiabilityByID :one
SELECT *
FROM liabilities
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListLiabilitiesByHousehold :many
SELECT *
FROM liabilities
WHERE household_id = $1
  AND (sqlc.narg('subtype')::text IS NULL OR subtype = sqlc.narg('subtype')::text)
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateLiability :one
UPDATE liabilities
SET display_name      = $3,
    description       = $4,
    counterparty_name = $5,
    principal         = $6,
    interest_rate     = $7,
    term_months       = $8,
    start_date        = $9,
    maturity_date     = $10,
    updated_by        = $11,
    updated_at        = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteLiability :execrows
UPDATE liabilities
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;
