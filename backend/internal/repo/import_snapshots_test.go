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

// TestAssetRepo_ImportAssetSnapshots covers the bulk-import path: dry-run writes
// nothing, commit inserts, re-import upserts by month (last-write-wins, no
// duplicate), and a cross-household import is rejected as ErrNotFound.
func TestAssetRepo_ImportAssetSnapshots(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	alice := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bob := testutil.CreateHouseholdWithUser(t, q, "Bob")
	aliceCtx := auth.WithUser(context.Background(), alice)
	bobCtx := auth.WithUser(context.Background(), bob)

	r := repo.NewAssetRepo(tdb.Pool)

	acct, err := r.CreateBankAccount(aliceCtx, repo.CreateBankAccountParams{
		DisplayName:    "Alice BCA",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		BankName:       "BCA",
		AccountNumber:  "111",
		AccountType:    "savings",
	})
	if err != nil {
		t.Fatalf("CreateBankAccount: %v", err)
	}
	aid := acct.Asset.ID

	ym := func(y int, m time.Month) time.Time {
		return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	}
	rows := []repo.ImportSnapshotRow{
		{YearMonth: ym(2015, time.January), Amount: decimal.NewFromInt(100), Currency: "IDR"},
		{YearMonth: ym(2015, time.February), Amount: decimal.NewFromInt(200), Currency: "IDR"},
	}

	t.Run("dry-run classifies but writes nothing", func(t *testing.T) {
		res, err := r.ImportAssetSnapshots(aliceCtx, aid, rows, true)
		if err != nil {
			t.Fatalf("dry-run: %v", err)
		}
		if res.ToInsert != 2 || res.ToUpdate != 0 {
			t.Errorf("counts = %d/%d, want 2/0", res.ToInsert, res.ToUpdate)
		}
		snaps, _ := r.ListAssetSnapshots(aliceCtx, aid)
		if len(snaps) != 0 {
			t.Errorf("dry-run wrote %d snapshots; want 0", len(snaps))
		}
	})

	t.Run("commit inserts all rows", func(t *testing.T) {
		res, err := r.ImportAssetSnapshots(aliceCtx, aid, rows, false)
		if err != nil {
			t.Fatalf("commit: %v", err)
		}
		if res.ToInsert != 2 || res.ToUpdate != 0 {
			t.Errorf("counts = %d/%d, want 2/0", res.ToInsert, res.ToUpdate)
		}
		snaps, _ := r.ListAssetSnapshots(aliceCtx, aid)
		if len(snaps) != 2 {
			t.Fatalf("after commit got %d snapshots; want 2", len(snaps))
		}
	})

	t.Run("re-import upserts by month, last-write-wins", func(t *testing.T) {
		updated := []repo.ImportSnapshotRow{
			{YearMonth: ym(2015, time.January), Amount: decimal.NewFromInt(999), Currency: "IDR"}, // overwrite
			{YearMonth: ym(2015, time.March), Amount: decimal.NewFromInt(300), Currency: "IDR"},   // new
		}
		res, err := r.ImportAssetSnapshots(aliceCtx, aid, updated, false)
		if err != nil {
			t.Fatalf("re-import: %v", err)
		}
		if res.ToInsert != 1 || res.ToUpdate != 1 {
			t.Errorf("counts = %d/%d, want 1/1", res.ToInsert, res.ToUpdate)
		}
		snaps, _ := r.ListAssetSnapshots(aliceCtx, aid)
		if len(snaps) != 3 {
			t.Fatalf("got %d snapshots; want 3 (Jan/Feb/Mar, no dup)", len(snaps))
		}
		for _, s := range snaps {
			if s.YearMonth.Equal(ym(2015, time.January)) && !s.Amount.Equal(decimal.NewFromInt(999)) {
				t.Errorf("Jan amount = %s, want 999 (overwritten)", s.Amount)
			}
		}
	})

	t.Run("bob cannot import into alice's asset", func(t *testing.T) {
		_, err := r.ImportAssetSnapshots(bobCtx, aid, rows, false)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("bob import err = %v, want ErrNotFound", err)
		}
		snaps, _ := r.ListAssetSnapshots(aliceCtx, aid)
		if len(snaps) != 3 {
			t.Errorf("after bob's attempt got %d snapshots; want 3 unchanged", len(snaps))
		}
	})
}
