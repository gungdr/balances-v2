package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// Position lifecycle (ADR-0009). Each group defines its own status enum; the
// DB CHECK on each core table enforces the same value set, and migration 00012
// enforces the status/terminated_at biconditional. The sets below let the repo
// reject an unknown status with a clean 400 before it reaches the DB (where a
// constraint violation would otherwise surface as a 500).
const (
	StatusActive = "active"
	// StatusMatured is the terminal status a Maturity transaction flips a Bond
	// or TimeDeposit to (ADR-0009). Named because the flip is automatic in
	// CreateInvestmentTransaction, not user-supplied.
	StatusMatured = "matured"
)

var (
	assetStatuses      = []string{StatusActive, "closed", "sold", "disposed"}
	liabilityStatuses  = []string{StatusActive, "paid_off", "forgiven", "written_off"}
	receivableStatuses = []string{StatusActive, "collected", "written_off"}
	investmentStatuses = []string{StatusActive, "sold", "matured"}
)

// LifecycleParams is the group-agnostic input for a lifecycle mutation. The
// terminate action is the same shape across all four groups; only the set of
// valid status values differs.
type LifecycleParams struct {
	Status          string
	TerminatedAt    *time.Time
	TerminationNote *string
}

// validatePositionLifecycle enforces, for any group: (a) status is one the
// group defines, and (b) the status/terminated_at biconditional — active means
// no termination date, any terminal status means a date is present. Returns
// ErrInvalidLifecycle (→ 400) on any violation.
func validatePositionLifecycle(allowed []string, p LifecycleParams) error {
	known := false
	for _, s := range allowed {
		if s == p.Status {
			known = true
			break
		}
	}
	if !known {
		return fmt.Errorf("%w: unknown status %q", ErrInvalidLifecycle, p.Status)
	}
	if p.Status == StatusActive && p.TerminatedAt != nil {
		return fmt.Errorf("%w: active position must not carry a termination date", ErrInvalidLifecycle)
	}
	if p.Status != StatusActive && p.TerminatedAt == nil {
		return fmt.Errorf("%w: %s position requires a termination date", ErrInvalidLifecycle, p.Status)
	}
	return nil
}

