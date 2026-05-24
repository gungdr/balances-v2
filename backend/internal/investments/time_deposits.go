package investments

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

type createTimeDepositReq struct {
	DisplayName     string           `json:"display_name"       validate:"required"`
	Description     *string          `json:"description"`
	OwnershipType   string           `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID       `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	NativeCurrency  string           `json:"native_currency"    validate:"required,iso4217"`
	BankName        string           `json:"bank_name"          validate:"required"`
	Principal       *decimal.Decimal `json:"principal"          validate:"required"`
	InterestRate    *decimal.Decimal `json:"interest_rate"      validate:"required"`
	TermMonths      int32            `json:"term_months"        validate:"required,gt=0"`
	PlacementDate   string           `json:"placement_date"     validate:"required"`
	MaturityDate    string           `json:"maturity_date"      validate:"required"`
	RolloverPolicy  string           `json:"rollover_policy"    validate:"required,oneof=auto_renew_principal auto_renew_with_interest no_rollover"`
}

type updateTimeDepositReq struct {
	DisplayName     string           `json:"display_name"       validate:"required"`
	Description     *string          `json:"description"`
	OwnershipType   string           `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID       `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	BankName        string           `json:"bank_name"          validate:"required"`
	Principal       *decimal.Decimal `json:"principal"          validate:"required"`
	InterestRate    *decimal.Decimal `json:"interest_rate"      validate:"required"`
	TermMonths      int32            `json:"term_months"        validate:"required,gt=0"`
	PlacementDate   string           `json:"placement_date"     validate:"required"`
	MaturityDate    string           `json:"maturity_date"      validate:"required"`
	RolloverPolicy  string           `json:"rollover_policy"    validate:"required,oneof=auto_renew_principal auto_renew_with_interest no_rollover"`
}

func (h *Handlers) handleCreateTimeDeposit(w http.ResponseWriter, r *http.Request) {
	var req createTimeDepositReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	placement, err := time.Parse("2006-01-02", req.PlacementDate)
	if err != nil {
		http.Error(w, "invalid placement_date: expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	maturity, err := time.Parse("2006-01-02", req.MaturityDate)
	if err != nil {
		http.Error(w, "invalid maturity_date: expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	t, err := h.repo.CreateTimeDeposit(r.Context(), repo.CreateTimeDepositParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		NativeCurrency:  req.NativeCurrency,
		BankName:        req.BankName,
		Principal:       *req.Principal,
		InterestRate:    *req.InterestRate,
		TermMonths:      req.TermMonths,
		PlacementDate:   placement,
		MaturityDate:    maturity,
		RolloverPolicy:  req.RolloverPolicy,
	})
	if err != nil {
		writeRepoError(w, "create time deposit", err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *Handlers) handleListTimeDeposits(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListTimeDeposits(r.Context())
	if err != nil {
		writeRepoError(w, "list time deposits", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetTimeDeposit(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	t, err := h.repo.GetTimeDeposit(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get time deposit", err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *Handlers) handleUpdateTimeDeposit(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateTimeDepositReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	placement, err := time.Parse("2006-01-02", req.PlacementDate)
	if err != nil {
		http.Error(w, "invalid placement_date: expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	maturity, err := time.Parse("2006-01-02", req.MaturityDate)
	if err != nil {
		http.Error(w, "invalid maturity_date: expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	td, err := h.repo.UpdateTimeDeposit(r.Context(), id, repo.UpdateTimeDepositParams{
		DisplayName:     req.DisplayName,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		BankName:        req.BankName,
		Principal:       *req.Principal,
		InterestRate:    *req.InterestRate,
		TermMonths:      req.TermMonths,
		PlacementDate:   placement,
		MaturityDate:    maturity,
		RolloverPolicy:  req.RolloverPolicy,
	})
	if err != nil {
		writeRepoError(w, "update time deposit", err)
		return
	}
	writeJSON(w, http.StatusOK, td)
}

func (h *Handlers) handleDeleteTimeDeposit(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteTimeDeposit(r.Context(), id); err != nil {
		writeRepoError(w, "delete time deposit", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
