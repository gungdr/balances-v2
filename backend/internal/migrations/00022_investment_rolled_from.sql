-- +goose Up
-- M6 / issue #29 — link a rolled-over deposit back to the position it succeeded.
--
-- When a matured TD's principal/interest rolls into a fresh deposit, the new
-- investment records the source it grew out of. The matured TD's detail screen
-- uses the back-reference to suppress its "Create rollover deposit" callout once
-- a successor exists — otherwise it nags the user to create a deposit that
-- already does (issue #29).
--
-- Lives on the shared `investments` table (per ADR-0022: data that could apply
-- across subtypes sits on the parent row; mirrors the risk_profile precedent in
-- migration 00018). Self-referential FK, nullable — only rolled-over successors
-- carry it. Set today only by the TD rollover helper; hand-created successors
-- stay unlinked (issue #29 accepted scope). Also seeds a future R0→R1→R2
-- rollover-chain view.

ALTER TABLE investments
    ADD COLUMN rolled_from_investment_id uuid
        REFERENCES investments (id);

-- +goose Down
ALTER TABLE investments DROP COLUMN IF EXISTS rolled_from_investment_id;
