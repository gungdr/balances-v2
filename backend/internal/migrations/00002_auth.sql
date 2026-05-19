-- +goose Up
-- Auth schema: households, users, sessions, household_invitations.
-- See ADR-0004 (Household scope and Sole/Joint ownership),
--     ADR-0005 (Single-DB row-level multi-tenancy),
--     ADR-0007 (Soft-delete cross-cutting),
--     ADR-0010 (User and Household entity shape),
--     ADR-0017 (Google OAuth, server-side sessions, email-token invitations).
--
-- gen_random_uuid() is built into Postgres 13+; no extension required.

-- Households: the unit of access and aggregation.
-- created_by / updated_by are nullable to support the founder case
-- (the first User can't have an actor reference because no User exists yet).
CREATE TABLE households (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name       TEXT         NOT NULL,
    reporting_currency TEXT         NOT NULL DEFAULT 'IDR',
    created_by         UUID,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         UUID,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);

-- Users: members of exactly one Household.
-- google_sub is the immutable identity key (email is mutable display/contact).
-- Self-referential created_by / updated_by are nullable for the founder.
CREATE TABLE users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID         NOT NULL REFERENCES households(id),
    display_name TEXT         NOT NULL,
    email        TEXT         NOT NULL,
    google_sub   TEXT         NOT NULL,
    locale       TEXT         NOT NULL DEFAULT 'id-ID',
    time_zone    TEXT         NOT NULL DEFAULT 'Asia/Jakarta',
    created_by   UUID         REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   UUID         REFERENCES users(id),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

-- Soft-delete-aware uniqueness via partial indexes (per ADR-0007).
CREATE UNIQUE INDEX users_google_sub_idx ON users(google_sub) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_idx      ON users(email)      WHERE deleted_at IS NULL;
CREATE INDEX        users_household_id_idx ON users(household_id) WHERE deleted_at IS NULL;

-- Close the cycle: households.created_by / updated_by reference users.
ALTER TABLE households ADD CONSTRAINT households_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE households ADD CONSTRAINT households_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);

-- Sessions: opaque token in id (the cookie value), 30-day sliding TTL per ADR-0017.
-- No audit columns or soft-delete — sessions are ephemeral, hard-deleted on logout/expiry.
CREATE TABLE sessions (
    id           TEXT         PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_agent   TEXT
);

CREATE INDEX sessions_user_id_idx    ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

-- Household invitations: single-use, time-limited tokens for inviting a second User.
-- Email match is verified at acceptance to prevent link-forwarding misuse.
CREATE TABLE household_invitations (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id  UUID         NOT NULL REFERENCES households(id),
    invited_email TEXT         NOT NULL,
    token         TEXT         NOT NULL UNIQUE,
    created_by    UUID         NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ  NOT NULL,
    used_at       TIMESTAMPTZ
);

CREATE INDEX household_invitations_household_id_idx
    ON household_invitations(household_id) WHERE used_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS household_invitations;
DROP TABLE IF EXISTS sessions;
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_updated_by_fkey;
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_created_by_fkey;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS households;
