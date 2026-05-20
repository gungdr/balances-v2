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

// TestLiabilityRepo_TenancyIsolation verifies cross-Household isolation for
// the Liability position group and its dedicated liability_snapshots table.
// Unlike Asset leak tests where snapshot tenancy is covered once for all
// subtypes, each group has its own snapshot table per ADR-0022, so this
// test exercises both core CRUD and snapshot CRUD.
func TestLiabilityRepo_TenancyIsolation(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bobUser := testutil.CreateHouseholdWithUser(t, q, "Bob")

	if aliceUser.HouseholdID == bobUser.HouseholdID {
		t.Fatalf("fixture: alice and bob ended up in the same household")
	}

	aliceCtx := auth.WithUser(context.Background(), aliceUser)
	bobCtx := auth.WithUser(context.Background(), bobUser)

	r := repo.NewLiabilityRepo(tdb.Pool)

	aliceLiability, err := r.CreateLiability(aliceCtx, repo.CreateLiabilityParams{
		DisplayName:      "Alice KPR",
		Subtype:          "institutional",
		OwnershipType:    "joint",
		NativeCurrency:   "IDR",
		CounterpartyName: "Bank BCA",
	})
	if err != nil {
		t.Fatalf("alice CreateLiability: %v", err)
	}

	aliceSnap, err := r.CreateLiabilitySnapshot(aliceCtx, repo.CreateLiabilitySnapshotParams{
		LiabilityID: aliceLiability.ID,
		YearMonth:   time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC),
		Amount:      decimal.NewFromInt(1_400_000_000),
		Currency:    "IDR",
	})
	if err != nil {
		t.Fatalf("alice CreateLiabilitySnapshot: %v", err)
	}

	// ----- Bob can't observe Alice's liability -------------------------

	t.Run("bob list excludes alice's liability", func(t *testing.T) {
		list, err := r.ListLiabilities(bobCtx, nil)
		if err != nil {
			t.Fatalf("ListLiabilities: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d liabilities; want 0", len(list))
		}
	})

	t.Run("bob get returns ErrNotFound", func(t *testing.T) {
		_, err := r.GetLiability(bobCtx, aliceLiability.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetLiability: want ErrNotFound, got %v", err)
		}
	})

	// ----- Bob can't mutate Alice's liability --------------------------

	t.Run("bob update returns ErrNotFound", func(t *testing.T) {
		_, err := r.UpdateLiability(bobCtx, aliceLiability.ID, repo.UpdateLiabilityParams{
			DisplayName:      "stolen!",
			CounterpartyName: "Bank BCA",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateLiability: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete returns ErrNotFound", func(t *testing.T) {
		err := r.DeleteLiability(bobCtx, aliceLiability.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteLiability: want ErrNotFound, got %v", err)
		}
	})

	// ----- Bob can't observe or mutate Alice's snapshots ---------------

	t.Run("bob list snapshots is empty", func(t *testing.T) {
		snaps, err := r.ListLiabilitySnapshots(bobCtx, aliceLiability.ID)
		if err != nil {
			t.Fatalf("ListLiabilitySnapshots: %v", err)
		}
		if len(snaps) != 0 {
			t.Errorf("bob saw %d snapshots; want 0", len(snaps))
		}
	})

	t.Run("bob create snapshot under alice's liability is not allowed", func(t *testing.T) {
		_, err := r.CreateLiabilitySnapshot(bobCtx, repo.CreateLiabilitySnapshotParams{
			LiabilityID: aliceLiability.ID,
			YearMonth:   time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			Amount:      decimal.NewFromInt(999),
			Currency:    "IDR",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("CreateLiabilitySnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update alice's snapshot is not allowed", func(t *testing.T) {
		_, err := r.UpdateLiabilitySnapshot(bobCtx, repo.UpdateLiabilitySnapshotParams{
			SnapshotID: aliceSnap.ID,
			Amount:     decimal.NewFromInt(7),
			Currency:   "IDR",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateLiabilitySnapshot: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete alice's snapshot is not allowed", func(t *testing.T) {
		err := r.DeleteLiabilitySnapshot(bobCtx, aliceSnap.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteLiabilitySnapshot: want ErrNotFound, got %v", err)
		}
	})

	// ----- Sanity: Alice still sees her stuff -------------------------

	t.Run("alice still sees her liability and snapshot", func(t *testing.T) {
		list, err := r.ListLiabilities(aliceCtx, nil)
		if err != nil {
			t.Fatalf("ListLiabilities: %v", err)
		}
		if len(list) != 1 {
			t.Fatalf("alice saw %d liabilities; want 1", len(list))
		}
		if list[0].LatestSnapshot == nil || list[0].LatestSnapshot.ID != aliceSnap.ID {
			t.Errorf("alice's latest_snapshot mismatch: %+v", list[0].LatestSnapshot)
		}
	})
}
