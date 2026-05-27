// Package fxrates exposes HTTP handlers for the manual monthly FX-rate table
// (ADR-0002). Mounted under /api/fx-rates. Rates are entered when a household
// turns multi-currency on; the report engine applies them (latest <= month).
package fxrates

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
	repo     *repo.FxRateRepo
	validate *validator.Validate
}

func New(r *repo.FxRateRepo) *Handlers {
	return &Handlers{repo: r, validate: validator.New(validator.WithRequiredStructEnabled())}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Route("/fx-rates", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreate)
		r.Get("/", h.handleList)
		r.Route("/{id}", func(r chi.Router) {
			r.Patch("/", h.handleUpdate)
			r.Delete("/", h.handleDelete)
		})
	})
}

type createReq struct {
	YearMonth string           `json:"year_month" validate:"required"`
	Currency  string           `json:"currency"   validate:"required,iso4217"`
	Rate      *decimal.Decimal `json:"rate"       validate:"required"`
}

type updateReq struct {
	Rate *decimal.Decimal `json:"rate" validate:"required"`
}

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
	ym, err := parseYearMonth(req.YearMonth)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !req.Rate.IsPositive() {
		http.Error(w, "invalid request: rate must be > 0", http.StatusBadRequest)
		return
	}
	row, err := h.repo.CreateFxRate(r.Context(), repo.CreateFxRateParams{
		YearMonth: ym, Currency: req.Currency, Rate: *req.Rate,
	})
	if err != nil {
		writeRepoError(w, "create fx rate", err)
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (h *Handlers) handleList(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListFxRates(r.Context())
	if err != nil {
		writeRepoError(w, "list fx rates", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
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
	if !req.Rate.IsPositive() {
		http.Error(w, "invalid request: rate must be > 0", http.StatusBadRequest)
		return
	}
	row, err := h.repo.UpdateFxRate(r.Context(), id, *req.Rate)
	if err != nil {
		writeRepoError(w, "update fx rate", err)
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (h *Handlers) handleDelete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteFxRate(r.Context(), id); err != nil {
		writeRepoError(w, "delete fx rate", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ----- helpers ------------------------------------------------------------

func parseYearMonth(s string) (time.Time, error) {
	if t, err := time.Parse("2006-01", s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC), nil
	}
	return time.Time{}, fmt.Errorf("invalid year_month: expected YYYY-MM")
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

func writeRepoError(w http.ResponseWriter, op string, err error) {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, repo.ErrFxRateExists):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		slog.Error(op, "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
