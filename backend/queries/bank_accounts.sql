-- name: CreateBankAccountDetails :one
INSERT INTO bank_account_details (
    asset_id, bank_name, account_number, account_type
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetBankAccountDetailsByAssetID :one
SELECT *
FROM bank_account_details
WHERE asset_id = $1;

-- Batch fetch — used to populate details for a list of assets in one query
-- (avoids N+1 lookups when listing bank accounts for a household).
-- name: ListBankAccountDetailsByAssetIDs :many
SELECT *
FROM bank_account_details
WHERE asset_id = ANY($1::uuid[]);

-- name: UpdateBankAccountDetails :one
UPDATE bank_account_details
SET bank_name      = $2,
    account_number = $3,
    account_type   = $4
WHERE asset_id = $1
RETURNING *;
