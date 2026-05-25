package liabilities

import (
	"encoding/json"
	"net/http"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

// updateLifecycleReq is the body for PATCH /liabilities/{id}/lifecycle. See the
// assets package twin for the validation rationale.
type updateLifecycleReq struct {
	Status          string  `json:"status"           validate:"required"`
	TerminatedAt    *string `json:"terminated_at"    validate:"required_unless=Status active"`
	TerminationNote *string `json:"termination_note"`
}

func (h *Handlers) handleUpdateLifecycle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateLifecycleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	terminatedAt, err := parseOptionalDate(req.TerminatedAt, "terminated_at")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	liability, err := h.repo.UpdateLiabilityLifecycle(r.Context(), id, repo.LifecycleParams{
		Status:          req.Status,
		TerminatedAt:    terminatedAt,
		TerminationNote: req.TerminationNote,
	})
	if err != nil {
		writeRepoError(w, "update liability lifecycle", err)
		return
	}
	writeJSON(w, http.StatusOK, liability)
}
