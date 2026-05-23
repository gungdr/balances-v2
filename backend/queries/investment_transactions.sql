-- All transaction queries verify the parent investment belongs to the
-- requesting Household. Belt + suspenders on top of the application-layer
-- tenancy middleware: even if a handler forgets to filter, SQL will not
-- expose or mutate transactions from another Household. The transaction_type
-- → shape mapping is enforced at the column level by the table's CHECK
-- constraint and at the subtype level by the repository (per ADR-0003 +
-- ADR-0009 + ADR-0022).

-- name: CreateInvestmentTransaction :one
WITH owned_investment AS (
    SELECT i.id AS iid
    FROM investments i
    WHERE i.id = $1 AND i.household_id = sqlc.arg('household_id')::uuid AND i.deleted_at IS NULL
)
INSERT INTO investment_transactions (
    investment_id, transaction_type, transaction_date, currency, description,
    amount, quantity, price_per_unit,
    principal_amount, interest_amount,
    principal_disposition, interest_disposition,
    created_by, updated_by
)
SELECT owned_investment.iid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13
FROM owned_investment
RETURNING *;

-- name: ListInvestmentTransactionsForInvestment :many
SELECT t.*
FROM investment_transactions t
JOIN investments i ON i.id = t.investment_id
WHERE t.investment_id = $1
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND t.deleted_at IS NULL
ORDER BY t.transaction_date DESC, t.created_at DESC;

-- name: GetInvestmentTransactionByID :one
SELECT t.*
FROM investment_transactions t
JOIN investments i ON i.id = t.investment_id
WHERE t.id = $1
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- name: UpdateInvestmentTransaction :one
UPDATE investment_transactions t
SET transaction_date      = $3,
    currency              = $4,
    description           = $5,
    amount                = $6,
    quantity              = $7,
    price_per_unit        = $8,
    principal_amount      = $9,
    interest_amount       = $10,
    principal_disposition = $11,
    interest_disposition  = $12,
    updated_by            = $13,
    updated_at            = now()
FROM investments i
WHERE t.id = $1
  AND t.investment_id = i.id
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND t.deleted_at IS NULL
RETURNING t.*;

-- name: SoftDeleteInvestmentTransaction :execrows
UPDATE investment_transactions t
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
FROM investments i
WHERE t.id = $1
  AND t.investment_id = i.id
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND t.deleted_at IS NULL;
