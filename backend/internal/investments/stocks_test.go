package investments_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

func (h *handlerHarness) createStock(t *testing.T, displayName string) *repo.Stock {
	t.Helper()
	rec := h.do(t, "POST", "/investments/stocks", map[string]any{
		"display_name":    displayName,
		"ownership_type":  "joint",
		"native_currency": "IDR",
		"ticker":          "BBCA",
		"exchange":        "IDX",
	})
	requireStatus(t, rec, http.StatusCreated)
	return decodeBody[*repo.Stock](t, rec)
}

func TestStockHandlers_Create(t *testing.T) {
	h := newHarness(t)

	t.Run("201 happy path", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/stocks", map[string]any{
			"display_name":    "Bank Central Asia",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"ticker":          "BBCA",
			"exchange":        "IDX",
		})
		requireStatus(t, rec, http.StatusCreated)
		body := decodeBody[*repo.Stock](t, rec)
		if body.Details.Ticker != "BBCA" {
			t.Errorf("ticker: got %q", body.Details.Ticker)
		}
	})

	t.Run("400 invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/stocks", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 missing required ticker", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/stocks", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"exchange":        "IDX",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestStockHandlers_List(t *testing.T) {
	h := newHarness(t)
	created := h.createStock(t, "Listed stock")

	rec := h.do(t, "GET", "/investments/stocks", nil)
	requireStatus(t, rec, http.StatusOK)
	list := decodeBody[[]repo.StockListItem](t, rec)
	if len(list) != 1 {
		t.Fatalf("list length: want 1, got %d", len(list))
	}
	if list[0].Investment.ID != created.Investment.ID {
		t.Errorf("list[0] id: want %s, got %s", created.Investment.ID, list[0].Investment.ID)
	}
}

func TestStockHandlers_Get(t *testing.T) {
	h := newHarness(t)
	created := h.createStock(t, "Get target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/stocks/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Stock](t, rec)
		if body.Investment.ID != created.Investment.ID {
			t.Errorf("id: want %s, got %s", created.Investment.ID, body.Investment.ID)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/stocks/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 invalid id format", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/stocks/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestStockHandlers_Update(t *testing.T) {
	h := newHarness(t)
	created := h.createStock(t, "Update target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/stocks/"+created.Investment.ID.String(), map[string]any{
			"display_name":   "Renamed",
			"ownership_type": "joint",
			"ticker":         "BBRI",
			"exchange":       "IDX",
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.Stock](t, rec)
		if body.Details.Ticker != "BBRI" {
			t.Errorf("ticker: want BBRI, got %q", body.Details.Ticker)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/stocks/"+uuid.NewString(), map[string]any{
			"display_name":   "x",
			"ownership_type": "joint",
			"ticker":         "x",
			"exchange":       "x",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 missing required ticker", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/stocks/"+created.Investment.ID.String(), map[string]any{
			"display_name": "x",
			"exchange":     "IDX",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestStockHandlers_Delete(t *testing.T) {
	h := newHarness(t)

	t.Run("204 happy path", func(t *testing.T) {
		created := h.createStock(t, "To delete")
		rec := h.do(t, "DELETE", "/investments/stocks/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusNoContent)

		rec = h.do(t, "GET", "/investments/stocks/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/investments/stocks/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})
}
