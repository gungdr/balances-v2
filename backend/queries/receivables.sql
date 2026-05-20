-- name: CreateReceivable :one
INSERT INTO receivables (
    household_id, display_name, description,
    ownership_type, sole_owner_user_id, native_currency,
    counterparty_name, due_date,
    created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
)
RETURNING *;

-- name: GetReceivableByID :one
SELECT *
FROM receivables
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListReceivablesByHousehold :many
SELECT *
FROM receivables
WHERE household_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateReceivable :one
UPDATE receivables
SET display_name      = $3,
    description       = $4,
    counterparty_name = $5,
    due_date          = $6,
    updated_by        = $7,
    updated_at        = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteReceivable :execrows
UPDATE receivables
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;
