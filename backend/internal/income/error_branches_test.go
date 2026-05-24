package income_test

import (
	"net/http"
	"testing"
)

// TestIncomeHandlers_ErrorBranches consolidates 400-branch tests that don't
// fit naturally in the per-resource Create/Update/Delete suites: invalid-UUID
// path params, malformed JSON bodies on PATCH, bad-date on PATCH (Create
// already covers the POST branch).
func TestIncomeHandlers_ErrorBranches(t *testing.T) {
	h := newHarness(t)
	row := h.createIncome(t, "salary")

	t.Run("PATCH invalid id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/income/not-a-uuid", map[string]any{
			"date":           "2026-05-15",
			"amount":         "1",
			"currency":       "IDR",
			"category":       "salary",
			"ownership_type": "joint",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/income/"+row.ID.String(), "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("PATCH bad date", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/income/"+row.ID.String(), map[string]any{
			"date":           "yesterday",
			"amount":         "1",
			"currency":       "IDR",
			"category":       "salary",
			"ownership_type": "joint",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("PATCH zero amount", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/income/"+row.ID.String(), map[string]any{
			"date":           "2026-05-15",
			"amount":         "0",
			"currency":       "IDR",
			"category":       "salary",
			"ownership_type": "joint",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("DELETE invalid id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/income/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}
