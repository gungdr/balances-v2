package investments

import (
	"encoding/json"
	"net/http"

	"github.com/kerti/balances-v2/backend/internal/httperr"
	"github.com/kerti/balances-v2/backend/internal/repo"
)

// updateLifecycleReq is the body for PATCH /investments/{id}/lifecycle. See the
// assets package twin for the validation rationale. Note: a Bond/TimeDeposit
// reaches 'matured' automatically via a Maturity transaction (the repo flips
// it); this endpoint covers manual terminal states (e.g. a Stock sold off).
type updateLifecycleReq struct {
	Status          string  `json:"status"           validate:"required"`
	TerminatedAt    *string `json:"terminated_at"    validate:"required_unless=Status active"`
	TerminationNote *string `json:"termination_note"`
}

func (h *Handlers) handleUpdateLifecycle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	var req updateLifecycleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httperr.Write(w, http.StatusBadRequest, httperr.CodeInvalidJSONBody, nil)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		httperr.WriteValidation(w, err)
		return
	}
	terminatedAt, ok := parseOptionalDate(req.TerminatedAt)
	if !ok {
		writeInvalidDate(w, "terminated_at")
		return
	}

	investment, err := h.repo.UpdateInvestmentLifecycle(r.Context(), id, repo.LifecycleParams{
		Status:          req.Status,
		TerminatedAt:    terminatedAt,
		TerminationNote: req.TerminationNote,
	})
	if err != nil {
		httperr.WriteRepo(w, "update investment lifecycle", err)
		return
	}
	writeJSON(w, http.StatusOK, investment)
}
