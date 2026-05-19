package repo_test

import (
	"context"
	"errors"
	"testing"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/repo"
	"github.com/kerti/balances-v2/backend/internal/testutil"
)

// TestPropertyRepo_TenancyIsolation mirrors TestAssetRepo_TenancyIsolation
// for the property subtype. Snapshot-level tenancy is already covered by
// the bank-account leak test (asset snapshots share one table), so this
// test focuses on the property-specific repo surface only.
func TestPropertyRepo_TenancyIsolation(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bobUser := testutil.CreateHouseholdWithUser(t, q, "Bob")

	aliceCtx := auth.WithUser(context.Background(), aliceUser)
	bobCtx := auth.WithUser(context.Background(), bobUser)

	r := repo.NewAssetRepo(tdb.Pool)

	aliceProperty, err := r.CreateProperty(aliceCtx, repo.CreatePropertyParams{
		DisplayName:    "Alice House",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		PropertyType:   "house",
	})
	if err != nil {
		t.Fatalf("alice CreateProperty: %v", err)
	}

	t.Run("bob list excludes alice's property", func(t *testing.T) {
		list, err := r.ListProperties(bobCtx)
		if err != nil {
			t.Fatalf("ListProperties: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d properties; want 0", len(list))
		}
	})

	t.Run("bob get returns ErrNotFound", func(t *testing.T) {
		_, err := r.GetProperty(bobCtx, aliceProperty.Asset.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetProperty: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update returns ErrNotFound", func(t *testing.T) {
		_, err := r.UpdateProperty(bobCtx, aliceProperty.Asset.ID, repo.UpdatePropertyParams{
			DisplayName:  "stolen!",
			PropertyType: "house",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateProperty: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete returns ErrNotFound", func(t *testing.T) {
		err := r.DeleteProperty(bobCtx, aliceProperty.Asset.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteProperty: want ErrNotFound, got %v", err)
		}
	})

	t.Run("alice's property accessed via bank-account or vehicle methods returns ErrNotFound", func(t *testing.T) {
		// Subtype guard: even from alice's own context, fetching a property
		// via GetBankAccount or GetVehicle must return ErrNotFound.
		if _, err := r.GetBankAccount(aliceCtx, aliceProperty.Asset.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetBankAccount on property id: want ErrNotFound, got %v", err)
		}
		if _, err := r.GetVehicle(aliceCtx, aliceProperty.Asset.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetVehicle on property id: want ErrNotFound, got %v", err)
		}
		if err := r.DeleteBankAccount(aliceCtx, aliceProperty.Asset.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteBankAccount on property id: want ErrNotFound, got %v", err)
		}
	})
}
