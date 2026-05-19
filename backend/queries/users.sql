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
