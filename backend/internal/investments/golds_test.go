package investments_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

func (h *handlerHarness) createGold(t *testing.T, displayName string) *repo.Gold {
	t.Helper()
	rec := h.do(t, "POST", "/investments/golds", map[string]any{
		"display_name":    displayName,
		"ownership_type":  "joint",
		"native_currency": "IDR",
		"form":            "bar",
		"purity":          "0.9999",
		"risk_profile":    "medium",
	})
	requireStatus(t, rec, http.StatusCreated)
	return decodeBody[*repo.Gold](t, rec)
}

func TestGoldHandlers_Create(t *testing.T) {
	h := newHarness(t)

	t.Run("201 happy path", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/golds", map[string]any{
			"display_name":    "Antam 100g",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"form":            "bar",
			"purity":          "0.9999",
			"risk_profile":    "medium",
		})
		requireStatus(t, rec, http.StatusCreated)
		body := decodeBody[*repo.Gold](t, rec)
		if body.Details.Form != "bar" {
			t.Errorf("form: got %q", body.Details.Form)
		}
	})

	t.Run("400 invalid form enum", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/golds", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"form":            "ingot",
			"purity":          "0.99",
			"risk_profile":    "medium",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 missing required purity", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/golds", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"form":            "coin",
			"risk_profile":    "medium",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestGoldHandlers_List(t *testing.T) {
	h := newHarness(t)
	h.createGold(t, "Listed gold")

	rec := h.do(t, "GET", "/investments/golds", nil)
	requireStatus(t, rec, http.StatusOK)
	list := decodeBody[[]repo.GoldListItem](t, rec)
	if len(list) != 1 {
		t.Fatalf("list length: want 1, got %d", len(list))
	}
}

func TestGoldHandlers_Get(t *testing.T) {
	h := newHarness(t)
	created := h.createGold(t, "Get target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/golds/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusOK)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/golds/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 invalid id format", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/golds/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestGoldHandlers_Update(t *testing.T) {
	h := newHarness(t)
	created := h.createGold(t, "Update target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/golds/"+created.Investment.ID.String(), map[string]any{
			"display_name":   "Renamed",
			"ownership_type": "joint",
			"form":           "coin",
			"purity":         "0.9999",
			"risk_profile":   "medium",
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Gold](t, rec)
		if body.Details.Form != "coin" {
			t.Errorf("form: want coin, got %q", body.Details.Form)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/golds/"+uuid.NewString(), map[string]any{
			"display_name":   "x",
			"ownership_type": "joint",
			"form":           "bar",
			"purity":         "0.99",
			"risk_profile":   "medium",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 missing required purity", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/golds/"+created.Investment.ID.String(), map[string]any{
			"display_name": "x",
			"form":         "bar",
			"risk_profile": "medium",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestGoldHandlers_Delete(t *testing.T) {
	h := newHarness(t)

	t.Run("204 happy path", func(t *testing.T) {
		created := h.createGold(t, "To delete")
		rec := h.do(t, "DELETE", "/investments/golds/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusNoContent)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/investments/golds/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})
}
