package assets_test

import (
	"net/http"
	"testing"
)

// TestAssetHandlers_ErrorBranches consolidates the small 400-branch tests that
// don't fit naturally inside the per-resource Create/Update/Delete suites:
// invalid-UUID path params on PATCH/DELETE, malformed JSON bodies on PATCH,
// and validator failures on snapshot Update. The existing per-resource suites
// already cover the GET-by-id invalid-id path and the POST invalid-json path.
func TestAssetHandlers_ErrorBranches(t *testing.T) {
	h := newHarness(t)
	parent := h.createBankAccount(t, "Error branches parent")
	property := h.createProperty(t, "Property branches parent")
	vehicle := h.createVehicle(t, "Vehicle branches parent")
	snap := h.createAssetSnapshot(t, parent.Asset.ID, "2026-01")

	t.Run("bank-account PATCH invalid id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/bank-accounts/not-a-uuid", map[string]any{
			"display_name":   "x",
			"bank_name":      "y",
			"account_number": "1",
			"account_type":   "savings",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("bank-account PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/bank-accounts/"+parent.Asset.ID.String(), "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("bank-account DELETE invalid id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/bank-accounts/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("property PATCH invalid id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/not-a-uuid", map[string]any{
			"display_name":  "x",
			"property_type": "house",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("property PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+property.Asset.ID.String(), "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("property PATCH bad acquisition_date format", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+property.Asset.ID.String(), map[string]any{
			"display_name":     "x",
			"property_type":    "house",
			"acquisition_date": "07/15/2026",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("property DELETE invalid id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/properties/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("vehicle PATCH invalid id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/vehicles/not-a-uuid", map[string]any{
			"display_name": "x",
			"vehicle_type": "car",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("vehicle PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/vehicles/"+vehicle.Asset.ID.String(), "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("vehicle DELETE invalid id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/vehicles/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot list invalid asset id", func(t *testing.T) {
		rec := h.do(t, "GET", "/assets/not-a-uuid/snapshots", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot POST invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/assets/"+parent.Asset.ID.String()+"/snapshots", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/assets/"+parent.Asset.ID.String()+"/snapshots/not-a-uuid", map[string]any{
			"amount":   "1",
			"currency": "IDR",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/assets/"+parent.Asset.ID.String()+"/snapshots/"+snap.ID.String(),
			"{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH missing required amount", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/assets/"+parent.Asset.ID.String()+"/snapshots/"+snap.ID.String(),
			map[string]any{"currency": "IDR"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot DELETE invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "DELETE",
			"/assets/"+parent.Asset.ID.String()+"/snapshots/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}
