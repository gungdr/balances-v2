-- name: GetHouseholdByID :one
SELECT *
FROM households
WHERE id = $1 AND deleted_at IS NULL;

-- name: CreateHousehold :one
INSERT INTO households (
    display_name, reporting_currency
) VALUES (
    $1, $2
)
RETURNING *;
