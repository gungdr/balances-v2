// Package income exposes HTTP handlers for the Income flow-event entity.
// Income has no subtype, no extension table, no snapshots — each row is a
// one-shot event. Mounted under /api/income (singular collection endpoint;
// "income" is a mass noun in English — see HANDOFF M4.5 design notes).
package income

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/repo"
)

type Handlers struct {
	repo     *repo.IncomeRepo
	validate *validator.Validate
}

func New(r *repo.IncomeRepo) *Handlers {
	return &Handlers{
		repo:     r,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Route("/income", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreate)
		r.Get("/", h.handleList)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.handleGet)
			r.Patch("/", h.handleUpdate)
			r.Delete("/", h.handleDelete)
		})
	})
}

// ----- requests -----------------------------------------------------------
//
// Category enum (closed set from migration 00011 + ADR-0008) lives only in the
// validator tag below. Update both places if it changes.

type createReq struct {
	Date            string           `json:"date"               validate:"required"`
	Amount          *decimal.Decimal `json:"amount"             validate:"required"`
	Currency        string           `json:"currency"           validate:"required,iso4217"`
	Category        string           `json:"category"           validate:"required,oneof=salary business_income rental_income gift tax_refund insurance_payout other"`
	Description     *string          `json:"description"`
	OwnershipType   string           `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID       `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	Regularity      string           `json:"regularity"         validate:"required,oneof=routine incidental"`
}

type updateReq struct {
	Date            string           `json:"date"               validate:"required"`
	Amount          *decimal.Decimal `json:"amount"             validate:"required"`
	Currency        string           `json:"currency"           validate:"required,iso4217"`
	Category        string           `json:"category"           validate:"required,oneof=salary business_income rental_income gift tax_refund insurance_payout other"`
	Description     *string          `json:"description"`
	OwnershipType   string           `json:"ownership_type"     validate:"required,oneof=sole joint"`
	SoleOwnerUserID *uuid.UUID       `json:"sole_owner_user_id" validate:"required_if=OwnershipType sole"`
	Regularity      string           `json:"regularity"         validate:"required,oneof=routine incidental"`
}

// ----- handlers -----------------------------------------------------------

func (h *Handlers) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	date, err := parseDate(req.Date, "date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !req.Amount.IsPositive() {
		http.Error(w, "invalid request: amount must be > 0", http.StatusBadRequest)
		return
	}

	row, err := h.repo.CreateIncome(r.Context(), repo.CreateIncomeParams{
		Date:            date,
		Amount:          *req.Amount,
		Currency:        req.Currency,
		Category:        req.Category,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		Regularity:      req.Regularity,
	})
	if err != nil {
		writeRepoError(w, "create income", err)
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (h *Handlers) handleList(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListIncome(r.Context())
	if err != nil {
		writeRepoError(w, "list income", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGet(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	row, err := h.repo.GetIncome(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get income", err)
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (h *Handlers) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	date, err := parseDate(req.Date, "date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !req.Amount.IsPositive() {
		http.Error(w, "invalid request: amount must be > 0", http.StatusBadRequest)
		return
	}

	row, err := h.repo.UpdateIncome(r.Context(), id, repo.UpdateIncomeParams{
		Date:            date,
		Amount:          *req.Amount,
		Currency:        req.Currency,
		Category:        req.Category,
		Description:     req.Description,
		OwnershipType:   req.OwnershipType,
		SoleOwnerUserID: req.SoleOwnerUserID,
		Regularity:      req.Regularity,
	})
	if err != nil {
		writeRepoError(w, "update income", err)
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (h *Handlers) handleDelete(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteIncome(r.Context(), id); err != nil {
		writeRepoError(w, "delete income", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ----- helpers ------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

// writeRepoError mirrors the convention in the position-group HTTP packages.
// repo.ErrUnauthenticated is unreachable here — RequireAuth gates every
// route in Mount, so the repo's currentUser() always finds a user.
func writeRepoError(w http.ResponseWriter, op string, err error) {
	var status int
	switch {
	case errors.Is(err, repo.ErrNotFound):
		status = http.StatusNotFound
	default:
		status = http.StatusInternalServerError
	}
	if status == http.StatusInternalServerError {
		slog.Error(op, "err", err)
		http.Error(w, "internal error", status)
		return
	}
	http.Error(w, err.Error(), status)
}

func parseIDParam(r *http.Request, name string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, name))
}

func parseDate(s, field string) (time.Time, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid %s: expected YYYY-MM-DD", field)
	}
	return t, nil
}
