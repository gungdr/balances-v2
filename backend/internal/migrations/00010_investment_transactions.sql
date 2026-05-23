-- +goose Up
-- M4.4 — Investment transactions ledger.
--
-- Single polymorphic table for all seven transaction types
-- (Buy / Sell / Coupon / Dividend / Distribution / Fee / Maturity).
-- A type-driven CHECK constraint enforces shape integrity at the DB level;
-- the repo enforces the subtype→type compatibility matrix (Postgres CHECK
-- can't reference another table — same pattern as investment_snapshots).
--
-- Shape map (column → which types use it):
--   amount                : Buy/Sell (cash total), Coupon/Dividend/Distribution
--                           (cash received), Fee (cash charged)
--   quantity              : Buy/Sell (required), Fee (optional, for unit-
--                           deducting fees)
--   price_per_unit        : Buy/Sell (required), Fee (paired with quantity)
--   principal_amount      : Maturity only
--   interest_amount       : Maturity only
--   principal_disposition : Maturity only (rolled_to_new | cash_out)
--   interest_disposition  : Maturity only (rolled_to_new | cash_out)
--
-- Per ADR-0003, cash events on this ledger do not auto-update bank-account
-- snapshots. The user reads cash off the bank statement at the next
-- month-end. This table is income / cost-basis / yield tracking only.
--
-- See ADR-0003  (Investment cash events decoupled from bank balances).
--     ADR-0009  (Maturity transaction extension — disposition fields).
--     ADR-0011  (DECIMAL precision).
--     CONTEXT.md (transaction definitions; reconciliation identity for
--                quantity-deducting fees).
--
-- TimeDeposit's only valid transaction type is Maturity — its initial
-- placement already lives in time_deposit_details.principal via the Create
-- dialog. Subtype→type guard enforced in repo.

CREATE TABLE investment_transactions (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id         UUID            NOT NULL REFERENCES investments(id),
    transaction_type      TEXT            NOT NULL
                                          CHECK (transaction_type IN (
                                              'buy', 'sell',
                                              'coupon', 'dividend', 'distribution',
                                              'fee',
                                              'maturity'
                                          )),
    transaction_date      DATE            NOT NULL,
    currency              TEXT            NOT NULL,
    description           TEXT,

    -- Shared shape columns; meaning varies by transaction_type.
    amount                DECIMAL(20, 4),
    quantity              DECIMAL(20, 8),
    price_per_unit        DECIMAL(20, 4),

    -- Maturity-only columns.
    principal_amount      DECIMAL(20, 4),
    interest_amount       DECIMAL(20, 4),
    principal_disposition TEXT            CHECK (principal_disposition IN ('rolled_to_new', 'cash_out')),
    interest_disposition  TEXT            CHECK (interest_disposition IN ('rolled_to_new', 'cash_out')),

    created_by            UUID            REFERENCES users(id),
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_by            UUID            REFERENCES users(id),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ,

    CONSTRAINT investment_transaction_shape CHECK (
        CASE
            WHEN transaction_type IN ('buy', 'sell') THEN
                amount IS NOT NULL AND quantity IS NOT NULL AND price_per_unit IS NOT NULL
                AND principal_amount IS NULL AND interest_amount IS NULL
                AND principal_disposition IS NULL AND interest_disposition IS NULL
            WHEN transaction_type IN ('coupon', 'dividend', 'distribution') THEN
                amount IS NOT NULL
                AND quantity IS NULL AND price_per_unit IS NULL
                AND principal_amount IS NULL AND interest_amount IS NULL
                AND principal_disposition IS NULL AND interest_disposition IS NULL
            WHEN transaction_type = 'fee' THEN
                amount IS NOT NULL
                AND ((quantity IS NULL AND price_per_unit IS NULL)
                     OR (quantity IS NOT NULL AND price_per_unit IS NOT NULL))
                AND principal_amount IS NULL AND interest_amount IS NULL
                AND principal_disposition IS NULL AND interest_disposition IS NULL
            WHEN transaction_type = 'maturity' THEN
                principal_amount IS NOT NULL AND interest_amount IS NOT NULL
                AND principal_disposition IS NOT NULL AND interest_disposition IS NOT NULL
                AND amount IS NULL AND quantity IS NULL AND price_per_unit IS NULL
            ELSE FALSE
        END
    )
);

CREATE INDEX investment_transactions_investment_id_idx
    ON investment_transactions(investment_id) WHERE deleted_at IS NULL;

CREATE INDEX investment_transactions_investment_date_idx
    ON investment_transactions(investment_id, transaction_date DESC) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS investment_transactions;
