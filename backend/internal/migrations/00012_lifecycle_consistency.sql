-- +goose Up
-- Lifecycle consistency: a Position is terminated iff it carries a termination
-- date. M4.6 makes status/terminated_at editable through a dedicated terminate
-- action; this constraint keeps net-worth inclusion (ADR-0009: a Position
-- counts toward month M only if `terminated_at IS NULL OR terminated_at >=
-- end_of_month(M)`) unambiguous — a non-active Position always has a date, and
-- an active one never does.
--
-- Biconditional, not two one-way checks: (status='active') = (terminated_at IS
-- NULL). All existing rows are active with NULL terminated_at (column defaults),
-- so the constraint is satisfied at apply time with no data backfill.
--
-- termination_note stays unconstrained — free-text, optional in every state.

ALTER TABLE assets ADD CONSTRAINT assets_lifecycle_chk
    CHECK ((status = 'active') = (terminated_at IS NULL));

ALTER TABLE liabilities ADD CONSTRAINT liabilities_lifecycle_chk
    CHECK ((status = 'active') = (terminated_at IS NULL));

ALTER TABLE receivables ADD CONSTRAINT receivables_lifecycle_chk
    CHECK ((status = 'active') = (terminated_at IS NULL));

ALTER TABLE investments ADD CONSTRAINT investments_lifecycle_chk
    CHECK ((status = 'active') = (terminated_at IS NULL));

-- +goose Down
ALTER TABLE assets DROP CONSTRAINT assets_lifecycle_chk;
ALTER TABLE liabilities DROP CONSTRAINT liabilities_lifecycle_chk;
ALTER TABLE receivables DROP CONSTRAINT receivables_lifecycle_chk;
ALTER TABLE investments DROP CONSTRAINT investments_lifecycle_chk;
