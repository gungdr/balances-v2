package assets_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

func (h *handlerHarness) createProperty(t *testing.T, displayName string) *repo.Property {
	t.Helper()
	rec := h.do(t, "POST", "/properties", map[string]any{
		"display_name":    displayName,
		"ownership_type":  "joint",
		"native_currency": "IDR",
		"property_type":   "house",
	})
	requireStatus(t, rec, http.StatusCreated)
	return decodeBody[*repo.Property](t, rec)
}

func TestPropertyHandlers_Create(t *testing.T) {
	h := newHarness(t)

	t.Run("201 happy path", func(t *testing.T) {
		rec := h.do(t, "POST", "/properties", map[string]any{
			"display_name":             "Family home",
			"ownership_type":           "joint",
			"native_currency":          "IDR",
			"property_type":            "house",
			"address":                  "Jl. Mawar No. 42",
			"acquisition_date":         "2018-06-15",
			"acquisition_cost":         "2500000000",
			"annual_amortization_rate": "2.5",
		})
		requireStatus(t, rec, http.StatusCreated)
		body := decodeBody[*repo.Property](t, rec)
		if body.Asset.DisplayName != "Family home" {
			t.Errorf("display_name: got %q", body.Asset.DisplayName)
		}
		if body.Details.PropertyType != "house" {
			t.Errorf("property_type: got %q", body.Details.PropertyType)
		}
	})

	t.Run("400 invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/properties", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 invalid property_type enum", func(t *testing.T) {
		rec := h.do(t, "POST", "/properties", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"property_type":   "yacht",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 bad acquisition_date format", func(t *testing.T) {
		rec := h.do(t, "POST", "/properties", map[string]any{
			"display_name":     "X",
			"ownership_type":   "joint",
			"native_currency":  "IDR",
			"property_type":    "land",
			"acquisition_date": "15-06-2018",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestPropertyHandlers_List(t *testing.T) {
	h := newHarness(t)
	created := h.createProperty(t, "Listed property")

	rec := h.do(t, "GET", "/properties", nil)
	requireStatus(t, rec, http.StatusOK)
	list := decodeBody[[]repo.PropertyListItem](t, rec)
	if len(list) != 1 {
		t.Fatalf("list length: want 1, got %d", len(list))
	}
	if list[0].Asset.ID != created.Asset.ID {
		t.Errorf("list[0] id: want %s, got %s", created.Asset.ID, list[0].Asset.ID)
	}
}

func TestPropertyHandlers_Get(t *testing.T) {
	h := newHarness(t)
	created := h.createProperty(t, "Get target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "GET", "/properties/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Property](t, rec)
		if body.Asset.ID != created.Asset.ID {
			t.Errorf("id: want %s, got %s", created.Asset.ID, body.Asset.ID)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "GET", "/properties/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 invalid id format", func(t *testing.T) {
		rec := h.do(t, "GET", "/properties/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestPropertyHandlers_Update(t *testing.T) {
	h := newHarness(t)
	created := h.createProperty(t, "Update target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+created.Asset.ID.String(), map[string]any{
			"display_name":  "Renamed",
			"property_type": "apartment",
			"address":       "New address",
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Property](t, rec)
		if body.Asset.DisplayName != "Renamed" {
			t.Errorf("display_name: want Renamed, got %q", body.Asset.DisplayName)
		}
		if body.Details.PropertyType != "apartment" {
			t.Errorf("property_type: want apartment, got %q", body.Details.PropertyType)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+uuid.NewString(), map[string]any{
			"display_name":  "x",
			"property_type": "land",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 missing required property_type", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+created.Asset.ID.String(), map[string]any{
			"display_name": "x",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 bad acquisition_date format", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/properties/"+created.Asset.ID.String(), map[string]any{
			"display_name":     "x",
			"property_type":    "land",
			"acquisition_date": "15/06/2018",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestPropertyHandlers_Delete(t *testing.T) {
	h := newHarness(t)

	t.Run("204 happy path", func(t *testing.T) {
		created := h.createProperty(t, "To delete")
		rec := h.do(t, "DELETE", "/properties/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusNoContent)

		rec = h.do(t, "GET", "/properties/"+created.Asset.ID.String(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/properties/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})
}
