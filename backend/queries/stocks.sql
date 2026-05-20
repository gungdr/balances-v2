-- name: CreateStockDetails :one
INSERT INTO stock_details (
    investment_id, ticker, exchange
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetStockDetailsByInvestmentID :one
SELECT *
FROM stock_details
WHERE investment_id = $1;

-- Batch fetch — used to populate details for a list of investments in one
-- query (avoids N+1 lookups when listing stocks for a household).
-- name: ListStockDetailsByInvestmentIDs :many
SELECT *
FROM stock_details
WHERE investment_id = ANY($1::uuid[]);

-- name: UpdateStockDetails :one
UPDATE stock_details
SET ticker   = $2,
    exchange = $3
WHERE investment_id = $1
RETURNING *;
