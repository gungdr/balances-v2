-- +goose Up
-- M4.5 — Earned income tracking.
--
-- Flow events, not Positions. No subtype, no extension tables, no snapshots,
-- no transactions, no lifecycle (`status` / `terminated_at`). Each row is a
-- one-shot Income event with a closed-enum category and a free-text
-- `description` for sub-categorisation (e.g., "Base salary" vs "Per diem"
-- under category=salary).
--
-- Per ADR-0003 + ADR-0008, Income events do not auto-update bank-account
-- snapshots. The bank statement remains source of truth; Income exists to
-- feed the income-statement view in M5.
--
-- See ADR-0008  (Earned income tracking with derived returns and residual expenses).
--     ADR-0003  (Cash events decoupled from bank balances — same principle).
--     ADR-0011  (DECIMAL(20, 4) for amounts).
--     ADR-0004  (Sole/Joint ownership pattern, mirrored from positions).
--     ADR-0007  (Soft delete via `deleted_at`).
--
-- Category is mutable post-create — all categories share the same row shape,
-- so corrections are allowed (unlike investment_transactions.transaction_type,
-- which would invalidate the shape CHECK).

CREATE TABLE income (
    id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID            NOT NULL REFERENCES households(id),
    date               DATE            NOT NULL,
    amount             DECIMAL(20, 4)  NOT NULL CHECK (amount > 0),
    currency           TEXT            NOT NULL,
    category           TEXT            NOT NULL
                                       CHECK (category IN (
                                           'salary',
                                           'business_income',
                                           'rental_income',
                                           'gift',
                                           'tax_refund',
                                           'insurance_payout',
                                           'other'
                                       )),
    description        TEXT,
    ownership_type     TEXT            NOT NULL CHECK (ownership_type IN ('sole', 'joint')),
    sole_owner_user_id UUID            REFERENCES users(id),
    created_by         UUID            REFERENCES users(id),
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by         UUID            REFERENCES users(id),
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,

    CHECK ((ownership_type = 'sole') = (sole_owner_user_id IS NOT NULL))
);

CREATE INDEX income_household_date_idx
    ON income(household_id, date DESC) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS income;
