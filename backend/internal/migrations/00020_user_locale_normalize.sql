-- +goose Up
-- users.locale has existed since 00002 as a free-form BCP47 string with a
-- default of 'id-ID' and no CHECK. ADR-0026 makes it the source of truth for
-- the UI language; this migration pins the allowed set to the BCP47 forms
-- the app currently supports — 'en-GB' and 'id-ID' — and leaves the column
-- type, default, and existing values untouched. Future regional variants
-- expand the CHECK only.
--
-- en-GB (not en-US) is the canonical English so the day-first date format
-- the app's copy already follows ("15 May 2024") flows naturally through
-- Intl. en-US would render "May 15, 2024" — see lib/format.ts.
--
-- The 2-letter catalog dirs (public/locales/en, public/locales/id) are
-- resolved at runtime by i18next's `load: 'languageOnly'` setting, so
-- 'id-ID' loads from /locales/id/<ns>.json and 'en-GB' from /locales/en/...
-- DB stays BCP47; catalogs stay 2-letter.

ALTER TABLE users
    ADD CONSTRAINT users_locale_check CHECK (locale IN ('en-GB', 'id-ID'));

-- +goose Down
ALTER TABLE users
    DROP CONSTRAINT users_locale_check;
