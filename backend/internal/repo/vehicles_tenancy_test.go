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

	// ----- Alice happy-path CRUD on her own vehicle --------------------

	t.Run("alice update vehicle persists new display_name", func(t *testing.T) {
		updated, err := r.UpdateVehicle(aliceCtx, aliceVehicle.Asset.ID, repo.UpdateVehicleParams{
			DisplayName: "Alice Car renamed",
			VehicleType: "car",
		})
		if err != nil {
			t.Fatalf("UpdateVehicle: %v", err)
		}
		if updated.Asset.DisplayName != "Alice Car renamed" {
			t.Errorf("DisplayName: got %q, want %q", updated.Asset.DisplayName, "Alice Car renamed")
		}
	})

	t.Run("alice delete vehicle removes it from get and list", func(t *testing.T) {
		if err := r.DeleteVehicle(aliceCtx, aliceVehicle.Asset.ID); err != nil {
			t.Fatalf("DeleteVehicle: %v", err)
		}
		if _, err := r.GetVehicle(aliceCtx, aliceVehicle.Asset.ID); !errors.Is(err, repo.ErrNotFound) {
			t.Errorf("GetVehicle after delete: want ErrNotFound, got %v", err)
		}
		list, err := r.ListVehicles(aliceCtx)
		if err != nil {
			t.Fatalf("ListVehicles after delete: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("ListVehicles after delete: got %d, want 0", len(list))
		}
	})
}
