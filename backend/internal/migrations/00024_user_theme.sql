-- +goose Up
-- M6 — Per-user UI theme (issue #33). Mirrors users.locale (00002 + the 00020
-- CHECK): a free-form-but-CHECKed TEXT column the user sets in Settings, the
-- source of truth for light vs dark across devices.
--
-- Default 'dark' matches the dark-only status quo the app shipped with
-- (index.html previously hardcoded <html class="dark">). The first-login bias
-- toward the browser's prefers-color-scheme is handled client-side by the
-- theme reconcile hook — exactly as useLocaleReconcile biases toward
-- navigator.language — so the column needs no nullable "unset" state. Future
-- themes (e.g. a high-contrast variant) expand the CHECK only.

ALTER TABLE users
    ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark'
        CHECK (theme IN ('light', 'dark'));

-- +goose Down
ALTER TABLE users
    DROP COLUMN theme;
