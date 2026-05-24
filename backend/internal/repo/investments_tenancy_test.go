package repo_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/repo"
	"github.com/kerti/balances-v2/backend/internal/testutil"
)

// TestInvestmentRepo_TenancyAndCRUD verifies cross-Household isolation across
// all five Investment subtypes (stock, mutual_fund, gold from M4.3a; bond,
// time_deposit from M4.3b), the subtype guard between them, the snapshot
// tenancy path, and the alice-side happy-path CRUD success branches per the
// Phase 1 coverage pattern. Investment snapshots share a per-group table
// (ADR-0022) so the snapshot CRUD is exercised once via the stock fixture.
func TestInvestmentRepo_TenancyAndCRUD(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bobUser := testutil.CreateHouseholdWithUser(t, q, "Bob")

	if aliceUser.HouseholdID == bobUser.HouseholdID {
		t.Fatalf("fixture: alice and bob ended up in the same household")
	}

	aliceCtx := auth.WithUser(context.Background(), aliceUser)
	bobCtx := auth.WithUser(context.Background(), bobUser)

	r := repo.NewInvestmentRepo(tdb.Pool)

	purity, _ := decimal.NewFromString("0.9999")

	aliceStock, err := r.CreateStock(aliceCtx, repo.CreateStockParams{
		DisplayName:    "Alice BBCA",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		Ticker:         "BBCA",
		Exchange:       "IDX",
	})
	if err != nil {
		t.Fatalf("alice CreateStock: %v", err)
	}
	aliceMF, err := r.CreateMutualFund(aliceCtx, repo.CreateMutualFundParams{
		DisplayName:    "Alice Sucorinvest",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		FundCode:       "SCMUS",
	})
	if err != nil {
		t.Fatalf("alice CreateMutualFund: %v", err)
	}
	aliceGold, err := r.CreateGold(aliceCtx, repo.CreateGoldParams{
		DisplayName:    "Alice Antam Bar",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		Form:           "bar",
		Purity:         purity,
	})
	if err != nil {
		t.Fatalf("alice CreateGold: %v", err)
	}
	couponRate, _ := decimal.NewFromString("0.0625")
	aliceBond, err := r.CreateBond(aliceCtx, repo.CreateBondParams{
		DisplayName:     "Alice ORI024",
		OwnershipType:   "joint",
		NativeCurrency:  "IDR",
		BondType:        "govt_primary",
		Issuer:          "Republik Indonesia",
		FaceValue:       decimal.NewFromInt(10_000_000),
		CouponRate:      couponRate,
		CouponFrequency: "monthly",
		MaturityDate:    time.Date(2029, time.October, 15, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("alice CreateBond: %v", err)
	}
	interestRate, _ := decimal.NewFromString("0.055")
	aliceTD, err := r.CreateTimeDeposit(aliceCtx, repo.CreateTimeDepositParams{
		DisplayName:    "Alice BCA TD",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		BankName:       "BCA",
		Principal:      decimal.NewFromInt(50_000_000),
		InterestRate:   interestRate,
		TermMonths:     12,
		PlacementDate:  time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
		MaturityDate:   time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC),
		RolloverPolicy: "auto_renew_principal",
	})
	if err != nil {
		t.Fatalf("alice CreateTimeDeposit: %v", err)
	}

	// Quantity+price snapshot under the stock, used to drive snapshot tenancy
	// and happy-path tests below.
	qty, _ := decimal.NewFromString("100")
	price, _ := decimal.NewFromString("9500")
	aliceSnap, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
		InvestmentID: aliceStock.Investment.ID,
		YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
		Amount:       decimal.NewFromInt(950_000),
		Currency:     "IDR",
		Quantity:     &qty,
		PricePerUnit: &price,
	})
	if err != nil {
		t.Fatalf("alice CreateInvestmentSnapshot: %v", err)
	}

	// ----- Bob can't observe alice's investments -----------------------

	t.Run("bob list stocks excludes alice's", func(t *testing.T) {
		list, err := r.ListStocks(bobCtx)
		if err != nil {
			t.Fatalf("ListStocks: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d stocks; want 0", len(list))
		}
	})

	t.Run("bob list mutual funds excludes alice's", func(t *testing.T) {
		list, err := r.ListMutualFunds(bobCtx)
		if err != nil {
			t.Fatalf("ListMutualFunds: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d mutual funds; want 0", len(list))
		}
	})

	t.Run("bob list golds excludes alice's", func(t *testing.T) {
		list, err := r.ListGolds(bobCtx)
		if err != nil {
			t.Fatalf("ListGolds: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d golds; want 0", len(list))
		}
	})

	t.Run("bob list bonds excludes alice's", func(t *testing.T) {
		list, err := r.ListBonds(bobCtx)
		if err != nil {
			t.Fatalf("ListBonds: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d bonds; want 0", len(list))
		}
	})

	t.Run("bob list time deposits excludes alice's", func(t *testing.T) {
		list, err := r.ListTimeDeposits(bobCtx)
		if err != nil {
			t.Fatalf("ListTimeDeposits: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d time deposits; want 0", len(list))
		}
	})

	t.Run("bob get returns ErrNotFound across subtypes", func(t *testing.T) {
		if _, err := r.GetStock(bobCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetStock: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetMutualFund(bobCtx, aliceMF.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetMutualFund: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetGold(bobCtx, aliceGold.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetGold: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetBond(bobCtx, aliceBond.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetBond: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetTimeDeposit(bobCtx, aliceTD.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetTimeDeposit: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update returns ErrNotFound across subtypes", func(t *testing.T) {
		if _, err := r.UpdateStock(bobCtx, aliceStock.Investment.ID, repo.UpdateStockParams{
			DisplayName: "stolen!",
			Ticker:      "BBCA",
			Exchange:    "IDX",
		}); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateStock: want ErrNotFound, got %v", err)
		}
		if _, err := r.UpdateMutualFund(bobCtx, aliceMF.Investment.ID, repo.UpdateMutualFundParams{
			DisplayName: "stolen!",
			FundCode:    "SCMUS",
		}); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateMutualFund: want ErrNotFound, got %v", err)
		}
		if _, err := r.UpdateGold(bobCtx, aliceGold.Investment.ID, repo.UpdateGoldParams{
			DisplayName: "stolen!",
			Form:        "bar",
			Purity:      purity,
		}); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateGold: want ErrNotFound, got %v", err)
		}
		if _, err := r.UpdateBond(bobCtx, aliceBond.Investment.ID, repo.UpdateBondParams{
			DisplayName:     "stolen!",
			BondType:        "govt_primary",
			Issuer:          "Republik Indonesia",
			FaceValue:       decimal.NewFromInt(10_000_000),
			CouponRate:      couponRate,
			CouponFrequency: "monthly",
			MaturityDate:    aliceBond.Details.MaturityDate,
		}); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateBond: want ErrNotFound, got %v", err)
		}
		if _, err := r.UpdateTimeDeposit(bobCtx, aliceTD.Investment.ID, repo.UpdateTimeDepositParams{
			DisplayName:    "stolen!",
			BankName:       "BCA",
			Principal:      decimal.NewFromInt(50_000_000),
			InterestRate:   interestRate,
			TermMonths:     12,
			PlacementDate:  aliceTD.Details.PlacementDate,
			MaturityDate:   aliceTD.Details.MaturityDate,
			RolloverPolicy: "auto_renew_principal",
		}); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateTimeDeposit: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete returns ErrNotFound across subtypes", func(t *testing.T) {
		if err := r.DeleteStock(bobCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteStock: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteMutualFund(bobCtx, aliceMF.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteMutualFund: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteGold(bobCtx, aliceGold.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteGold: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteBond(bobCtx, aliceBond.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteBond: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteTimeDeposit(bobCtx, aliceTD.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteTimeDeposit: want ErrNotFound, got %v", err)
		}
	})

	// ----- Subtype guard (alice context, wrong subtype method) ---------

	t.Run("alice's stock fetched via wrong-subtype methods returns ErrNotFound", func(t *testing.T) {
		if _, err := r.GetMutualFund(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetMutualFund on stock id: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetGold(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetGold on stock id: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetBond(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetBond on stock id: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetTimeDeposit(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetTimeDeposit on stock id: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteMutualFund(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteMutualFund on stock id: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteBond(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteBond on stock id: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteTimeDeposit(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteTimeDeposit on stock id: want ErrNotFound, got %v", err)
		}
	})

	t.Run("alice's bond fetched via stock or time-deposit methods returns ErrNotFound", func(t *testing.T) {
		if _, err := r.GetStock(aliceCtx, aliceBond.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetStock on bond id: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetTimeDeposit(aliceCtx, aliceBond.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetTimeDeposit on bond id: want ErrNotFound, got %v", err)
		}
	})

	// ----- Snapshot tenancy --------------------------------------------

	t.Run("bob list snapshots on alice's investment is empty", func(t *testing.T) {
		snaps, err := r.ListInvestmentSnapshots(bobCtx, aliceStock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentSnapshots: %v", err)
		}
		if len(snaps) != 0 {
			t.Errorf("bob saw %d snapshots; want 0", len(snaps))
		}
	})

	t.Run("bob create snapshot under alice's investment is not allowed", func(t *testing.T) {
		q := decimal.NewFromInt(7)
		p := decimal.NewFromInt(1)
		_, err := r.CreateInvestmentSnapshot(bobCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: aliceStock.Investment.ID,
			YearMonth:    time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(7),
			Currency:     "IDR",
			Quantity:     &q,
			PricePerUnit: &p,
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("CreateInvestmentSnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update alice's snapshot is not allowed", func(t *testing.T) {
		q := decimal.NewFromInt(1)
		p := decimal.NewFromInt(1)
		_, err := r.UpdateInvestmentSnapshot(bobCtx, repo.UpdateInvestmentSnapshotParams{
			SnapshotID:   aliceSnap.ID,
			Amount:       decimal.NewFromInt(1),
			Currency:     "IDR",
			Quantity:     &q,
			PricePerUnit: &p,
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateInvestmentSnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete alice's snapshot is not allowed", func(t *testing.T) {
		if err := r.DeleteInvestmentSnapshot(bobCtx, aliceSnap.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteInvestmentSnapshot: want ErrNotFound, got %v", err)
		}
	})

	// ----- Sanity: alice still sees her stuff --------------------------

	t.Run("alice still sees one of each subtype and her snapshot", func(t *testing.T) {
		stocks, err := r.ListStocks(aliceCtx)
		if err != nil || len(stocks) != 1 {
			t.Fatalf("alice ListStocks: len=%d err=%v", len(stocks), err)
		}
		if stocks[0].LatestSnapshot == nil || stocks[0].LatestSnapshot.ID != aliceSnap.ID {
			t.Errorf("alice's stock latest_snapshot mismatch: %+v", stocks[0].LatestSnapshot)
		}
		mfs, err := r.ListMutualFunds(aliceCtx)
		if err != nil || len(mfs) != 1 {
			t.Fatalf("alice ListMutualFunds: len=%d err=%v", len(mfs), err)
		}
		golds, err := r.ListGolds(aliceCtx)
		if err != nil || len(golds) != 1 {
			t.Fatalf("alice ListGolds: len=%d err=%v", len(golds), err)
		}
		bonds, err := r.ListBonds(aliceCtx)
		if err != nil || len(bonds) != 1 {
			t.Fatalf("alice ListBonds: len=%d err=%v", len(bonds), err)
		}
		tds, err := r.ListTimeDeposits(aliceCtx)
		if err != nil || len(tds) != 1 {
			t.Fatalf("alice ListTimeDeposits: len=%d err=%v", len(tds), err)
		}
	})

	// ----- Alice happy-path CRUD ---------------------------------------

	t.Run("alice update stock persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateStock(aliceCtx, aliceStock.Investment.ID, repo.UpdateStockParams{
			DisplayName:   "Alice BBCA renamed",
			OwnershipType: "joint",
			Ticker:        "BBCA",
			Exchange:      "IDX",
		})
		if err != nil {
			t.Fatalf("UpdateStock: %v", err)
		}
		if updated.Investment.DisplayName != "Alice BBCA renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Investment.DisplayName, "Alice BBCA renamed")
		}
	})

	t.Run("alice update stock flips ownership joint→sole with owner picker", func(t *testing.T) {
		updated, err := r.UpdateStock(aliceCtx, aliceStock.Investment.ID, repo.UpdateStockParams{
			DisplayName:     "Alice BBCA renamed",
			OwnershipType:   "sole",
			SoleOwnerUserID: &aliceUser.ID,
			Ticker:          "BBCA",
			Exchange:        "IDX",
		})
		if err != nil {
			t.Fatalf("UpdateStock sole: %v", err)
		}
		if updated.Investment.OwnershipType != "sole" {
			t.Errorf("OwnershipType: got %q, want sole", updated.Investment.OwnershipType)
		}
		if updated.Investment.SoleOwnerUserID == nil || *updated.Investment.SoleOwnerUserID != aliceUser.ID {
			t.Errorf("SoleOwnerUserID: got %v, want %v", updated.Investment.SoleOwnerUserID, aliceUser.ID)
		}
	})

	t.Run("alice update mutual fund persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateMutualFund(aliceCtx, aliceMF.Investment.ID, repo.UpdateMutualFundParams{
			DisplayName:   "Alice Sucorinvest renamed",
			OwnershipType: "joint",
			FundCode:      "SCMUS",
		})
		if err != nil {
			t.Fatalf("UpdateMutualFund: %v", err)
		}
		if updated.Investment.DisplayName != "Alice Sucorinvest renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Investment.DisplayName, "Alice Sucorinvest renamed")
		}
	})

	t.Run("alice update gold persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateGold(aliceCtx, aliceGold.Investment.ID, repo.UpdateGoldParams{
			DisplayName:   "Alice Antam Bar renamed",
			OwnershipType: "joint",
			Form:          "bar",
			Purity:        purity,
		})
		if err != nil {
			t.Fatalf("UpdateGold: %v", err)
		}
		if updated.Investment.DisplayName != "Alice Antam Bar renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Investment.DisplayName, "Alice Antam Bar renamed")
		}
	})

	t.Run("alice update bond persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateBond(aliceCtx, aliceBond.Investment.ID, repo.UpdateBondParams{
			DisplayName:     "Alice ORI024 renamed",
			OwnershipType:   "joint",
			BondType:        "govt_primary",
			Issuer:          "Republik Indonesia",
			FaceValue:       decimal.NewFromInt(10_000_000),
			CouponRate:      couponRate,
			CouponFrequency: "monthly",
			MaturityDate:    aliceBond.Details.MaturityDate,
		})
		if err != nil {
			t.Fatalf("UpdateBond: %v", err)
		}
		if updated.Investment.DisplayName != "Alice ORI024 renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Investment.DisplayName, "Alice ORI024 renamed")
		}
	})

	t.Run("alice update time deposit persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateTimeDeposit(aliceCtx, aliceTD.Investment.ID, repo.UpdateTimeDepositParams{
			DisplayName:    "Alice BCA TD renamed",
			OwnershipType:  "joint",
			BankName:       "BCA",
			Principal:      decimal.NewFromInt(50_000_000),
			InterestRate:   interestRate,
			TermMonths:     12,
			PlacementDate:  aliceTD.Details.PlacementDate,
			MaturityDate:   aliceTD.Details.MaturityDate,
			RolloverPolicy: "auto_renew_principal",
		})
		if err != nil {
			t.Fatalf("UpdateTimeDeposit: %v", err)
		}
		if updated.Investment.DisplayName != "Alice BCA TD renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Investment.DisplayName, "Alice BCA TD renamed")
		}
	})

	t.Run("alice update snapshot persists new amount", func(t *testing.T) {
		newQty := decimal.NewFromInt(120)
		newPrice := decimal.NewFromInt(9000)
		updated, err := r.UpdateInvestmentSnapshot(aliceCtx, repo.UpdateInvestmentSnapshotParams{
			SnapshotID:   aliceSnap.ID,
			Amount:       decimal.NewFromInt(1_080_000),
			Currency:     "IDR",
			Quantity:     &newQty,
			PricePerUnit: &newPrice,
		})
		if err != nil {
			t.Fatalf("UpdateInvestmentSnapshot: %v", err)
		}
		if !updated.Amount.Equal(decimal.NewFromInt(1_080_000)) {
			t.Errorf("Amount: got %s, want 1080000", updated.Amount)
		}
	})

	t.Run("alice delete snapshot removes it from list", func(t *testing.T) {
		if err := r.DeleteInvestmentSnapshot(aliceCtx, aliceSnap.ID); err != nil {
			t.Fatalf("DeleteInvestmentSnapshot: %v", err)
		}
		snaps, err := r.ListInvestmentSnapshots(aliceCtx, aliceStock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentSnapshots: %v", err)
		}
		for _, s := range snaps {
			if s.ID == aliceSnap.ID {
				t.Errorf("deleted snapshot still in list")
			}
		}
	})

	t.Run("alice delete stock removes it from get and list", func(t *testing.T) {
		if err := r.DeleteStock(aliceCtx, aliceStock.Investment.ID); err != nil {
			t.Fatalf("DeleteStock: %v", err)
		}
		if _, err := r.GetStock(aliceCtx, aliceStock.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetStock after delete: want ErrNotFound, got %v", err)
		}
		list, err := r.ListStocks(aliceCtx)
		if err != nil {
			t.Fatalf("ListStocks after delete: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("ListStocks after delete: got %d, want 0", len(list))
		}
	})

	t.Run("alice delete mutual fund removes it", func(t *testing.T) {
		if err := r.DeleteMutualFund(aliceCtx, aliceMF.Investment.ID); err != nil {
			t.Fatalf("DeleteMutualFund: %v", err)
		}
		if _, err := r.GetMutualFund(aliceCtx, aliceMF.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetMutualFund after delete: want ErrNotFound, got %v", err)
		}
	})

	t.Run("alice delete gold removes it", func(t *testing.T) {
		if err := r.DeleteGold(aliceCtx, aliceGold.Investment.ID); err != nil {
			t.Fatalf("DeleteGold: %v", err)
		}
		if _, err := r.GetGold(aliceCtx, aliceGold.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetGold after delete: want ErrNotFound, got %v", err)
		}
	})

	t.Run("alice delete bond removes it", func(t *testing.T) {
		if err := r.DeleteBond(aliceCtx, aliceBond.Investment.ID); err != nil {
			t.Fatalf("DeleteBond: %v", err)
		}
		if _, err := r.GetBond(aliceCtx, aliceBond.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetBond after delete: want ErrNotFound, got %v", err)
		}
	})

	t.Run("alice delete time deposit removes it", func(t *testing.T) {
		if err := r.DeleteTimeDeposit(aliceCtx, aliceTD.Investment.ID); err != nil {
			t.Fatalf("DeleteTimeDeposit: %v", err)
		}
		if _, err := r.GetTimeDeposit(aliceCtx, aliceTD.Investment.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetTimeDeposit after delete: want ErrNotFound, got %v", err)
		}
	})
}

