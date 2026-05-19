-- name: CreateInvitation :one
INSERT INTO household_invitations (
    household_id, invited_email, token, created_by, expires_at
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetInvitationByToken :one
SELECT *
FROM household_invitations
WHERE token = $1;

-- name: MarkInvitationUsed :exec
UPDATE household_invitations
SET used_at = now()
WHERE id = $1;
