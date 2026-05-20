package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// ReceivableRepo wraps the generated queries for the Receivable position
// group. Receivables have no subtype and use inline metadata (no extension
// table). Receivable snapshots share their own per-group table (see
// ADR-0022) and live here since there are no subtypes to share with.
type ReceivableRepo struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewReceivableRepo(pool *pgxpool.Pool) *ReceivableRepo {
	return &ReceivableRepo{pool: pool, q: db.New(pool)}
}

type ReceivableListItem struct {
	Receivable     db.Receivable          `json:"receivable"`
	LatestSnapshot *db.ReceivableSnapshot `json:"latest_snapshot"`
}

type CreateReceivableParams struct {
	DisplayName      string
	Description      *string
	OwnershipType    string // "sole" | "joint"
	SoleOwnerUserID  *uuid.UUID
	NativeCurrency   string
	CounterpartyName string
	DueDate          *time.Time
}

type UpdateReceivableParams struct {
	DisplayName      string
	Description      *string
	CounterpartyName string
	DueDate          *time.Time
}

func (r *ReceivableRepo) CreateReceivable(ctx context.Context, p CreateReceivableParams) (*db.Receivable, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.CreateReceivable(ctx, db.CreateReceivableParams{
		HouseholdID:      hid,
		DisplayName:      p.DisplayName,
		Description:      p.Description,
		OwnershipType:    p.OwnershipType,
		SoleOwnerUserID:  p.SoleOwnerUserID,
		NativeCurrency:   p.NativeCurrency,
		CounterpartyName: p.CounterpartyName,
		DueDate:          p.DueDate,
		CreatedBy:        &user,
	})
	if err != nil {
		return nil, fmt.Errorf("create receivable: %w", err)
	}
	return &row, nil
}

func (r *ReceivableRepo) GetReceivable(ctx context.Context, id uuid.UUID) (*db.Receivable, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.GetReceivableByID(ctx, db.GetReceivableByIDParams{ID: id, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *ReceivableRepo) ListReceivables(ctx context.Context) ([]ReceivableListItem, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := r.q.ListReceivablesByHousehold(ctx, hid)
	if err != nil {
		return nil, fmt.Errorf("list receivables: %w", err)
	}
	if len(rows) == 0 {
		return []ReceivableListItem{}, nil
	}

	ids := make([]uuid.UUID, len(rows))
	for i, rv := range rows {
		ids[i] = rv.ID
	}

	snapshots, err := r.q.ListLatestReceivableSnapshotsByReceivableIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list latest receivable snapshots: %w", err)
	}
	snapByID := make(map[uuid.UUID]db.ReceivableSnapshot, len(snapshots))
	for _, s := range snapshots {
		snapByID[s.ReceivableID] = s
	}

	out := make([]ReceivableListItem, 0, len(rows))
	for _, rv := range rows {
		item := ReceivableListItem{Receivable: rv}
		if s, ok := snapByID[rv.ID]; ok {
			s := s
			item.LatestSnapshot = &s
		}
		out = append(out, item)
	}
	return out, nil
}

func (r *ReceivableRepo) UpdateReceivable(ctx context.Context, id uuid.UUID, p UpdateReceivableParams) (*db.Receivable, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.UpdateReceivable(ctx, db.UpdateReceivableParams{
		ID:               id,
		HouseholdID:      hid,
		DisplayName:      p.DisplayName,
		Description:      p.Description,
		CounterpartyName: p.CounterpartyName,
		DueDate:          p.DueDate,
		UpdatedBy:        &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update receivable: %w", err)
	}
	return &row, nil
}

func (r *ReceivableRepo) DeleteReceivable(ctx context.Context, id uuid.UUID) error {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return err
	}
	rows, err := r.q.SoftDeleteReceivable(ctx, db.SoftDeleteReceivableParams{
		ID:          id,
		HouseholdID: hid,
		UpdatedBy:   &user,
	})
	if err != nil {
		return fmt.Errorf("soft delete receivable: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- receivable snapshots ----------------------------------------------

type CreateReceivableSnapshotParams struct {
	ReceivableID uuid.UUID
	YearMonth    time.Time
	Amount       decimal.Decimal
	Currency     string
	AsOfDate     *time.Time
	Description  *string
}

type UpdateReceivableSnapshotParams struct {
	SnapshotID  uuid.UUID
	Amount      decimal.Decimal
	Currency    string
	AsOfDate    *time.Time
	Description *string
}

func (r *ReceivableRepo) CreateReceivableSnapshot(ctx context.Context, p CreateReceivableSnapshotParams) (*db.ReceivableSnapshot, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	snap, err := r.q.CreateReceivableSnapshot(ctx, db.CreateReceivableSnapshotParams{
		ID:          p.ReceivableID,
		YearMonth:   p.YearMonth,
		Amount:      p.Amount,
		Currency:    p.Currency,
		AsOfDate:    p.AsOfDate,
		Description: p.Description,
		CreatedBy:   &user,
		HouseholdID: hid,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("create receivable snapshot: %w", err)
	}
	return &snap, nil
}

func (r *ReceivableRepo) ListReceivableSnapshots(ctx context.Context, receivableID uuid.UUID) ([]db.ReceivableSnapshot, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return r.q.ListReceivableSnapshotsForReceivable(ctx, db.ListReceivableSnapshotsForReceivableParams{
		ReceivableID: receivableID,
		HouseholdID:  hid,
	})
}

func (r *ReceivableRepo) UpdateReceivableSnapshot(ctx context.Context, p UpdateReceivableSnapshotParams) (*db.ReceivableSnapshot, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	snap, err := r.q.UpdateReceivableSnapshot(ctx, db.UpdateReceivableSnapshotParams{
		ID:          p.SnapshotID,
		HouseholdID: hid,
		Amount:      p.Amount,
		Currency:    p.Currency,
		AsOfDate:    p.AsOfDate,
		Description: p.Description,
		UpdatedBy:   &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update receivable snapshot: %w", err)
	}
	return &snap, nil
}

func (r *ReceivableRepo) DeleteReceivableSnapshot(ctx context.Context, snapshotID uuid.UUID) error {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return err
	}
	rows, err := r.q.SoftDeleteReceivableSnapshot(ctx, db.SoftDeleteReceivableSnapshotParams{
		ID:          snapshotID,
		HouseholdID: hid,
		UpdatedBy:   &user,
	})
	if err != nil {
		return fmt.Errorf("soft delete receivable snapshot: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
