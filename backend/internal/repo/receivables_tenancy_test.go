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

// TestReceivableRepo_TenancyIsolation mirrors the liability leak test for
// receivables. Like liabilities, receivable_snapshots is a dedicated
// per-group table (ADR-0022), so this exercises both core CRUD and
// snapshot CRUD.
func TestReceivableRepo_TenancyIsolation(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bobUser := testutil.CreateHouseholdWithUser(t, q, "Bob")

	if aliceUser.HouseholdID == bobUser.HouseholdID {
		t.Fatalf("fixture: alice and bob ended up in the same household")
	}

	aliceCtx := auth.WithUser(context.Background(), aliceUser)
	bobCtx := auth.WithUser(context.Background(), bobUser)

	r := repo.NewReceivableRepo(tdb.Pool)

	aliceReceivable, err := r.CreateReceivable(aliceCtx, repo.CreateReceivableParams{
		DisplayName:      "Loan to brother",
		OwnershipType:    "joint",
		NativeCurrency:   "IDR",
		CounterpartyName: "Brother",
	})
	if err != nil {
		t.Fatalf("alice CreateReceivable: %v", err)
	}

	aliceSnap, err := r.CreateReceivableSnapshot(aliceCtx, repo.CreateReceivableSnapshotParams{
		ReceivableID: aliceReceivable.ID,
		YearMonth:    time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
		Amount:       decimal.NewFromInt(50_000_000),
		Currency:     "IDR",
	})
	if err != nil {
		t.Fatalf("alice CreateReceivableSnapshot: %v", err)
	}

	// ----- Bob can't observe Alice's receivable ------------------------

	t.Run("bob list excludes alice's receivable", func(t *testing.T) {
		list, err := r.ListReceivables(bobCtx)
		if err != nil {
			t.Fatalf("ListReceivables: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d receivables; want 0", len(list))
		}
	})

	t.Run("bob get returns ErrNotFound", func(t *testing.T) {
		_, err := r.GetReceivable(bobCtx, aliceReceivable.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetReceivable: want ErrNotFound, got %v", err)
		}
	})

	// ----- Bob can't mutate Alice's receivable -------------------------

	t.Run("bob update returns ErrNotFound", func(t *testing.T) {
		_, err := r.UpdateReceivable(bobCtx, aliceReceivable.ID, repo.UpdateReceivableParams{
			DisplayName:      "stolen!",
			CounterpartyName: "Brother",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateReceivable: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete returns ErrNotFound", func(t *testing.T) {
		err := r.DeleteReceivable(bobCtx, aliceReceivable.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteReceivable: want ErrNotFound, got %v", err)
		}
	})

	// ----- Bob can't observe or mutate Alice's snapshots ---------------

	t.Run("bob list snapshots is empty", func(t *testing.T) {
		snaps, err := r.ListReceivableSnapshots(bobCtx, aliceReceivable.ID)
		if err != nil {
			t.Fatalf("ListReceivableSnapshots: %v", err)
		}
		if len(snaps) != 0 {
			t.Errorf("bob saw %d snapshots; want 0", len(snaps))
		}
	})

	t.Run("bob create snapshot under alice's receivable is not allowed", func(t *testing.T) {
		_, err := r.CreateReceivableSnapshot(bobCtx, repo.CreateReceivableSnapshotParams{
			ReceivableID: aliceReceivable.ID,
			YearMonth:    time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Amount:       decimal.NewFromInt(999),
			Currency:     "IDR",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("CreateReceivableSnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update alice's snapshot is not allowed", func(t *testing.T) {
		_, err := r.UpdateReceivableSnapshot(bobCtx, repo.UpdateReceivableSnapshotParams{
			SnapshotID: aliceSnap.ID,
			Amount:     decimal.NewFromInt(7),
			Currency:   "IDR",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateReceivableSnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete alice's snapshot is not allowed", func(t *testing.T) {
		err := r.DeleteReceivableSnapshot(bobCtx, aliceSnap.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteReceivableSnapshot: want ErrNotFound, got %v", err)
		}
	})

	// ----- Sanity: Alice still sees her stuff -------------------------

	t.Run("alice still sees her receivable and snapshot", func(t *testing.T) {
		list, err := r.ListReceivables(aliceCtx)
		if err != nil {
			t.Fatalf("ListReceivables: %v", err)
		}
		if len(list) != 1 {
			t.Fatalf("alice saw %d receivables; want 1", len(list))
		}
		if list[0].LatestSnapshot == nil || list[0].LatestSnapshot.ID != aliceSnap.ID {
			t.Errorf("alice's latest_snapshot mismatch: %+v", list[0].LatestSnapshot)
		}
	})
}
