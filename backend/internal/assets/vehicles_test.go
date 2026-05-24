package assets_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

func (h *handlerHarness) createVehicle(t *testing.T, displayName string) *repo.Vehicle {
	t.Helper()
	rec := h.do(t, "POST", "/vehicles", map[string]any{
		"display_name":    displayName,
		"ownership_type":  "joint",
		"native_currency": "IDR",
		"vehicle_type":    "car",
	})
	requireStatus(t, rec, http.StatusCreated)
	return decodeBody[*repo.Vehicle](t, rec)
}

func TestVehicleHandlers_Create(t *testing.T) {
	h := newHarness(t)

	t.Run("201 happy path", func(t *testing.T) {
		rec := h.do(t, "POST", "/vehicles", map[string]any{
			"display_name":             "Family car",
			"ownership_type":           "joint",
			"native_currency":          "IDR",
			"vehicle_type":             "car",
			"make":                     "Toyota",
			"model":                    "Avanza",
			"year":                     2020,
			"plate_number":             "B 1234 ABC",
			"annual_depreciation_rate": "10",
		})
		requireStatus(t, rec, http.StatusCreated)
		body := decodeBody[*repo.Vehicle](t, rec)
		if body.Asset.DisplayName != "Family car" {
			t.Errorf("display_name: got %q", body.Asset.DisplayName)
		}
		if body.Details.VehicleType != "car" {
			t.Errorf("vehicle_type: got %q", body.Details.VehicleType)
		}
	})

	t.Run("400 invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/vehicles", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 invalid vehicle_type enum", func(t *testing.T) {
		rec := h.do(t, "POST", "/vehicles", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"vehicle_type":    "bicycle",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 missing required display_name", func(t *testing.T) {
		rec := h.do(t, "POST", "/vehicles", map[string]any{
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"vehicle_type":    "car",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestVehicleHandlers_List(t *testing.T) {
	h := newHarness(t)
	created := h.createVehicle(t, "Listed vehicle")

	rec := h.do(t, "GET", "/vehicles", nil)
	requireStatus(t, rec, http.StatusOK)
	list := decodeBody[[]repo.VehicleListItem](t, rec)
	if len(list) != 1 {
		t.Fatalf("list length: want 1, got %d", len(list))
	}
	if list[0].Asset.ID != created.Asset.ID {
		t.Errorf("list[0] id: want %s, got %s", created.Asset.ID, list[0].Asset.ID)
	}
}

func TestVehicleHandlers_Get(t *testing.T) {
	h := newHarness(t)
	created := h.createVehicle(t, "Get target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "GET", "/vehicles/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Vehicle](t, rec)
		if body.Asset.ID != created.Asset.ID {
			t.Errorf("id: want %s, got %s", created.Asset.ID, body.Asset.ID)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "GET", "/vehicles/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 invalid id format", func(t *testing.T) {
		rec := h.do(t, "GET", "/vehicles/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestVehicleHandlers_Update(t *testing.T) {
	h := newHarness(t)
	created := h.createVehicle(t, "Update target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/vehicles/"+created.Asset.ID.String(), map[string]any{
			"display_name":   "Renamed",
			"ownership_type": "joint",
			"vehicle_type":   "motorcycle",
			"make":           "Honda",
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Vehicle](t, rec)
		if body.Asset.DisplayName != "Renamed" {
			t.Errorf("display_name: want Renamed, got %q", body.Asset.DisplayName)
		}
		if body.Details.VehicleType != "motorcycle" {
			t.Errorf("vehicle_type: want motorcycle, got %q", body.Details.VehicleType)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/vehicles/"+uuid.NewString(), map[string]any{
			"display_name":   "x",
			"ownership_type": "joint",
			"vehicle_type":   "car",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 missing required vehicle_type", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/vehicles/"+created.Asset.ID.String(), map[string]any{
			"display_name": "x",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestVehicleHandlers_Delete(t *testing.T) {
	h := newHarness(t)

	t.Run("204 happy path", func(t *testing.T) {
		created := h.createVehicle(t, "To delete")
		rec := h.do(t, "DELETE", "/vehicles/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusNoContent)

		rec = h.do(t, "GET", "/vehicles/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/vehicles/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})
}
