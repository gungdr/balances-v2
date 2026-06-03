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

// TimeDeposit is the aggregate returned by Get/Create — the core investment
// row joined with its time_deposit_details extension.
type TimeDeposit struct {
	Investment db.Investment        `json:"investment"`
	Details    db.TimeDepositDetail `json:"details"`
}

type TimeDepositListItem struct {
	Investment     db.Investment          `json:"investment"`
	Details        db.TimeDepositDetail   `json:"details"`
	LatestSnapshot *db.InvestmentSnapshot `json:"latest_snapshot"`
	// CostBasis is the principal directly — a TD ledger holds only the
	// terminal Maturity transaction, never buys (issue #18).
	CostBasis decimal.Decimal `json:"cost_basis"`
}

type CreateTimeDepositParams struct {
	DisplayName     string
	Description     *string
	OwnershipType   string
	SoleOwnerUserID *uuid.UUID
	NativeCurrency  string
	RiskProfile     string
	BankName        string
	Principal       decimal.Decimal
	InterestRate    decimal.Decimal
	TermMonths      int32
	PlacementDate   time.Time
	MaturityDate    time.Time
	RolloverPolicy  string // "auto_renew_principal" | "auto_renew_with_interest" | "no_rollover"
}

type UpdateTimeDepositParams struct {
	DisplayName     string
	Description     *string
	OwnershipType   string
	SoleOwnerUserID *uuid.UUID
	RiskProfile     string
	BankName        string
	Principal       decimal.Decimal
	InterestRate    decimal.Decimal
	TermMonths      int32
	PlacementDate   time.Time
	MaturityDate    time.Time
	RolloverPolicy  string
}

func (r *InvestmentRepo) CreateTimeDeposit(ctx context.Context, p CreateTimeDepositParams) (*TimeDeposit, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := r.q.WithTx(tx)
	inv, err := qtx.CreateInvestment(ctx, db.CreateInvestmentParams{
		HouseholdID:     hid,
		DisplayName:     p.DisplayName,
		Description:     p.Description,
		Subtype:         "time_deposit",
		OwnershipType:   p.OwnershipType,
		SoleOwnerUserID: p.SoleOwnerUserID,
		NativeCurrency:  p.NativeCurrency,
		RiskProfile:     p.RiskProfile,
		CreatedBy:       &user,
	})
	if err != nil {
		return nil, fmt.Errorf("create investment: %w", err)
	}

	details, err := qtx.CreateTimeDepositDetails(ctx, db.CreateTimeDepositDetailsParams{
		InvestmentID:   inv.ID,
		BankName:       p.BankName,
		Principal:      p.Principal,
		InterestRate:   p.InterestRate,
		TermMonths:     p.TermMonths,
		PlacementDate:  p.PlacementDate,
		MaturityDate:   p.MaturityDate,
		RolloverPolicy: p.RolloverPolicy,
	})
	if err != nil {
		return nil, fmt.Errorf("create time_deposit_details: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &TimeDeposit{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) GetTimeDeposit(ctx context.Context, id uuid.UUID) (*TimeDeposit, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	inv, err := r.q.GetInvestmentByID(ctx, db.GetInvestmentByIDParams{ID: id, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if inv.Subtype != "time_deposit" {
		return nil, ErrNotFound
	}

	details, err := r.q.GetTimeDepositDetailsByInvestmentID(ctx, inv.ID)
	if err != nil {
		return nil, fmt.Errorf("get time_deposit_details: %w", err)
	}

	return &TimeDeposit{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) ListTimeDeposits(ctx context.Context) ([]TimeDepositListItem, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	subtype := "time_deposit"
	invs, err := r.q.ListInvestmentsByHousehold(ctx, db.ListInvestmentsByHouseholdParams{
		HouseholdID: hid,
		Subtype:     &subtype,
	})
	if err != nil {
		return nil, fmt.Errorf("list investments: %w", err)
	}
	if len(invs) == 0 {
		return []TimeDepositListItem{}, nil
	}

	ids := make([]uuid.UUID, len(invs))
	for i, x := range invs {
		ids[i] = x.ID
	}

	details, err := r.q.ListTimeDepositDetailsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list time_deposit_details: %w", err)
	}
	detailByID := make(map[uuid.UUID]db.TimeDepositDetail, len(details))
	for _, d := range details {
		detailByID[d.InvestmentID] = d
	}

	snapshots, err := r.q.ListLatestInvestmentSnapshotsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list latest investment snapshots: %w", err)
	}
	snapByID := make(map[uuid.UUID]db.InvestmentSnapshot, len(snapshots))
	for _, s := range snapshots {
		snapByID[s.InvestmentID] = s
	}

	out := make([]TimeDepositListItem, 0, len(invs))
	for _, x := range invs {
		item := TimeDepositListItem{
			Investment: x,
			Details:    detailByID[x.ID],
			CostBasis:  detailByID[x.ID].Principal,
		}
		if s, ok := snapByID[x.ID]; ok {
			s := s
			item.LatestSnapshot = &s
		}
		out = append(out, item)
	}
	return out, nil
}

func (r *InvestmentRepo) UpdateTimeDeposit(ctx context.Context, id uuid.UUID, p UpdateTimeDepositParams) (*TimeDeposit, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := r.q.WithTx(tx)
	inv, err := qtx.UpdateInvestment(ctx, db.UpdateInvestmentParams{
		ID:              id,
		HouseholdID:     hid,
		DisplayName:     p.DisplayName,
		Description:     p.Description,
		OwnershipType:   p.OwnershipType,
		SoleOwnerUserID: p.SoleOwnerUserID,
		RiskProfile:     p.RiskProfile,
		UpdatedBy:       &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update investment: %w", err)
	}
	if inv.Subtype != "time_deposit" {
		return nil, ErrNotFound
	}

	details, err := qtx.UpdateTimeDepositDetails(ctx, db.UpdateTimeDepositDetailsParams{
		InvestmentID:   inv.ID,
		BankName:       p.BankName,
		Principal:      p.Principal,
		InterestRate:   p.InterestRate,
		TermMonths:     p.TermMonths,
		PlacementDate:  p.PlacementDate,
		MaturityDate:   p.MaturityDate,
		RolloverPolicy: p.RolloverPolicy,
	})
	if err != nil {
		return nil, fmt.Errorf("update time_deposit_details: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &TimeDeposit{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) DeleteTimeDeposit(ctx context.Context, id uuid.UUID) error {
	if _, err := r.GetTimeDeposit(ctx, id); err != nil {
		return err
	}
	return r.softDeleteInvestment(ctx, id)
}
