package assets

import (
	"encoding/json"
	"net/http"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

// updateLifecycleReq is the body for PATCH /assets/{id}/lifecycle. Status is
// validated against the asset status set in the repo (single source of truth);
// terminated_at is required for any terminal status and rejected for 'active'
// (required_unless here, the full biconditional in the repo + DB CHECK).
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

	asset, err := h.repo.UpdateAssetLifecycle(r.Context(), id, repo.LifecycleParams{
		Status:          req.Status,
		TerminatedAt:    terminatedAt,
		TerminationNote: req.TerminationNote,
	})
	if err != nil {
		writeRepoError(w, "update asset lifecycle", err)
		return
	}
	writeJSON(w, http.StatusOK, asset)
}
