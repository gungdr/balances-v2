-- name: CreateMutualFundDetails :one
INSERT INTO mutual_fund_details (
    investment_id, fund_code, fund_manager
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetMutualFundDetailsByInvestmentID :one
SELECT *
FROM mutual_fund_details
WHERE investment_id = $1;

-- name: ListMutualFundDetailsByInvestmentIDs :many
SELECT *
FROM mutual_fund_details
WHERE investment_id = ANY($1::uuid[]);

-- name: UpdateMutualFundDetails :one
UPDATE mutual_fund_details
SET fund_code    = $2,
    fund_manager = $3
WHERE investment_id = $1
RETURNING *;
