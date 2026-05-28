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

// TestMonthlyReportRepo_ReadPaths covers the single-month read surface the
// dashboard uses: GetReport (refresh-then-fetch for an in-range month, and
// ErrNotFound for a month outside the snapshot range), plus ReportingCurrency.
// The full generation/staleness wiring is proven in TestMonthlyReportRepo.
func TestMonthlyReportRepo_ReadPaths(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	alice := testutil.CreateHouseholdWithUser(t, q, "Alice")
	aliceCtx := auth.WithUser(context.Background(), alice)

	// One Jan-2026 snapshot puts Jan..current in range; 2020 stays out of range.
	acct := createAsset(t, q, alice.HouseholdID, &alice.ID, nil, "joint")
	_ = createAssetSnapshot(t, q, alice.HouseholdID, acct, ymUTC(2026, time.January), "100")

	r := repo.NewMonthlyReportRepo(tdb.Pool)

	t.Run("GetReport returns an in-range month", func(t *testing.T) {
		got, err := r.GetReport(aliceCtx, ymUTC(2026, time.January))
		if err != nil {
			t.Fatalf("GetReport: %v", err)
		}
		if got == nil {
			t.Fatal("GetReport returned nil report")
		}
		if got.YearMonth.Year() != 2026 || got.YearMonth.Month() != time.January {
			t.Errorf("year_month = %s, want 2026-01", got.YearMonth.Format("2006-01"))
		}
		if !got.NwTotal.Equal(decimal.NewFromInt(100)) {
			t.Errorf("nw_total = %s, want 100", got.NwTotal)
		}
	})

	t.Run("GetReport out of range is ErrNotFound", func(t *testing.T) {
		if _, err := r.GetReport(aliceCtx, ymUTC(2020, time.January)); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("ReportingCurrency returns the household currency", func(t *testing.T) {
		cur, err := r.ReportingCurrency(aliceCtx)
		if err != nil {
			t.Fatalf("ReportingCurrency: %v", err)
		}
		if cur != "IDR" {
			t.Errorf("reporting currency = %q, want IDR", cur)
		}
	})
}
