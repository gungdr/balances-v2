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

// Bond is the aggregate returned by Get/Create — the core investment row
// joined with its bond_details extension.
type Bond struct {
	Investment db.Investment `json:"investment"`
	Details    db.BondDetail `json:"details"`
}

type BondListItem struct {
	Investment     db.Investment          `json:"investment"`
	Details        db.BondDetail          `json:"details"`
	LatestSnapshot *db.InvestmentSnapshot `json:"latest_snapshot"`
	// CostBasis is the avg-cost ledger replay when the bond was bought on
	// the secondary market, or the face_value when held from primary
	// issuance (no buy txn) — mirroring lib/costBasis.ts (issue #18).
	CostBasis decimal.Decimal `json:"cost_basis"`
}

type CreateBondParams struct {
	DisplayName     string
	Description     *string
	OwnershipType   string
	SoleOwnerUserID *uuid.UUID
	NativeCurrency  string
	RiskProfile     string
	BondType        string // "govt_primary" | "secondary_market"
	SeriesCode      *string
	Issuer          string
	FaceValue       decimal.Decimal
	CouponRate      decimal.Decimal
	CouponFrequency string // "monthly" | "quarterly" | "semi_annual" | "annual"
	MaturityDate    time.Time
}

type UpdateBondParams struct {
	DisplayName     string
	Description     *string
	OwnershipType   string
	SoleOwnerUserID *uuid.UUID
	RiskProfile     string
	BondType        string
	SeriesCode      *string
	Issuer          string
	FaceValue       decimal.Decimal
	CouponRate      decimal.Decimal
	CouponFrequency string
	MaturityDate    time.Time
}

func (r *InvestmentRepo) CreateBond(ctx context.Context, p CreateBondParams) (*Bond, error) {
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
		Subtype:         "bond",
		OwnershipType:   p.OwnershipType,
		SoleOwnerUserID: p.SoleOwnerUserID,
		NativeCurrency:  p.NativeCurrency,
		RiskProfile:     p.RiskProfile,
		CreatedBy:       &user,
	})
	if err != nil {
		return nil, fmt.Errorf("create investment: %w", err)
	}

	details, err := qtx.CreateBondDetails(ctx, db.CreateBondDetailsParams{
		InvestmentID:    inv.ID,
		BondType:        p.BondType,
		SeriesCode:      p.SeriesCode,
		Issuer:          p.Issuer,
		FaceValue:       p.FaceValue,
		CouponRate:      p.CouponRate,
		CouponFrequency: p.CouponFrequency,
		MaturityDate:    p.MaturityDate,
	})
	if err != nil {
		return nil, fmt.Errorf("create bond_details: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &Bond{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) GetBond(ctx context.Context, id uuid.UUID) (*Bond, error) {
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
	if inv.Subtype != "bond" {
		return nil, ErrNotFound
	}

	details, err := r.q.GetBondDetailsByInvestmentID(ctx, inv.ID)
	if err != nil {
		return nil, fmt.Errorf("get bond_details: %w", err)
	}

	return &Bond{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) ListBonds(ctx context.Context) ([]BondListItem, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	subtype := "bond"
	invs, err := r.q.ListInvestmentsByHousehold(ctx, db.ListInvestmentsByHouseholdParams{
		HouseholdID: hid,
		Subtype:     &subtype,
	})
	if err != nil {
		return nil, fmt.Errorf("list investments: %w", err)
	}
	if len(invs) == 0 {
		return []BondListItem{}, nil
	}

	ids := make([]uuid.UUID, len(invs))
	for i, x := range invs {
		ids[i] = x.ID
	}

	details, err := r.q.ListBondDetailsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list bond_details: %w", err)
	}
	detailByID := make(map[uuid.UUID]db.BondDetail, len(details))
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

	txns, err := r.q.ListInvestmentTransactionsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list investment transactions: %w", err)
	}
	txnByID := groupTransactionsByInvestment(txns)

	out := make([]BondListItem, 0, len(invs))
	for _, x := range invs {
		ledger := txnByID[x.ID]
		costBasis := detailByID[x.ID].FaceValue
		if ledgerHasBuy(ledger) {
			costBasis = costBasisFromLedger(ledger)
		}
		item := BondListItem{
			Investment: x,
			Details:    detailByID[x.ID],
			CostBasis:  costBasis,
		}
		if s, ok := snapByID[x.ID]; ok {
			s := s
			item.LatestSnapshot = &s
		}
		out = append(out, item)
	}
	return out, nil
}

func (r *InvestmentRepo) UpdateBond(ctx context.Context, id uuid.UUID, p UpdateBondParams) (*Bond, error) {
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
	if inv.Subtype != "bond" {
		return nil, ErrNotFound
	}

	details, err := qtx.UpdateBondDetails(ctx, db.UpdateBondDetailsParams{
		InvestmentID:    inv.ID,
		BondType:        p.BondType,
		SeriesCode:      p.SeriesCode,
		Issuer:          p.Issuer,
		FaceValue:       p.FaceValue,
		CouponRate:      p.CouponRate,
		CouponFrequency: p.CouponFrequency,
		MaturityDate:    p.MaturityDate,
	})
	if err != nil {
		return nil, fmt.Errorf("update bond_details: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &Bond{Investment: inv, Details: details}, nil
}

func (r *InvestmentRepo) DeleteBond(ctx context.Context, id uuid.UUID) error {
	if _, err := r.GetBond(ctx, id); err != nil {
		return err
	}
	return r.softDeleteInvestment(ctx, id)
}
