-- name: CreateIncome :one
INSERT INTO income (
    household_id, date, amount, currency, category, description,
    ownership_type, sole_owner_user_id,
    created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
)
RETURNING *;

-- name: GetIncomeByID :one
SELECT *
FROM income
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListIncomeByHousehold :many
SELECT *
FROM income
WHERE household_id = $1
  AND deleted_at IS NULL
ORDER BY date DESC, created_at DESC;

-- name: UpdateIncome :one
UPDATE income
SET date               = $3,
    amount             = $4,
    currency           = $5,
    category           = $6,
    description        = $7,
    ownership_type     = $8,
    sole_owner_user_id = $9,
    updated_by         = $10,
    updated_at         = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteIncome :execrows
UPDATE income
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;
