// Package receivables exposes HTTP handlers for the Receivable position
// group. Receivables have no subtype and no extension table — all metadata
// is inline on the core row. Snapshots share the per-group
// receivable_snapshots table and are exposed under
// /api/receivables/{id}/snapshots.
package receivables

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
	repo     *repo.ReceivableRepo
	validate *validator.Validate
}

func New(r *repo.ReceivableRepo) *Handlers {
	return &Handlers{
		repo:     r,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Route("/receivables", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreate)
		r.Get("/", h.handleList)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.handleGet)
			r.Patch("/", h.handleUpdate)
			r.Delete("/", h.handleDelete)
			r.Patch("/lifecycle", h.handleUpdateLifecycle)
			r.Route("/snapshots", func(r chi.Router) {
				r.Post("/", h.handleCreateSnapshot)
				r.Get("/", h.handleListSnapshots)
				r.Patch("/{snapshotID}", h.handleUpdateSnapshot)
				r.Delete("/{snapshotID}", h.handleDeleteSnapshot)
				// Bulk import (M6 side item): download a scoped .xlsx
				// template, then upload a filled one. Static segments, so no
				// clash with the /{snapshotID} routes above.
				r.Get("/import-template", h.handleImportTemplate)
				r.Post("/import", h.handleImportSnapshots)
			})
		})
	})
}

// ----- requests -----------------------------------------------------------

type createReq struct {
	DisplayName      string     `json:"display_name"            validate:"required"`
	Description      *string    `json:"description"`
	OwnershipType    string     `json:"ownership_type"          validate:"required,oneof=sole joint"`
	SoleOwnerUserID  *uuid.UUID `json:"sole_owner_user_id"      validate:"required_if=OwnershipType sole"`
	NativeCurrency   string     `json:"native_currency"         validate:"required,iso4217"`
	CounterpartyName string     `json:"counterparty_name"       validate:"required"`
	DueDate          *string    `json:"due_date"`
}

type updateReq struct {
	DisplayName      string     `json:"display_name"            validate:"required"`
	Description      *string    `json:"description"`
	OwnershipType    string     `json:"ownership_type"          validate:"required,oneof=sole joint"`
	SoleOwnerUserID  *uuid.UUID `json:"sole_owner_user_id"      validate:"required_if=OwnershipType sole"`
	CounterpartyName string     `json:"counterparty_name"       validate:"required"`
	DueDate          *string    `json:"due_date"`
}

// ----- core CRUD ----------------------------------------------------------

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
	dueDate, err := parseOptionalDate(req.DueDate, "due_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	row, err := h.repo.CreateReceivable(r.Context(), repo.CreateReceivableParams{
		DisplayName:      req.DisplayName,
		Description:      req.Description,
		OwnershipType:    req.OwnershipType,
		SoleOwnerUserID:  req.SoleOwnerUserID,
		NativeCurrency:   req.NativeCurrency,
		CounterpartyName: req.CounterpartyName,
		DueDate:          dueDate,
	})
	if err != nil {
		writeRepoError(w, "create receivable", err)
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (h *Handlers) handleList(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListReceivables(r.Context())
	if err != nil {
		writeRepoError(w, "list receivables", err)
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
	row, err := h.repo.GetReceivable(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get receivable", err)
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
	dueDate, err := parseOptionalDate(req.DueDate, "due_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	row, err := h.repo.UpdateReceivable(r.Context(), id, repo.UpdateReceivableParams{
		DisplayName:      req.DisplayName,
		Description:      req.Description,
		OwnershipType:    req.OwnershipType,
		SoleOwnerUserID:  req.SoleOwnerUserID,
		CounterpartyName: req.CounterpartyName,
		DueDate:          dueDate,
	})
	if err != nil {
		writeRepoError(w, "update receivable", err)
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
	if err := h.repo.DeleteReceivable(r.Context(), id); err != nil {
		writeRepoError(w, "delete receivable", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ----- snapshots ----------------------------------------------------------

type createSnapshotReq struct {
	YearMonth   string           `json:"year_month"  validate:"required"`
	Amount      *decimal.Decimal `json:"amount"      validate:"required"`
	Currency    string           `json:"currency"    validate:"required,iso4217"`
	AsOfDate    *string          `json:"as_of_date"`
	Description *string          `json:"description"`
}

type updateSnapshotReq struct {
	Amount      *decimal.Decimal `json:"amount"      validate:"required"`
	Currency    string           `json:"currency"    validate:"required,iso4217"`
	AsOfDate    *string          `json:"as_of_date"`
	Description *string          `json:"description"`
}

func (h *Handlers) handleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req createSnapshotReq
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
		http.Error(w, "invalid year_month: expected YYYY-MM or YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	asOf, err := parseOptionalDate(req.AsOfDate, "as_of_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	snap, err := h.repo.CreateReceivableSnapshot(r.Context(), repo.CreateReceivableSnapshotParams{
		ReceivableID: id,
		YearMonth:    ym,
		Amount:       *req.Amount,
		Currency:     req.Currency,
		AsOfDate:     asOf,
		Description:  req.Description,
	})
	if err != nil {
		writeRepoError(w, "create receivable snapshot", err)
		return
	}
	writeJSON(w, http.StatusCreated, snap)
}

func (h *Handlers) handleListSnapshots(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	snaps, err := h.repo.ListReceivableSnapshots(r.Context(), id)
	if err != nil {
		writeRepoError(w, "list receivable snapshots", err)
		return
	}
	writeJSON(w, http.StatusOK, snaps)
}

func (h *Handlers) handleUpdateSnapshot(w http.ResponseWriter, r *http.Request) {
	snapshotID, err := parseIDParam(r, "snapshotID")
	if err != nil {
		http.Error(w, "invalid snapshot id", http.StatusBadRequest)
		return
	}
	var req updateSnapshotReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	asOf, err := parseOptionalDate(req.AsOfDate, "as_of_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	snap, err := h.repo.UpdateReceivableSnapshot(r.Context(), repo.UpdateReceivableSnapshotParams{
		SnapshotID:  snapshotID,
		Amount:      *req.Amount,
		Currency:    req.Currency,
		AsOfDate:    asOf,
		Description: req.Description,
	})
	if err != nil {
		writeRepoError(w, "update receivable snapshot", err)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func (h *Handlers) handleDeleteSnapshot(w http.ResponseWriter, r *http.Request) {
	snapshotID, err := parseIDParam(r, "snapshotID")
	if err != nil {
		http.Error(w, "invalid snapshot id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteReceivableSnapshot(r.Context(), snapshotID); err != nil {
		writeRepoError(w, "delete receivable snapshot", err)
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

// writeRepoError maps a repo error to an HTTP response. repo.ErrUnauthenticated
// is unreachable here — RequireAuth gates every route in Mount, so the repo's
// currentUser() helper always finds a user.
func writeRepoError(w http.ResponseWriter, op string, err error) {
	var status int
	switch {
	case errors.Is(err, repo.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, repo.ErrInvalidLifecycle):
		status = http.StatusBadRequest
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

func parseOptionalDate(s *string, field string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, fmt.Errorf("invalid %s: expected YYYY-MM-DD", field)
	}
	return &t, nil
}

func parseYearMonth(s string) (time.Time, error) {
	if len(s) == 7 {
		return time.Parse("2006-01", s)
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC), nil
}
