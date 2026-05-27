// Package reports exposes HTTP handlers for the materialized monthly net-worth
// report (ADR-0006). Mounted under /api/reports. Reads are lazy: the repo
// regenerates stale months on read, so these handlers are plain fetches.
//
// The response is a DTO rather than the raw db row: the report's breakdown
// columns are JSONB (sql -> []byte), which would serialise as base64 if handed
// straight to encoding/json. The DTO passes them through as json.RawMessage.
package reports

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/repo"
	"github.com/shopspring/decimal"
)

type Handlers struct {
	repo *repo.MonthlyReportRepo
}

func New(r *repo.MonthlyReportRepo) *Handlers {
	return &Handlers{repo: r}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Route("/reports", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/", h.handleList)
		r.Get("/{yearMonth}", h.handleGet)
	})
}

// reportResponse is the API shape: net worth + group breakdowns + the income
// statement + per-user/Joint breakdown + carried-forward (stale) positions.
// The income-statement fields are nullable — null on the first-month baseline
// (no prior month) for the derived lines (ADR-0006). Decimals serialise as
// strings (precision); nulls pass through as JSON null.
type reportResponse struct {
	YearMonth         time.Time  `json:"year_month"`
	GeneratedAt       *time.Time `json:"generated_at"`
	ReportingCurrency string     `json:"reporting_currency"`

	NWTotal       decimal.Decimal `json:"nw_total"`
	NWAssets      decimal.Decimal `json:"nw_assets"`
	NWLiabilities decimal.Decimal `json:"nw_liabilities"`
	NWReceivables decimal.Decimal `json:"nw_receivables"`
	NWInvestments decimal.Decimal `json:"nw_investments"`

	EarnedIncomeTotal     *decimal.Decimal `json:"earned_income_total"`
	EarnedIncomeSalary    *decimal.Decimal `json:"earned_income_salary"`
	EarnedIncomeBusiness  *decimal.Decimal `json:"earned_income_business"`
	EarnedIncomeRental    *decimal.Decimal `json:"earned_income_rental"`
	EarnedIncomeGift      *decimal.Decimal `json:"earned_income_gift"`
	EarnedIncomeTaxRefund *decimal.Decimal `json:"earned_income_tax_refund"`
	EarnedIncomeInsurance *decimal.Decimal `json:"earned_income_insurance"`
	EarnedIncomeOther     *decimal.Decimal `json:"earned_income_other"`

	InvestmentReturnTotal       *decimal.Decimal `json:"investment_return_total"`
	InvestmentReturnStock       *decimal.Decimal `json:"investment_return_stock"`
	InvestmentReturnMutualFund  *decimal.Decimal `json:"investment_return_mutual_fund"`
	InvestmentReturnBond        *decimal.Decimal `json:"investment_return_bond"`
	InvestmentReturnGold        *decimal.Decimal `json:"investment_return_gold"`
	InvestmentReturnTimeDeposit *decimal.Decimal `json:"investment_return_time_deposit"`

	AssetValueChange      *decimal.Decimal `json:"asset_value_change"`
	DerivedLivingExpenses *decimal.Decimal `json:"derived_living_expenses"`

	UserBreakdowns json.RawMessage `json:"user_breakdowns"`
	StalePositions json.RawMessage `json:"stale_positions"`
	FxRatesUsed    json.RawMessage `json:"fx_rates_used"`
	MissingFx      json.RawMessage `json:"missing_fx"`
}

func toResponse(r db.MonthlyReport, currency string) reportResponse {
	resp := reportResponse{
		YearMonth:         r.YearMonth,
		ReportingCurrency: currency,

		NWTotal:       r.NwTotal,
		NWAssets:      r.NwAssets,
		NWLiabilities: r.NwLiabilities,
		NWReceivables: r.NwReceivables,
		NWInvestments: r.NwInvestments,

		EarnedIncomeTotal:     r.EarnedIncomeTotal,
		EarnedIncomeSalary:    r.EarnedIncomeSalary,
		EarnedIncomeBusiness:  r.EarnedIncomeBusiness,
		EarnedIncomeRental:    r.EarnedIncomeRental,
		EarnedIncomeGift:      r.EarnedIncomeGift,
		EarnedIncomeTaxRefund: r.EarnedIncomeTaxRefund,
		EarnedIncomeInsurance: r.EarnedIncomeInsurance,
		EarnedIncomeOther:     r.EarnedIncomeOther,

		InvestmentReturnTotal:       r.InvestmentReturnTotal,
		InvestmentReturnStock:       r.InvestmentReturnStock,
		InvestmentReturnMutualFund:  r.InvestmentReturnMutualFund,
		InvestmentReturnBond:        r.InvestmentReturnBond,
		InvestmentReturnGold:        r.InvestmentReturnGold,
		InvestmentReturnTimeDeposit: r.InvestmentReturnTimeDeposit,

		AssetValueChange:      r.AssetValueChange,
		DerivedLivingExpenses: r.DerivedLivingExpenses,

		UserBreakdowns: rawJSON(r.UserBreakdowns, "{}"),
		StalePositions: rawJSON(r.StalePositions, "[]"),
		FxRatesUsed:    rawJSON(r.FxRatesUsed, "{}"),
		MissingFx:      rawJSON(r.MissingFx, "[]"),
	}
	if r.GeneratedAt.Valid {
		t := r.GeneratedAt.Time
		resp.GeneratedAt = &t
	}
	return resp
}

func (h *Handlers) handleList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.ListReports(r.Context())
	if err != nil {
		writeRepoError(w, "list reports", err)
		return
	}
	currency, err := h.repo.ReportingCurrency(r.Context())
	if err != nil {
		writeRepoError(w, "reporting currency", err)
		return
	}
	out := make([]reportResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row, currency))
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handlers) handleGet(w http.ResponseWriter, r *http.Request) {
	ym, err := parseYearMonth(chi.URLParam(r, "yearMonth"))
	if err != nil {
		http.Error(w, "invalid year_month: expected YYYY-MM", http.StatusBadRequest)
		return
	}
	row, err := h.repo.GetReport(r.Context(), ym)
	if err != nil {
		writeRepoError(w, "get report", err)
		return
	}
	currency, err := h.repo.ReportingCurrency(r.Context())
	if err != nil {
		writeRepoError(w, "reporting currency", err)
		return
	}
	writeJSON(w, http.StatusOK, toResponse(*row, currency))
}

// ----- helpers ------------------------------------------------------------

func rawJSON(b []byte, fallback string) json.RawMessage {
	if len(b) == 0 {
		return json.RawMessage(fallback)
	}
	return json.RawMessage(b)
}

func parseYearMonth(s string) (time.Time, error) {
	if t, err := time.Parse("2006-01", s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid year_month")
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

// writeRepoError mirrors the convention in the other HTTP packages.
// repo.ErrUnauthenticated is unreachable — RequireAuth gates every route.
func writeRepoError(w http.ResponseWriter, op string, err error) {
	if errors.Is(err, repo.ErrNotFound) {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	slog.Error(op, "err", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}
