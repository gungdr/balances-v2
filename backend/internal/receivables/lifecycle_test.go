package receivables_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

// TestReceivableHandlers_Lifecycle covers PATCH /receivables/{id}/lifecycle:
// the happy terminate path, the validator's required_unless guard (terminal
// status needs a date), the repo's biconditional (active must not carry a
// date), unknown status, plus the bad-id / bad-json / unknown-id branches. The
// handler shape is shared with the assets/liabilities/investments packages.
func TestReceivableHandlers_Lifecycle(t *testing.T) {
	h := newHarness(t)
	parent := h.createReceivable(t, "Lifecycle parent")
	base := "/receivables/" + parent.ID.String() + "/lifecycle"

	type lifecycleResp struct {
		Status       string  `json:"status"`
		TerminatedAt *string `json:"terminated_at"`
	}

	t.Run("terminate happy path", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, map[string]any{
			"status":           "collected",
			"terminated_at":    "2026-05-25",
			"termination_note": "fully repaid",
		})
		requireStatus(t, rec, http.StatusOK)
		got := decodeBody[lifecycleResp](t, rec)
		if got.Status != "collected" || got.TerminatedAt == nil {
			t.Fatalf("unexpected body: %+v", got)
		}
	})

	t.Run("terminal status without date is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, map[string]any{"status": "collected"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("active status with date is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, map[string]any{
			"status": "active", "terminated_at": "2026-05-25",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("unknown status is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, map[string]any{
			"status": "frozen", "terminated_at": "2026-05-25",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("bad date format is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, map[string]any{
			"status": "collected", "terminated_at": "05/25/2026",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("invalid id is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/receivables/not-a-uuid/lifecycle", map[string]any{
			"status": "collected", "terminated_at": "2026-05-25",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("invalid json is 400", func(t *testing.T) {
		rec := h.do(t, "PATCH", base, "{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("unknown id is 404", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/receivables/"+uuid.NewString()+"/lifecycle", map[string]any{
			"status": "collected", "terminated_at": "2026-05-25",
		})
		requireStatus(t, rec, http.StatusNotFound)
	})
}
