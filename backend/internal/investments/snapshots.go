package investments

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

// createSnapshotReq accepts all value-shape columns; the repo validates
// which combination is required based on the parent investment's subtype
// (stock/mutual_fund/gold → quantity+price_per_unit, bond/time_deposit →
// accrued_interest). Wrong combos return ErrInvalidSnapshotShape, which the
// handler maps to 400.
type createSnapshotReq struct {
	YearMonth       string           `json:"year_month"        validate:"required"`
	Amount          *decimal.Decimal `json:"amount"            validate:"required"`
	Currency        string           `json:"currency"          validate:"required,iso4217"`
	Quantity        *decimal.Decimal `json:"quantity"`
	PricePerUnit    *decimal.Decimal `json:"price_per_unit"`
	AccruedInterest *decimal.Decimal `json:"accrued_interest"`
	AsOfDate        *string          `json:"as_of_date"`
	Description     *string          `json:"description"`
}

type updateSnapshotReq struct {
	Amount          *decimal.Decimal `json:"amount"            validate:"required"`
	Currency        string           `json:"currency"          validate:"required,iso4217"`
	Quantity        *decimal.Decimal `json:"quantity"`
	PricePerUnit    *decimal.Decimal `json:"price_per_unit"`
	AccruedInterest *decimal.Decimal `json:"accrued_interest"`
	AsOfDate        *string          `json:"as_of_date"`
	Description     *string          `json:"description"`
}

func (h *Handlers) handleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	investmentID, err := parseIDParam(r, "id")
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
	if isFutureYearMonth(ym, h.now()) {
		http.Error(w, "year_month cannot be in the future", http.StatusBadRequest)
		return
	}
	asOf, err := parseOptionalDate(req.AsOfDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if asOf != nil && isFutureDate(*asOf, h.now()) {
		http.Error(w, "as_of_date cannot be in the future", http.StatusBadRequest)
		return
	}

	snap, err := h.repo.CreateInvestmentSnapshot(r.Context(), repo.CreateInvestmentSnapshotParams{
		InvestmentID:    investmentID,
		YearMonth:       ym,
		Amount:          *req.Amount,
		Currency:        req.Currency,
		Quantity:        req.Quantity,
		PricePerUnit:    req.PricePerUnit,
		AccruedInterest: req.AccruedInterest,
		AsOfDate:        asOf,
		Description:     req.Description,
	})
	if err != nil {
		writeRepoError(w, "create investment snapshot", err)
		return
	}
	writeJSON(w, http.StatusCreated, snap)
}

func (h *Handlers) handleListSnapshots(w http.ResponseWriter, r *http.Request) {
	investmentID, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	snaps, err := h.repo.ListInvestmentSnapshots(r.Context(), investmentID)
	if err != nil {
		writeRepoError(w, "list investment snapshots", err)
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

	asOf, err := parseOptionalDate(req.AsOfDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if asOf != nil && isFutureDate(*asOf, h.now()) {
		http.Error(w, "as_of_date cannot be in the future", http.StatusBadRequest)
		return
	}

	snap, err := h.repo.UpdateInvestmentSnapshot(r.Context(), repo.UpdateInvestmentSnapshotParams{
		SnapshotID:      snapshotID,
		Amount:          *req.Amount,
		Currency:        req.Currency,
		Quantity:        req.Quantity,
		PricePerUnit:    req.PricePerUnit,
		AccruedInterest: req.AccruedInterest,
		AsOfDate:        asOf,
		Description:     req.Description,
	})
	if err != nil {
		writeRepoError(w, "update investment snapshot", err)
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
	if err := h.repo.DeleteInvestmentSnapshot(r.Context(), snapshotID); err != nil {
		writeRepoError(w, "delete investment snapshot", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

// isFutureYearMonth reports whether ym (first-of-month UTC) is strictly later
// than the current month derived from now.
func isFutureYearMonth(ym, now time.Time) bool {
	n := now.UTC()
	currentMonth := time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC)
	return ym.After(currentMonth)
}

// isFutureDate reports whether t (a calendar date parsed as UTC midnight) is
// strictly after today UTC.
func isFutureDate(t, now time.Time) bool {
	n := now.UTC()
	today := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
	return t.After(today)
}

func parseOptionalDate(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, errBadAsOfDate
	}
	return &t, nil
}

var errBadAsOfDate = errAsOfDateFormat{}

type errAsOfDateFormat struct{}

func (errAsOfDateFormat) Error() string { return "invalid as_of_date: expected YYYY-MM-DD" }
