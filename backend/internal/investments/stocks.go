package investments

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

type createStockReq struct {
	DisplayName     string     `json:"display_name"       validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	NativeCurrency  string     `json:"native_currency"    validate:"required,iso4217"`
	Ticker          string     `json:"ticker"             validate:"required"`
	Exchange        string     `json:"exchange"           validate:"required"`
}

type updateStockReq struct {
	DisplayName     string     `json:"display_name"       validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	Ticker          string     `json:"ticker"             validate:"required"`
	Exchange        string     `json:"exchange"           validate:"required"`
}

func (h *Handlers) handleCreateStock(w http.ResponseWriter, r *http.Request) {
	var req createStockReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	stock, err := h.repo.CreateStock(r.Context(), repo.CreateStockParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		NativeCurrency:  req.NativeCurrency,
		Ticker:          req.Ticker,
		Exchange:        req.Exchange,
	})
	if err != nil {
		writeRepoError(w, "create stock", err)
		return
	}
	writeJSON(w, http.StatusCreated, stock)
}

func (h *Handlers) handleListStocks(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListStocks(r.Context())
	if err != nil {
		writeRepoError(w, "list stocks", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetStock(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	stock, err := h.repo.GetStock(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get stock", err)
		return
	}
	writeJSON(w, http.StatusOK, stock)
}

func (h *Handlers) handleUpdateStock(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateStockReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	stock, err := h.repo.UpdateStock(r.Context(), id, repo.UpdateStockParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		Ticker:          req.Ticker,
		Exchange:        req.Exchange,
	})
	if err != nil {
		writeRepoError(w, "update stock", err)
		return
	}
	writeJSON(w, http.StatusOK, stock)
}

func (h *Handlers) handleDeleteStock(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteStock(r.Context(), id); err != nil {
		writeRepoError(w, "delete stock", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
