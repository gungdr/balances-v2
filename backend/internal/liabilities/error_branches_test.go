package liabilities_test

import (
	"net/http"
	"testing"
)

// TestLiabilityHandlers_ErrorBranches consolidates the 400-branch tests that
// don't fit naturally inside the per-resource Create/Update/Delete suites:
// invalid-UUID path params on PATCH/DELETE, malformed JSON bodies on PATCH,
// and validator failures on snapshot Update.
func TestLiabilityHandlers_ErrorBranches(t *testing.T) {
	h := newHarness(t)
	parent := h.createLiability(t, "Error branches parent", "personal")
	snap := h.createSnapshot(t, parent.ID, "2026-01")

	t.Run("liability PATCH invalid id", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/liabilities/not-a-uuid", map[string]any{
			"display_name":      "x",
			"counterparty_name": "y",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("liability PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/liabilities/"+parent.ID.String(), "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("liability PATCH missing required display_name", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/liabilities/"+parent.ID.String(), map[string]any{
			"counterparty_name": "y",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("liability PATCH bad start_date", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/liabilities/"+parent.ID.String(), map[string]any{
			"display_name":      "x",
			"counterparty_name": "y",
			"start_date":        "07/15/2026",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("liability DELETE invalid id", func(t *testing.T) {
		rec := h.do(t, "DELETE", "/liabilities/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot list invalid liability id", func(t *testing.T) {
		rec := h.do(t, "GET", "/liabilities/not-a-uuid/snapshots", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot POST invalid liability id", func(t *testing.T) {
		rec := h.do(t, "POST", "/liabilities/not-a-uuid/snapshots", map[string]any{
			"year_month": "2026-06",
			"amount":     "1000",
			"currency":   "IDR",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot POST invalid json", func(t *testing.T) {
		rec := h.do(t, "POST", "/liabilities/"+parent.ID.String()+"/snapshots", "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot POST bad as_of_date", func(t *testing.T) {
		rec := h.do(t, "POST", "/liabilities/"+parent.ID.String()+"/snapshots", map[string]any{
			"year_month": "2026-06",
			"amount":     "1000",
			"currency":   "IDR",
			"as_of_date": "07/15/2026",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/liabilities/"+parent.ID.String()+"/snapshots/not-a-uuid",
			map[string]any{"amount": "1", "currency": "IDR"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/liabilities/"+parent.ID.String()+"/snapshots/"+snap.ID.String(),
			"{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH missing required amount", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/liabilities/"+parent.ID.String()+"/snapshots/"+snap.ID.String(),
			map[string]any{"currency": "IDR"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH bad as_of_date", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/liabilities/"+parent.ID.String()+"/snapshots/"+snap.ID.String(),
			map[string]any{
				"amount":     "1",
				"currency":   "IDR",
				"as_of_date": "tomorrow",
			})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot DELETE invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "DELETE",
			"/liabilities/"+parent.ID.String()+"/snapshots/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}
