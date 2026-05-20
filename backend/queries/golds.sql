-- name: CreateGoldDetails :one
INSERT INTO gold_details (
    investment_id, form, purity
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetGoldDetailsByInvestmentID :one
SELECT *
FROM gold_details
WHERE investment_id = $1;

-- name: ListGoldDetailsByInvestmentIDs :many
SELECT *
FROM gold_details
WHERE investment_id = ANY($1::uuid[]);

-- name: UpdateGoldDetails :one
UPDATE gold_details
SET form   = $2,
    purity = $3
WHERE investment_id = $1
RETURNING *;
