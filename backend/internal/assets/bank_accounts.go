package assets

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/httperr"
	"github.com/kerti/balances-v2/backend/internal/repo"
)

// ----- requests -----------------------------------------------------------

type createBankAccountReq struct {
	DisplayName     string     `json:"display_name"      validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"    validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	NativeCurrency  string     `json:"native_currency"   validate:"required,iso4217"`
	BankName        string     `json:"bank_name"         validate:"required"`
	AccountNumber   string     `json:"account_number"    validate:"required"`
	AccountType     string     `json:"account_type"      validate:"required,oneof=savings current other"`
}

type updateBankAccountReq struct {
	DisplayName     string     `json:"display_name"       validate:"required"`
	Description     *string    `json:"description"`
	OwnershipType   string     `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	BankName        string     `json:"bank_name"          validate:"required"`
	AccountNumber   string     `json:"account_number"     validate:"required"`
	AccountType     string     `json:"account_type"       validate:"required,oneof=savings current other"`
}

// ----- handlers -----------------------------------------------------------

func (h *Handlers) handleCreateBankAccount(w http.ResponseWriter, r *http.Request) {
	var req createBankAccountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httperr.Write(w, http.StatusBadRequest, httperr.CodeInvalidJSONBody, nil)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		httperr.WriteValidation(w, err)
		return
	}

	account, err := h.repo.CreateBankAccount(r.Context(), repo.CreateBankAccountParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		NativeCurrency:  req.NativeCurrency,
		BankName:        req.BankName,
		AccountNumber:   req.AccountNumber,
		AccountType:     req.AccountType,
	})
	if err != nil {
		httperr.WriteRepo(w, "create bank account", err)
		return
	}
	writeJSON(w, http.StatusCreated, account)
}

func (h *Handlers) handleListBankAccounts(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListBankAccounts(r.Context())
	if err != nil {
		httperr.WriteRepo(w, "list bank accounts", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetBankAccount(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	account, err := h.repo.GetBankAccount(r.Context(), id)
	if err != nil {
		httperr.WriteRepo(w, "get bank account", err)
		return
	}
	writeJSON(w, http.StatusOK, account)
}

func (h *Handlers) handleUpdateBankAccount(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	var req updateBankAccountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httperr.Write(w, http.StatusBadRequest, httperr.CodeInvalidJSONBody, nil)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		httperr.WriteValidation(w, err)
		return
	}

	account, err := h.repo.UpdateBankAccount(r.Context(), id, repo.UpdateBankAccountParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		BankName:        req.BankName,
		AccountNumber:   req.AccountNumber,
		AccountType:     req.AccountType,
	})
	if err != nil {
		httperr.WriteRepo(w, "update bank account", err)
		return
	}
	writeJSON(w, http.StatusOK, account)
}

func (h *Handlers) handleDeleteBankAccount(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	if err := h.repo.DeleteBankAccount(r.Context(), id); err != nil {
		httperr.WriteRepo(w, "delete bank account", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
