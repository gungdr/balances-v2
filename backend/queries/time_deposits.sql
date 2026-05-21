-- name: CreateTimeDepositDetails :one
INSERT INTO time_deposit_details (
    investment_id, bank_name, principal, interest_rate,
    term_months, placement_date, maturity_date, rollover_policy
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: GetTimeDepositDetailsByInvestmentID :one
SELECT *
FROM time_deposit_details
WHERE investment_id = $1;

-- name: ListTimeDepositDetailsByInvestmentIDs :many
SELECT *
FROM time_deposit_details
WHERE investment_id = ANY($1::uuid[]);

-- name: UpdateTimeDepositDetails :one
UPDATE time_deposit_details
SET bank_name        = $2,
    principal        = $3,
    interest_rate    = $4,
    term_months      = $5,
    placement_date   = $6,
    maturity_date    = $7,
    rollover_policy  = $8
WHERE investment_id = $1
RETURNING *;
