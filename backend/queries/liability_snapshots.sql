-- All snapshot queries verify the parent liability belongs to the requesting
-- Household. This is belt + suspenders on top of the application-layer
-- tenancy middleware: even if a handler forgets to filter, SQL will not
-- expose or mutate snapshots from another Household.

-- name: CreateLiabilitySnapshot :one
WITH owned_liability AS (
    SELECT l.id AS lid
    FROM liabilities l
    WHERE l.id = $1 AND l.household_id = sqlc.arg('household_id')::uuid AND l.deleted_at IS NULL
)
INSERT INTO liability_snapshots (
    liability_id, year_month, amount, currency, as_of_date, description,
    created_by, updated_by
)
SELECT owned_liability.lid, $2, $3, $4, $5, $6, $7, $7
FROM owned_liability
RETURNING *;

-- name: ListLiabilitySnapshotsForLiability :many
SELECT s.*
FROM liability_snapshots s
JOIN liabilities l ON l.id = s.liability_id
WHERE s.liability_id = $1
  AND l.household_id = $2
  AND l.deleted_at IS NULL
  AND s.deleted_at IS NULL
ORDER BY s.year_month DESC;

-- name: GetLiabilitySnapshotByID :one
SELECT s.*
FROM liability_snapshots s
JOIN liabilities l ON l.id = s.liability_id
WHERE s.id = $1
  AND l.household_id = $2
  AND l.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- name: UpdateLiabilitySnapshot :one
UPDATE liability_snapshots s
SET amount      = $3,
    currency    = $4,
    as_of_date  = $5,
    description = $6,
    updated_by  = $7,
    updated_at  = now()
FROM liabilities l
WHERE s.id = $1
  AND s.liability_id = l.id
  AND l.household_id = $2
  AND l.deleted_at IS NULL
  AND s.deleted_at IS NULL
RETURNING s.*;

-- Batch fetch of the most-recent snapshot per liability, for list views.
-- name: ListLatestLiabilitySnapshotsByLiabilityIDs :many
SELECT DISTINCT ON (liability_id) *
FROM liability_snapshots
WHERE liability_id = ANY($1::uuid[]) AND deleted_at IS NULL
ORDER BY liability_id, year_month DESC;

-- name: SoftDeleteLiabilitySnapshot :execrows
UPDATE liability_snapshots s
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
FROM liabilities l
WHERE s.id = $1
  AND s.liability_id = l.id
  AND l.household_id = $2
  AND l.deleted_at IS NULL
  AND s.deleted_at IS NULL;
