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

// TestVehicleRepo_TenancyIsolation parallels the property leak test for
// the vehicle subtype.
func TestVehicleRepo_TenancyIsolation(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	aliceUser := testutil.CreateHouseholdWithUser(t, q, "Alice")
	bobUser := testutil.CreateHouseholdWithUser(t, q, "Bob")

	aliceCtx := auth.WithUser(context.Background(), aliceUser)
	bobCtx := auth.WithUser(context.Background(), bobUser)

	r := repo.NewAssetRepo(tdb.Pool)

	aliceVehicle, err := r.CreateVehicle(aliceCtx, repo.CreateVehicleParams{
		DisplayName:    "Alice Car",
		OwnershipType:  "joint",
		NativeCurrency: "IDR",
		VehicleType:    "car",
	})
	if err != nil {
		t.Fatalf("alice CreateVehicle: %v", err)
	}

	t.Run("bob list excludes alice's vehicle", func(t *testing.T) {
		list, err := r.ListVehicles(bobCtx)
		if err != nil {
			t.Fatalf("ListVehicles: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("bob saw %d vehicles; want 0", len(list))
		}
	})

	t.Run("bob get returns ErrNotFound", func(t *testing.T) {
		_, err := r.GetVehicle(bobCtx, aliceVehicle.Asset.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetVehicle: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob update returns ErrNotFound", func(t *testing.T) {
		_, err := r.UpdateVehicle(bobCtx, aliceVehicle.Asset.ID, repo.UpdateVehicleParams{
			DisplayName: "stolen!",
			VehicleType: "car",
		})
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("UpdateVehicle: want ErrNotFound, got %v", err)
		}
	})

	t.Run("bob delete returns ErrNotFound", func(t *testing.T) {
		err := r.DeleteVehicle(bobCtx, aliceVehicle.Asset.ID)
		if !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("DeleteVehicle: want ErrNotFound, got %v", err)
		}
	})
}
