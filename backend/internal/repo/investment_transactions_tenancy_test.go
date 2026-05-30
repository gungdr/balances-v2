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

// TestInvestmentTransaction_TenancyAndCRUD verifies that the transaction
// ledger respects cross-Household isolation and that the subtype→type
// matrix + shape validation reject incoherent transactions before they
// hit the DB CHECK. Covers one transaction per shape (Buy = trade, Dividend
// = cash income, Fee = fee, Maturity = maturity) with the alice-side
// happy path + bob-side rejection per the Phase 1 coverage pattern.
func TestInvestmentTransaction_TenancyAndCRUD(t *testing.T) {
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

	stock, err := r.CreateStock(aliceCtx, repo.CreateStockParams{
		DisplayName:    "BBCA",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		RiskProfile:    "medium",
		Ticker:         "BBCA",
		Exchange:       "IDX",
	})
	if err != nil {
		t.Fatalf("CreateStock: %v", err)
	}
	couponRate, _ := decimal.NewFromString("6.25")
	bond, err := r.CreateBond(aliceCtx, repo.CreateBondParams{
		DisplayName:     "ORI024",
		OwnershipType:   "joint",
		NativeCurrency:  "IDR",
		RiskProfile:     "medium",
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
	interestRate, _ := decimal.NewFromString("5.5")
	td, err := r.CreateTimeDeposit(aliceCtx, repo.CreateTimeDepositParams{
		DisplayName:    "BCA TD",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		RiskProfile:    "medium",
		BankName:       "BCA",
		Principal:      decimal.NewFromInt(50_000_000),
		InterestRate:   interestRate,
		TermMonths:     12,
		PlacementDate:  time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
		MaturityDate:   time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC),
		RolloverPolicy: "auto_renew_principal",
	})
	if err != nil {
		t.Fatalf("CreateTimeDeposit: %v", err)
	}

	qty := decimal.NewFromInt(100)
	price := decimal.NewFromInt(9500)
	totalCash := decimal.NewFromInt(950_000)
	rolled := repo.DispositionRolledToNew
	cashOut := repo.DispositionCashOut

	aliceBuy, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
		InvestmentID:    stock.Investment.ID,
		TransactionType: repo.TxnTypeBuy,
		TransactionDate: time.Date(2026, time.May, 4, 0, 0, 0, 0, time.UTC),
		Currency:        "IDR",
		Amount:          &totalCash,
		Quantity:        &qty,
		PricePerUnit:    &price,
	})
	if err != nil {
		t.Fatalf("alice Create Buy: %v", err)
	}

	dividendAmount := decimal.NewFromInt(25_000)
	aliceDiv, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
		InvestmentID:    stock.Investment.ID,
		TransactionType: repo.TxnTypeDividend,
		TransactionDate: time.Date(2026, time.May, 20, 0, 0, 0, 0, time.UTC),
		Currency:        "IDR",
		Amount:          &dividendAmount,
	})
	if err != nil {
		t.Fatalf("alice Create Dividend: %v", err)
	}

	feeAmount := decimal.NewFromInt(5_000)
	aliceFee, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
		InvestmentID:    stock.Investment.ID,
		TransactionType: repo.TxnTypeFee,
		TransactionDate: time.Date(2026, time.May, 25, 0, 0, 0, 0, time.UTC),
		Currency:        "IDR",
		Amount:          &feeAmount,
	})
	if err != nil {
		t.Fatalf("alice Create Fee: %v", err)
	}

	matPrincipal := decimal.NewFromInt(50_000_000)
	matInterest := decimal.NewFromInt(2_750_000)
	aliceMaturity, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
		InvestmentID:         td.Investment.ID,
		TransactionType:      repo.TxnTypeMaturity,
		TransactionDate:      time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC),
		Currency:             "IDR",
		PrincipalAmount:      &matPrincipal,
		InterestAmount:       &matInterest,
		PrincipalDisposition: &rolled,
		InterestDisposition:  &cashOut,
	})
	if err != nil {
		t.Fatalf("alice Create Maturity: %v", err)
	}

	// ----- Bob can't observe or mutate alice's transactions -----

	t.Run("bob list transactions on alice's investment is empty", func(t *testing.T) {
		txns, err := r.ListInvestmentTransactions(bobCtx, stock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentTransactions: %v", err)
		}
		if len(txns) != 0 {
			t.Errorf("bob saw %d transactions; want 0", len(txns))
		}
	})

	t.Run("bob create transaction on alice's investment is not allowed", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(bobCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    stock.Investment.ID,
			TransactionType: repo.TxnTypeBuy,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &totalCash,
			Quantity:        &qty,
			PricePerUnit:    &price,
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update alice's transaction is not allowed", func(t *testing.T) {
		_, err := r.UpdateInvestmentTransaction(bobCtx, repo.UpdateInvestmentTransactionParams{
			TransactionID:   aliceBuy.ID,
			TransactionDate: time.Date(2026, time.May, 4, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &totalCash,
			Quantity:        &qty,
			PricePerUnit:    &price,
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete alice's transaction is not allowed", func(t *testing.T) {
		if err := r.DeleteInvestmentTransaction(bobCtx, aliceBuy.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("want ErrNotFound, got %v", err)
		}
	})

	// ----- Subtype→type matrix rejection ----------------------

	t.Run("Coupon on Stock is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    stock.Investment.ID,
			TransactionType: repo.TxnTypeCoupon,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &dividendAmount,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionType) {
			t.Errorf("want ErrInvalidTransactionType, got %v", err)
		}
	})

	t.Run("Buy on TimeDeposit is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    td.Investment.ID,
			TransactionType: repo.TxnTypeBuy,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &totalCash,
			Quantity:        &qty,
			PricePerUnit:    &price,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionType) {
			t.Errorf("want ErrInvalidTransactionType, got %v", err)
		}
	})

	t.Run("Maturity on Stock is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:         stock.Investment.ID,
			TransactionType:      repo.TxnTypeMaturity,
			TransactionDate:      time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:             "IDR",
			PrincipalAmount:      &matPrincipal,
			InterestAmount:       &matInterest,
			PrincipalDisposition: &rolled,
			InterestDisposition:  &cashOut,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionType) {
			t.Errorf("want ErrInvalidTransactionType, got %v", err)
		}
	})

	t.Run("Dividend on Bond is rejected (bonds use Coupon)", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    bond.Investment.ID,
			TransactionType: repo.TxnTypeDividend,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &dividendAmount,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionType) {
			t.Errorf("want ErrInvalidTransactionType, got %v", err)
		}
	})

	// ----- Shape rejection ------------------------------------

	t.Run("Buy without quantity is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    stock.Investment.ID,
			TransactionType: repo.TxnTypeBuy,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &totalCash,
			PricePerUnit:    &price,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionShape) {
			t.Errorf("want ErrInvalidTransactionShape, got %v", err)
		}
	})

	t.Run("Maturity without dispositions is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    td.Investment.ID,
			TransactionType: repo.TxnTypeMaturity,
			TransactionDate: time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			PrincipalAmount: &matPrincipal,
			InterestAmount:  &matInterest,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionShape) {
			t.Errorf("want ErrInvalidTransactionShape, got %v", err)
		}
	})

	t.Run("Fee with quantity but no price_per_unit is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    stock.Investment.ID,
			TransactionType: repo.TxnTypeFee,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &feeAmount,
			Quantity:        &qty,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionShape) {
			t.Errorf("want ErrInvalidTransactionShape, got %v", err)
		}
	})

	t.Run("Dividend with quantity is rejected", func(t *testing.T) {
		_, err := r.CreateInvestmentTransaction(aliceCtx, repo.CreateInvestmentTransactionParams{
			InvestmentID:    stock.Investment.ID,
			TransactionType: repo.TxnTypeDividend,
			TransactionDate: time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &dividendAmount,
			Quantity:        &qty,
		})
		if !errors.Is(err, repo.ErrInvalidTransactionShape) {
			t.Errorf("want ErrInvalidTransactionShape, got %v", err)
		}
	})

	// ----- Alice can see + update + delete her own -----------

	t.Run("alice lists all four transactions for the stock", func(t *testing.T) {
		txns, err := r.ListInvestmentTransactions(aliceCtx, stock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentTransactions: %v", err)
		}
		// Buy + Dividend + Fee on the stock = 3 transactions
		if len(txns) != 3 {
			t.Errorf("got %d transactions; want 3", len(txns))
		}
	})

	t.Run("alice update buy persists new quantity", func(t *testing.T) {
		newQty := decimal.NewFromInt(110)
		newCash := decimal.NewFromInt(1_045_000)
		updated, err := r.UpdateInvestmentTransaction(aliceCtx, repo.UpdateInvestmentTransactionParams{
			TransactionID:   aliceBuy.ID,
			TransactionDate: time.Date(2026, time.May, 4, 0, 0, 0, 0, time.UTC),
			Currency:        "IDR",
			Amount:          &newCash,
			Quantity:        &newQty,
			PricePerUnit:    &price,
		})
		if err != nil {
			t.Fatalf("UpdateInvestmentTransaction: %v", err)
		}
		if updated.Quantity == nil || !updated.Quantity.Equal(newQty) {
			t.Errorf("Quantity: got %v, want 110", updated.Quantity)
		}
	})

	t.Run("alice delete dividend removes it from list", func(t *testing.T) {
		if err := r.DeleteInvestmentTransaction(aliceCtx, aliceDiv.ID); err != nil {
			t.Fatalf("DeleteInvestmentTransaction: %v", err)
		}
		txns, err := r.ListInvestmentTransactions(aliceCtx, stock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentTransactions: %v", err)
		}
		for _, x := range txns {
			if x.ID == aliceDiv.ID {
				t.Errorf("deleted transaction still in list")
			}
		}
	})

	t.Run("alice maturity round-trip preserves dispositions", func(t *testing.T) {
		txns, err := r.ListInvestmentTransactions(aliceCtx, td.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentTransactions: %v", err)
		}
		if len(txns) != 1 {
			t.Fatalf("td transactions: got %d, want 1", len(txns))
		}
		mat := txns[0]
		if mat.ID != aliceMaturity.ID {
			t.Errorf("ID mismatch: got %s, want %s", mat.ID, aliceMaturity.ID)
		}
		if mat.PrincipalDisposition == nil || *mat.PrincipalDisposition != repo.DispositionRolledToNew {
			t.Errorf("PrincipalDisposition: got %v, want %s", mat.PrincipalDisposition, repo.DispositionRolledToNew)
		}
		if mat.InterestDisposition == nil || *mat.InterestDisposition != repo.DispositionCashOut {
			t.Errorf("InterestDisposition: got %v, want %s", mat.InterestDisposition, repo.DispositionCashOut)
		}
	})

	t.Run("alice delete fee removes it", func(t *testing.T) {
		if err := r.DeleteInvestmentTransaction(aliceCtx, aliceFee.ID); err != nil {
			t.Fatalf("DeleteInvestmentTransaction: %v", err)
		}
		txns, err := r.ListInvestmentTransactions(aliceCtx, stock.Investment.ID)
		if err != nil {
			t.Fatalf("ListInvestmentTransactions: %v", err)
		}
		for _, x := range txns {
			if x.ID == aliceFee.ID {
				t.Errorf("deleted fee still in list")
			}
		}
	})
}
