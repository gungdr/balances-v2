package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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

func (r *InvestmentRepo) UpdateInvestmentLifecycle(ctx context.Context, id uuid.UUID, p LifecycleParams) (*db.Investment, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validatePositionLifecycle(investmentStatuses, p); err != nil {
		return nil, err
	}
	row, err := r.q.UpdateInvestmentLifecycle(ctx, db.UpdateInvestmentLifecycleParams{
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
	return &row, nil
}
