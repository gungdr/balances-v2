-- +goose Up
-- M6 — cache the Google account profile-picture URL for the header avatar.
-- Sourced from the OIDC `picture` claim and refreshed on every login (see
-- handleCallback), so it backfills users created before this column existed on
-- their next sign-in and tracks later photo changes. Nullable: Google may omit
-- a picture, and pre-existing rows start NULL. Presentation only — display_name
-- / nickname remain the textual identity and source of truth on the API shape.
ALTER TABLE users ADD COLUMN picture_url TEXT;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS picture_url;
