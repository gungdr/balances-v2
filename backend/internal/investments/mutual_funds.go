package investments

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

type createMutualFundReq struct {
	DisplayName     string     `json:"display_name"       validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	NativeCurrency  string     `json:"native_currency"    validate:"required,iso4217"`
	RiskProfile     string     `json:"risk_profile"       validate:"required,oneof=low medium high"`
	FundCode        string     `json:"fund_code"          validate:"required"`
	FundManager     *string    `json:"fund_manager"`
}

type updateMutualFundReq struct {
	DisplayName     string     `json:"display_name"       validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	RiskProfile     string     `json:"risk_profile"       validate:"required,oneof=low medium high"`
	FundCode        string     `json:"fund_code"          validate:"required"`
	FundManager     *string    `json:"fund_manager"`
}

func (h *Handlers) handleCreateMutualFund(w http.ResponseWriter, r *http.Request) {
	var req createMutualFundReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	mf, err := h.repo.CreateMutualFund(r.Context(), repo.CreateMutualFundParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		NativeCurrency:  req.NativeCurrency,
		RiskProfile:     req.RiskProfile,
		FundCode:        req.FundCode,
		FundManager:     req.FundManager,
	})
	if err != nil {
		writeRepoError(w, "create mutual fund", err)
		return
	}
	writeJSON(w, http.StatusCreated, mf)
}

func (h *Handlers) handleListMutualFunds(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListMutualFunds(r.Context())
	if err != nil {
		writeRepoError(w, "list mutual funds", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetMutualFund(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	mf, err := h.repo.GetMutualFund(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get mutual fund", err)
		return
	}
	writeJSON(w, http.StatusOK, mf)
}

func (h *Handlers) handleUpdateMutualFund(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateMutualFundReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	mf, err := h.repo.UpdateMutualFund(r.Context(), id, repo.UpdateMutualFundParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		RiskProfile:     req.RiskProfile,
		FundCode:        req.FundCode,
		FundManager:     req.FundManager,
	})
	if err != nil {
		writeRepoError(w, "update mutual fund", err)
		return
	}
	writeJSON(w, http.StatusOK, mf)
}

func (h *Handlers) handleDeleteMutualFund(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteMutualFund(r.Context(), id); err != nil {
		writeRepoError(w, "delete mutual fund", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