// TestInvestmentRepo_SnapshotShapeValidation exercises the repo-level
// subtype→shape mapping that the DB's column-level CHECK can't express
// (ADR-0022). Stock/MutualFund/Gold require quantity+price_per_unit and
// reject accrued_interest; Bond/TimeDeposit require accrued_interest and
// reject quantity/price. The wrong combo surfaces as
// ErrInvalidSnapshotShape rather than a SQL constraint violation.
func TestInvestmentRepo_SnapshotShapeValidation(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	aliceCtx := auth.WithUser(context.Background(), aliceUser)

	r := repo.NewInvestmentRepo(tdb.Pool)

	stock, err := r.CreateStock(aliceCtx, repo.CreateStockParams{
		DisplayName:    "BBCA",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		Ticker:         "BBCA",
		Exchange:       "IDX",
	})
	if err != nil {
		t.Fatalf("CreateStock: %v", err)
	}

	couponRate, _ := decimal.NewFromString("0.0625")
	bond, err := r.CreateBond(aliceCtx, repo.CreateBondParams{
		DisplayName:     "ORI024",
		OwnershipType:   "joint",
		NativeCurrency:  "IDR",
		BondType:        "govt_primary",
		Issuer:          "Republik Indonesia",
		FaceValue:       decimal.NewFromInt(10_000_000),
		CouponRate:      couponRate,
		CouponFrequency: "monthly",
		MaturityDate:    time.Date(2029, time.October, 15, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("CreateBond: %v", err)
	}

	qty := decimal.NewFromInt(100)
	price := decimal.NewFromInt(9500)
	accrued := decimal.NewFromInt(1000)

	t.Run("stock snapshot missing quantity is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: stock.Investment.ID,
			YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(950_000),
			Currency:     "IDR",
			PricePerUnit: &price,
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})

	t.Run("stock snapshot missing price is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: stock.Investment.ID,
			YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(950_000),
			Currency:     "IDR",
			Quantity:     &qty,
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})

	t.Run("stock snapshot with accrued_interest is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID:    stock.Investment.ID,
			YearMonth:       time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:          decimal.NewFromInt(950_000),
			Currency:        "IDR",
			Quantity:        &qty,
			PricePerUnit:    &price,
			AccruedInterest: &accrued,
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})

	t.Run("stock snapshot with quantity+price is accepted", func(t *testing.T) {
		snap, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: stock.Investment.ID,
			YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(950_000),
			Currency:     "IDR",
			Quantity:     &qty,
			PricePerUnit: &price,
		})
		if err != nil {
			t.Fatalf("CreateInvestmentSnapshot: %v", err)
		}
		if !snap.Amount.Equal(decimal.NewFromInt(950_000)) {
			t.Errorf("Amount: got %s, want 950000", snap.Amount)
		}
	})

	t.Run("bond snapshot missing accrued_interest is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: bond.Investment.ID,
			YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(10_050_000),
			Currency:     "IDR",
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})

	t.Run("bond snapshot with quantity+price is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID:    bond.Investment.ID,
			YearMonth:       time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:          decimal.NewFromInt(10_050_000),
			Currency:        "IDR",
			Quantity:        &qty,
			PricePerUnit:    &price,
			AccruedInterest: &accrued,
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})

	t.Run("bond snapshot with accrued_interest only is accepted", func(t *testing.T) {
		snap, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID:    bond.Investment.ID,
			YearMonth:       time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
			Amount:          decimal.NewFromInt(10_050_000),
			Currency:        "IDR",
			AccruedInterest: &accrued,
		})
		if err != nil {
			t.Fatalf("CreateInvestmentSnapshot: %v", err)
		}
		if !snap.Amount.Equal(decimal.NewFromInt(10_050_000)) {
			t.Errorf("Amount: got %s, want 10050000", snap.Amount)
		}
		if snap.AccruedInterest == nil || !snap.AccruedInterest.Equal(accrued) {
			t.Errorf("AccruedInterest: got %v, want %s", snap.AccruedInterest, accrued)
		}
	})

	t.Run("update stock snapshot with accrued_interest is rejected", func(t *testing.T) {
		// Need a fresh snapshot for a different month since we already used May.
		existing, err := r.CreateInvestmentSnapshot(aliceCtx, repo.CreateInvestmentSnapshotParams{
			InvestmentID: stock.Investment.ID,
			YearMonth:    time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(1_000_000),
			Currency:     "IDR",
			Quantity:     &qty,
			PricePerUnit: &price,
		})
		if err != nil {
			t.Fatalf("CreateInvestmentSnapshot seed: %v", err)
		}
		_, err = r.UpdateInvestmentSnapshot(aliceCtx, repo.UpdateInvestmentSnapshotParams{
			SnapshotID:      existing.ID,
			Amount:          decimal.NewFromInt(1_000_000),
			Currency:        "IDR",
			AccruedInterest: &accrued,
		})
		if !errors.Is(err, repo.ErrInvalidSnapshotShape) {
			t.Errorf("want ErrInvalidSnapshotShape, got %v", err)
		}
	})
}
