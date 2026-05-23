package investments_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

func (h *handlerHarness) createMutualFund(t *testing.T, displayName string) *repo.MutualFund {
	t.Helper()
	rec := h.do(t, "POST", "/investments/mutual-funds", map[string]any{
		"display_name":    displayName,
		"ownership_type":  "joint",
		"native_currency": "IDR",
		"fund_code":       "BNI-AM",
	})
	requireStatus(t, rec, http.StatusCreated)
	return decodeBody[*repo.MutualFund](t, rec)
}

func TestMutualFundHandlers_Create(t *testing.T) {
	h := newHarness(t)

	t.Run("201 happy path", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/mutual-funds", map[string]any{
			"display_name":    "Sucorinvest Money Market",
			"ownership_type":  "joint",
			"native_currency": "IDR",
			"fund_code":       "SMMF",
			"fund_manager":    "Sucorinvest AM",
		})
		requireStatus(t, rec, http.StatusCreated)
		body := decodeBody[*repo.MutualFund](t, rec)
		if body.Details.FundCode != "SMMF" {
			t.Errorf("fund_code: got %q", body.Details.FundCode)
		}
	})

	t.Run("400 missing required fund_code", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/mutual-funds", map[string]any{
			"display_name":    "X",
			"ownership_type":  "joint",
			"native_currency": "IDR",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("400 invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/investments/mutual-funds", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestMutualFundHandlers_List(t *testing.T) {
	h := newHarness(t)
	created := h.createMutualFund(t, "Listed MF")

	rec := h.do(t, "GET", "/investments/mutual-funds", nil)
	requireStatus(t, rec, http.StatusOK)
	list := decodeBody[[]repo.MutualFundListItem](t, rec)
	if len(list) != 1 {
		t.Fatalf("list length: want 1, got %d", len(list))
	}
	if list[0].Investment.ID != created.Investment.ID {
		t.Errorf("list[0] id mismatch")
	}
}

func TestMutualFundHandlers_Get(t *testing.T) {
	h := newHarness(t)
	created := h.createMutualFund(t, "Get target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/mutual-funds/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusOK)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/mutual-funds/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 invalid id format", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/mutual-funds/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestMutualFundHandlers_Update(t *testing.T) {
	h := newHarness(t)
	created := h.createMutualFund(t, "Update target")

	t.Run("200 happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/mutual-funds/"+created.Investment.ID.String(), map[string]any{
			"display_name": "Renamed",
			"fund_code":    "NEWCODE",
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[*repo.MutualFund](t, rec)
		if body.Details.FundCode != "NEWCODE" {
			t.Errorf("fund_code: want NEWCODE, got %q", body.Details.FundCode)
		}
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/mutual-funds/"+uuid.NewString(), map[string]any{
			"display_name": "x",
			"fund_code":    "x",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})

	t.Run("400 missing required display_name", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/mutual-funds/"+created.Investment.ID.String(), map[string]any{
			"fund_code": "x",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})
}

func TestMutualFundHandlers_Delete(t *testing.T) {
	h := newHarness(t)

	t.Run("204 happy path", func(t *testing.T) {
		created := h.createMutualFund(t, "To delete")
		rec := h.do(t, "DELETE", "/investments/mutual-funds/"+created.Investment.ID.String(), nil)
		requireStatus(t, rec, http.StatusNoContent)
	})

	t.Run("404 unknown id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/investments/mutual-funds/"+uuid.NewString(), nil)
		requireStatus(t, rec, http.StatusNotFound)
	})
}
