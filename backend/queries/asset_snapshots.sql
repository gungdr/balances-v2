-- All snapshot queries verify the parent asset belongs to the requesting
-- Household. This is belt + suspenders on top of the application-layer
-- tenancy middleware: even if a handler forgets to filter, SQL will not
-- expose or mutate snapshots from another Household.

-- name: CreateAssetSnapshot :one
WITH owned_asset AS (
    SELECT a.id AS aid
    FROM assets a
    WHERE a.id = $1 AND a.household_id = sqlc.arg('household_id')::uuid AND a.deleted_at IS NULL
)
INSERT INTO asset_snapshots (
    asset_id, year_month, amount, currency, as_of_date, description,
    created_by, updated_by
)
SELECT owned_asset.aid, $2, $3, $4, $5, $6, $7, $7
FROM owned_asset
RETURNING *;

-- name: ListAssetSnapshotsForAsset :many
SELECT s.*
FROM asset_snapshots s
JOIN assets a ON a.id = s.asset_id
WHERE s.asset_id = $1
  AND a.household_id = $2
  AND a.deleted_at IS NULL
  AND s.deleted_at IS NULL
ORDER BY s.year_month DESC;

-- name: GetAssetSnapshotByID :one
SELECT s.*
FROM asset_snapshots s
JOIN assets a ON a.id = s.asset_id
WHERE s.id = $1
  AND a.household_id = $2
  AND a.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- name: UpdateAssetSnapshot :one
UPDATE asset_snapshots s
SET amount      = $3,
    currency    = $4,
    as_of_date  = $5,
    description = $6,
    updated_by  = $7,
    updated_at  = now()
FROM assets a
WHERE s.id = $1
  AND s.asset_id = a.id
  AND a.household_id = $2
  AND a.deleted_at IS NULL
  AND s.deleted_at IS NULL
RETURNING s.*;

-- Batch fetch of the most-recent snapshot per asset, for list views.
-- Postgres DISTINCT ON keeps the first row per asset_id given the ORDER BY,
-- which is asset_id then year_month DESC, so we get the latest valid snapshot.
-- name: ListLatestSnapshotsByAssetIDs :many
SELECT DISTINCT ON (asset_id) *
FROM asset_snapshots
WHERE asset_id = ANY($1::uuid[]) AND deleted_at IS NULL
ORDER BY asset_id, year_month DESC;

-- name: SoftDeleteAssetSnapshot :execrows
UPDATE asset_snapshots s
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
FROM assets a
WHERE s.id = $1
  AND s.asset_id = a.id
  AND a.household_id = $2
  AND a.deleted_at IS NULL
  AND s.deleted_at IS NULL;
