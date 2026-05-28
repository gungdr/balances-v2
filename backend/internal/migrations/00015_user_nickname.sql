-- +goose Up
-- M6 — self-set short nickname for compact owner labels.
--
-- display_name (from Google) is verbose in the Ownership column and the
-- sole-owner picker. A user may set a short nickname for themselves; read sites
-- prefer `nickname ?? display_name` but display_name stays the source of truth
-- on the API shape (reports / audit). Self-attributed, not per-household —
-- multi-household is out of scope for v1 (ADR-0010). Nullable; the app stores
-- NULL (not '') when cleared. Capped at 32 chars to keep labels compact.
ALTER TABLE users ADD COLUMN nickname TEXT
    CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 32);

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS nickname;
