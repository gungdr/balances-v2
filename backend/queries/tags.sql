-- name: CreateTag :one
INSERT INTO tags (
    household_id, name, color, created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $4
)
RETURNING *;

-- name: GetTagByID :one
SELECT *
FROM tags
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- name: ListTagsByHousehold :many
SELECT *
FROM tags
WHERE household_id = $1 AND deleted_at IS NULL
ORDER BY lower(name);

-- name: UpdateTag :one
UPDATE tags
SET name       = $3,
    color      = $4,
    updated_by = $5,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTag :execrows
UPDATE tags
SET deleted_at = now(),
    updated_by = $3,
    updated_at = now()
WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL;

-- ----- assignment (one per shared Position table) -------------------------
-- tag_id ($1) is nullable: a NULL unassigns. The caller validates the Tag's
-- household ownership before these run; the household_id filter here is the
-- belt-and-suspenders Position-side guard (ADR-0028 tenancy).

-- name: AssignAssetTag :execrows
UPDATE assets
SET tag_id = $1, updated_by = $4, updated_at = now()
WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL;

-- name: AssignLiabilityTag :execrows
UPDATE liabilities
SET tag_id = $1, updated_by = $4, updated_at = now()
WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL;

-- name: AssignReceivableTag :execrows
UPDATE receivables
SET tag_id = $1, updated_by = $4, updated_at = now()
WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL;

-- name: AssignInvestmentTag :execrows
UPDATE investments
SET tag_id = $1, updated_by = $4, updated_at = now()
WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL;

-- ----- unassign-on-delete (clear references so the Position reads Untagged) -
-- Soft-deleting a Tag clears it everywhere in the same transaction, so no
-- Position is left pointing at a dead Tag (ADR-0028).

-- name: ClearAssetTag :exec
UPDATE assets SET tag_id = NULL WHERE tag_id = $1 AND household_id = $2;

-- name: ClearLiabilityTag :exec
UPDATE liabilities SET tag_id = NULL WHERE tag_id = $1 AND household_id = $2;

-- name: ClearReceivableTag :exec
UPDATE receivables SET tag_id = NULL WHERE tag_id = $1 AND household_id = $2;

-- name: ClearInvestmentTag :exec
UPDATE investments SET tag_id = NULL WHERE tag_id = $1 AND household_id = $2;

-- ----- breakdown report ----------------------------------------------------
-- Per (tag_id, group, currency): the summed most-recent-snapshot value of
-- every contributing Position. tag_id NULL = the Untagged bucket. A Position
-- contributes its latest snapshot with year_month <= the current month, and
-- only while active or terminated in/after the current month (the net-worth
-- carry-forward + termination rule, CONTEXT "Net Worth"). Liabilities ride
-- back under grp='liability' so the report layer can show them as their own
-- (negative) slice rather than netting them into a tag's assets.

-- name: TagBreakdownByHousehold :many
SELECT tag_id, grp, currency, total FROM (
    SELECT a.tag_id AS tag_id, 'asset'::text AS grp, ls.currency AS currency,
           COALESCE(SUM(ls.amount), 0)::numeric AS total
    FROM assets a
    JOIN LATERAL (
        SELECT amount, currency FROM asset_snapshots
        WHERE asset_id = a.id AND deleted_at IS NULL
          AND year_month <= date_trunc('month', CURRENT_DATE)::date
        ORDER BY year_month DESC LIMIT 1
    ) ls ON true
    WHERE a.household_id = $1 AND a.deleted_at IS NULL
      AND (a.terminated_at IS NULL OR a.terminated_at >= date_trunc('month', CURRENT_DATE)::date)
    GROUP BY a.tag_id, ls.currency

    UNION ALL

    SELECT l.tag_id, 'liability'::text, ls.currency,
           COALESCE(SUM(ls.amount), 0)::numeric
    FROM liabilities l
    JOIN LATERAL (
        SELECT amount, currency FROM liability_snapshots
        WHERE liability_id = l.id AND deleted_at IS NULL
          AND year_month <= date_trunc('month', CURRENT_DATE)::date
        ORDER BY year_month DESC LIMIT 1
    ) ls ON true
    WHERE l.household_id = $1 AND l.deleted_at IS NULL
      AND (l.terminated_at IS NULL OR l.terminated_at >= date_trunc('month', CURRENT_DATE)::date)
    GROUP BY l.tag_id, ls.currency

    UNION ALL

    SELECT r.tag_id, 'receivable'::text, ls.currency,
           COALESCE(SUM(ls.amount), 0)::numeric
    FROM receivables r
    JOIN LATERAL (
        SELECT amount, currency FROM receivable_snapshots
        WHERE receivable_id = r.id AND deleted_at IS NULL
          AND year_month <= date_trunc('month', CURRENT_DATE)::date
        ORDER BY year_month DESC LIMIT 1
    ) ls ON true
    WHERE r.household_id = $1 AND r.deleted_at IS NULL
      AND (r.terminated_at IS NULL OR r.terminated_at >= date_trunc('month', CURRENT_DATE)::date)
    GROUP BY r.tag_id, ls.currency

    UNION ALL

    SELECT i.tag_id, 'investment'::text, ls.currency,
           COALESCE(SUM(ls.amount), 0)::numeric
    FROM investments i
    JOIN LATERAL (
        SELECT amount, currency FROM investment_snapshots
        WHERE investment_id = i.id AND deleted_at IS NULL
          AND year_month <= date_trunc('month', CURRENT_DATE)::date
        ORDER BY year_month DESC LIMIT 1
    ) ls ON true
    WHERE i.household_id = $1 AND i.deleted_at IS NULL
      AND (i.terminated_at IS NULL OR i.terminated_at >= date_trunc('month', CURRENT_DATE)::date)
    GROUP BY i.tag_id, ls.currency
) breakdown
ORDER BY grp, currency;