func (r *AssetRepo) UpdateAssetLifecycle(ctx context.Context, id uuid.UUID, p LifecycleParams) (*db.Asset, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validatePositionLifecycle(assetStatuses, p); err != nil {
		return nil, err
	}
	row, err := r.q.UpdateAssetLifecycle(ctx, db.UpdateAssetLifecycleParams{
		ID:              id,
		HouseholdID:     hid,
		Status:          p.Status,
		TerminatedAt:    p.TerminatedAt,
		TerminationNote: p.TerminationNote,
		UpdatedBy:       &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update asset lifecycle: %w", err)
	}
	return &row, nil
}

func (r *LiabilityRepo) UpdateLiabilityLifecycle(ctx context.Context, id uuid.UUID, p LifecycleParams) (*db.Liability, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validatePositionLifecycle(liabilityStatuses, p); err != nil {
		return nil, err
	}
	row, err := r.q.UpdateLiabilityLifecycle(ctx, db.UpdateLiabilityLifecycleParams{
		ID:              id,
		HouseholdID:     hid,
		Status:          p.Status,
		TerminatedAt:    p.TerminatedAt,
		TerminationNote: p.TerminationNote,
		UpdatedBy:       &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update liability lifecycle: %w", err)
	}
	return &row, nil
}

func (r *ReceivableRepo) UpdateReceivableLifecycle(ctx context.Context, id uuid.UUID, p LifecycleParams) (*db.Receivable, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validatePositionLifecycle(receivableStatuses, p); err != nil {
		return nil, err
	}
	row, err := r.q.UpdateReceivableLifecycle(ctx, db.UpdateReceivableLifecycleParams{
		ID:              id,
		HouseholdID:     hid,
		Status:          p.Status,
		TerminatedAt:    p.TerminatedAt,
		TerminationNote: p.TerminationNote,
		UpdatedBy:       &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update receivable lifecycle: %w", err)
	}
	return &row, nil
}

// UpdateInvestmentLifecycle is the only group whose lifecycle flip also writes
// snapshot data, because investments are the only group with cash-flow
// transactions feeding the derived return (ADR-0008). Terminating a position
// means it holds 0 at month-end — the proceeds left for the bank as Sell /
// Maturity cash_out. Without a truthful 0 close snapshot the return formula
// (Δvalue + cash_out − cash_in) double-counts the payout, the same bug #17
// introduced for Maturity and #25 removes at its source. One coherent rule:
// terminate ⇒ 0-value close snapshot; proceeds are transactions. The
// correction-affordance inverse (un-terminate back to active, ADR-0009) drops
// the close snapshot so the reactivated position doesn't read 0 forever.
func (r *InvestmentRepo) UpdateInvestmentLifecycle(ctx context.Context, id uuid.UUID, p LifecycleParams) (*db.Investment, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validatePositionLifecycle(investmentStatuses, p); err != nil {
		return nil, err
	}

	// Pre-read for the subtype (close-snapshot shape) and the prior
	// terminated_at (the month whose close snapshot an un-terminate clears).
	inv, err := r.q.GetInvestmentByID(ctx, db.GetInvestmentByIDParams{ID: id, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get investment for lifecycle: %w", err)
	}
	priorTerminatedAt := inv.TerminatedAt

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	row, err := qtx.UpdateInvestmentLifecycle(ctx, db.UpdateInvestmentLifecycleParams{
		ID:              id,
		HouseholdID:     hid,
		Status:          p.Status,
		TerminatedAt:    p.TerminatedAt,
		TerminationNote: p.TerminationNote,
		UpdatedBy:       &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update investment lifecycle: %w", err)
	}

	switch {
	case p.Status != StatusActive && p.TerminatedAt != nil:
		// Terminal flip: upsert the truthful 0 close snapshot at the
		// termination month, winning over any value the user recorded that
		// month (month-end truth is a liquidated position). A Maturity
		// transaction takes its own path (it writes the close inside the same
		// tx as the txn insert), so this covers Sell + manual terminate.
		if err := upsertCloseSnapshot(ctx, qtx, id, inv.Subtype, inv.NativeCurrency, *p.TerminatedAt, user, hid); err != nil {
			return nil, err
		}
	case p.Status == StatusActive && priorTerminatedAt != nil:
		// Un-terminate correction: drop the close snapshot we wrote at the
		// prior termination month so the now-active position carries forward
		// its last real value, not 0.
		if err := deleteCloseSnapshot(ctx, qtx, id, *priorTerminatedAt, user, hid); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}
	return &row, nil
}

// upsertCloseSnapshot writes a 0-value snapshot for the termination month in the
// shape the subtype's CHECK constraint demands (quantity/price for
// stock/mutual_fund/gold; accrued_interest for bond/time_deposit — both 0).
func upsertCloseSnapshot(ctx context.Context, qtx *db.Queries, id uuid.UUID, subtype, currency string, terminatedAt time.Time, user, hid uuid.UUID) error {
	zero := decimal.Zero
	params := db.UpsertInvestmentSnapshotParams{
		ID:          id,
		YearMonth:   time.Date(terminatedAt.Year(), terminatedAt.Month(), 1, 0, 0, 0, 0, time.UTC),
		Amount:      zero,
		Currency:    currency,
		AsOfDate:    &terminatedAt,
		CreatedBy:   &user,
		HouseholdID: hid,
	}
	switch subtype {
	case "bond", "time_deposit":
		params.AccruedInterest = &zero
	default: // stock, mutual_fund, gold
		params.Quantity = &zero
		params.PricePerUnit = &zero
	}
	if _, err := qtx.UpsertInvestmentSnapshot(ctx, params); err != nil {
		return fmt.Errorf("close snapshot on termination: %w", err)
	}
	return nil
}

// deleteCloseSnapshot soft-deletes the 0-value close snapshot at the given
// month (the inverse of upsertCloseSnapshot, for the un-terminate correction).
// It targets only a zero-amount row so a real snapshot the user later re-added
// at that month is left intact.
func deleteCloseSnapshot(ctx context.Context, qtx *db.Queries, id uuid.UUID, terminatedAt time.Time, user, hid uuid.UUID) error {
	snaps, err := qtx.ListInvestmentSnapshotsForInvestment(ctx, db.ListInvestmentSnapshotsForInvestmentParams{
		InvestmentID: id,
		HouseholdID:  hid,
	})
	if err != nil {
		return fmt.Errorf("list snapshots for un-terminate: %w", err)
	}
	ty, tm, _ := terminatedAt.Date()
	for _, s := range snaps {
		sy, sm, _ := s.YearMonth.Date()
		if sy == ty && sm == tm && s.Amount.IsZero() {
			if _, err := qtx.SoftDeleteInvestmentSnapshot(ctx, db.SoftDeleteInvestmentSnapshotParams{
				ID:          s.ID,
				HouseholdID: hid,
				UpdatedBy:   &user,
			}); err != nil {
				return fmt.Errorf("drop close snapshot on un-terminate: %w", err)
			}
			break
		}
	}
	return nil
}
