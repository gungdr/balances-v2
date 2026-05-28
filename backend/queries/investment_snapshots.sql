-- All snapshot queries verify the parent investment belongs to the requesting
-- Household. This is belt + suspenders on top of the application-layer
-- tenancy middleware: even if a handler forgets to filter, SQL will not
-- expose or mutate snapshots from another Household. The XOR shape
-- (quantity+price vs accrued_interest) is enforced at the column level by
-- the table's CHECK constraint and at the subtype level by the repository
-- (per ADR-0022).

-- name: CreateInvestmentSnapshot :one
WITH owned_investment AS (
    SELECT i.id AS iid
    FROM investments i
    WHERE i.id = $1 AND i.household_id = sqlc.arg('household_id')::uuid AND i.deleted_at IS NULL
)
INSERT INTO investment_snapshots (
    investment_id, year_month, amount, currency,
    quantity, price_per_unit, accrued_interest,
    as_of_date, description,
    created_by, updated_by
)
SELECT owned_investment.iid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10
FROM owned_investment
RETURNING *;

-- name: ListInvestmentSnapshotsForInvestment :many
SELECT s.*
FROM investment_snapshots s
JOIN investments i ON i.id = s.investment_id
WHERE s.investment_id = $1
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND s.deleted_at IS NULL
ORDER BY s.year_month DESC;

-- name: GetInvestmentSnapshotByID :one
SELECT s.*
FROM investment_snapshots s
JOIN investments i ON i.id = s.investment_id
WHERE s.id = $1
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- name: UpdateInvestmentSnapshot :one
UPDATE investment_snapshots s
SET amount           = $3,
    currency         = $4,
    quantity         = $5,
    price_per_unit   = $6,
    accrued_interest = $7,
    as_of_date       = $8,
    description      = $9,
    updated_by       = $10,
    updated_at       = now()
FROM investments i
WHERE s.id = $1
  AND s.investment_id = i.id
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND s.deleted_at IS NULL
RETURNING s.*;

-- Batch fetch of the most-recent snapshot per investment, for list views.
-- name: ListLatestInvestmentSnapshotsByInvestmentIDs :many
SELECT DISTINCT ON (investment_id) *
FROM investment_snapshots
WHERE investment_id = ANY($1::uuid[]) AND deleted_at IS NULL
ORDER BY investment_id, year_month DESC;

-- name: SoftDeleteInvestmentSnapshot :execrows
UPDATE investment_snapshots s
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
FROM investments i
WHERE s.id = $1
  AND s.investment_id = i.id
  AND i.household_id = $2
  AND i.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- UpsertInvestmentSnapshot inserts a snapshot or, when one already exists for
-- the (investment_id, year_month) pair, overwrites it (last-write-wins) — the
-- importer needs idempotent re-runs of a multi-year backfill. ON CONFLICT
-- targets the partial unique index, so its predicate (deleted_at IS NULL) is
-- repeated. The repo validates the value-column shape against the parent's
-- subtype before calling this; the DB CHECK is the final backstop.
-- created_by is only set on insert; updated_by always.
-- name: UpsertInvestmentSnapshot :one
WITH owned_investment AS (
    SELECT i.id AS iid
    FROM investments i
    WHERE i.id = $1 AND i.household_id = sqlc.arg('household_id')::uuid AND i.deleted_at IS NULL
)
INSERT INTO investment_snapshots (
    investment_id, year_month, amount, currency,
    quantity, price_per_unit, accrued_interest,
    as_of_date, description,
    created_by, updated_by
)
SELECT owned_investment.iid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10
FROM owned_investment
ON CONFLICT (investment_id, year_month) WHERE deleted_at IS NULL
DO UPDATE SET
    amount           = EXCLUDED.amount,
    currency         = EXCLUDED.currency,
    quantity         = EXCLUDED.quantity,
    price_per_unit   = EXCLUDED.price_per_unit,
    accrued_interest = EXCLUDED.accrued_interest,
    as_of_date       = EXCLUDED.as_of_date,
    description      = EXCLUDED.description,
    updated_by       = EXCLUDED.updated_by,
    updated_at       = now()
RETURNING *;
