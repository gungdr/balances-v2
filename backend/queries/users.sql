-- name: GetUserByID :one
SELECT *
FROM users
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetUserByGoogleSub :one
SELECT *
FROM users
WHERE google_sub = $1 AND deleted_at IS NULL;

-- name: CreateUser :one
INSERT INTO users (
    household_id, display_name, email, google_sub, locale, time_zone, created_by, updated_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $7
)
RETURNING *;

-- name: ListUsersByHousehold :many
SELECT *
FROM users
WHERE household_id = $1
  AND deleted_at IS NULL
ORDER BY display_name ASC;

-- name: UpdateUserNickname :one
-- Self-attributed: a user updates only their own nickname (id = updated_by).
-- nickname NULL clears it; the length CHECK guards 1..32 chars when set.
UPDATE users
SET nickname   = $2,
    updated_by = $1,
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;
