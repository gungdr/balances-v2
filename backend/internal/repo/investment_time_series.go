package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// ValuePoint is one month's snapshot value on a position's time series.
type ValuePoint struct {
	YearMonth time.Time       `json:"year_month"`
	Amount    decimal.Decimal `json:"amount"`
}

// CostPoint is the avg-cost basis at one month on a position's time series.
type CostPoint struct {
	YearMonth time.Time       `json:"year_month"`
	Cost      decimal.Decimal `json:"cost"`
}

// InvestmentTimeSeries carries one position's monthly value + cost series for
// the list/home time graphs (issue #22). Both series are keyed to the
// position's snapshot months: the value is that month's snapshot amount, the
// cost is the cumulative avg-cost basis of transactions dated in months ≤ that
// month. Sampling cost at snapshot months (not transaction months) matches the
// frontend's `lib/costBasis.ts#costBasisSeries` and keeps the value
// carry-forward in `lib/listAggregates.ts#aggregateMonthly` correct — every
// cost point shares a month with a value point.
type InvestmentTimeSeries struct {
	InvestmentID uuid.UUID    `json:"investment_id"`
	ValueSeries  []ValuePoint `json:"value_series"`
	CostSeries   []CostPoint  `json:"cost_series"`
}

// InvestmentTimeSeries builds the per-position value + cost series for every
// investment in the household in one shot (issue #22), so the list/home time
// graphs need no per-position snapshot/transaction fan-out. Replaces the
// frontend's N-parallel `useInvestmentBatch*` fetches.
func (r *InvestmentRepo) InvestmentTimeSeries(ctx context.Context) ([]InvestmentTimeSeries, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	invs, err := r.q.ListInvestmentsByHousehold(ctx, db.ListInvestmentsByHouseholdParams{HouseholdID: hid})
	if err != nil {
		return nil, fmt.Errorf("list investments: %w", err)
	}
	if len(invs) == 0 {
		return []InvestmentTimeSeries{}, nil
	}

	ids := make([]uuid.UUID, len(invs))
	for i, x := range invs {
		ids[i] = x.ID
	}

	snaps, err := r.q.ListInvestmentSnapshotsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list investment snapshots: %w", err)
	}
	snapsByID := make(map[uuid.UUID][]db.InvestmentSnapshot)
	for _, s := range snaps {
		snapsByID[s.InvestmentID] = append(snapsByID[s.InvestmentID], s)
	}

	txns, err := r.q.ListInvestmentTransactionsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list investment transactions: %w", err)
	}
	txnByID := groupTransactionsByInvestment(txns)

	tdDetails, err := r.q.ListTimeDepositDetailsByInvestmentIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list time_deposit_details: %w", err)
	}
	principalByID := make(map[uuid.UUID]decimal.Decimal, len(tdDetails))
	for _, d := range tdDetails {
		principalByID[d.InvestmentID] = d.Principal
	}

	out := make([]InvestmentTimeSeries, 0, len(invs))
	for _, x := range invs {
		positionSnaps := snapsByID[x.ID]
		valueSeries := make([]ValuePoint, 0, len(positionSnaps))
		months := make([]time.Time, 0, len(positionSnaps))
		for _, s := range positionSnaps {
			valueSeries = append(valueSeries, ValuePoint{YearMonth: s.YearMonth, Amount: s.Amount})
			months = append(months, s.YearMonth)
		}

		var costSeries []CostPoint
		ledger := txnByID[x.ID]
		switch x.Subtype {
		case "time_deposit":
			// Ledger holds only the terminal Maturity row — flat principal.
			costSeries = flatCostSeriesAtMonths(months, principalByID[x.ID])
		default: // stock, mutual_fund, gold, bond — all replay the buy/sell ledger
			// Bonds now always carry a Buy at placement (issue #27), so they
			// replay like any other holding; no face_value fallback remains.
			costSeries = costSeriesAtMonths(months, ledger)
		}

		out = append(out, InvestmentTimeSeries{
			InvestmentID: x.ID,
			ValueSeries:  valueSeries,
			CostSeries:   costSeries,
		})
	}
	return out, nil
}

// costSeriesAtMonths walks the (ascending) snapshot months and, at each,
// records the cumulative avg-cost basis of all transactions dated in a month
// ≤ that month — the server-side mirror of lib/costBasis.ts#costBasisSeries.
// Both `months` and `txns` MUST be ascending (the batch queries order that
// way); the txn cursor advances monotonically for O(n) total work.
func costSeriesAtMonths(months []time.Time, txns []db.InvestmentTransaction) []CostPoint {
	cost := decimal.Zero
	qty := decimal.Zero
	i := 0
	out := make([]CostPoint, 0, len(months))
	for _, m := range months {
		mk := monthKey(m)
		for i < len(txns) && monthKey(txns[i].TransactionDate) <= mk {
			applyLedgerTxn(&cost, &qty, txns[i])
			i++
		}
		out = append(out, CostPoint{YearMonth: m, Cost: cost})
	}
	return out
}

// flatCostSeriesAtMonths emits a constant cost at every month — TimeDeposit
// (principal) and govt-primary Bond (face_value), mirroring
// lib/costBasis.ts#flatCostSeries.
func flatCostSeriesAtMonths(months []time.Time, cost decimal.Decimal) []CostPoint {
	out := make([]CostPoint, 0, len(months))
	for _, m := range months {
		out = append(out, CostPoint{YearMonth: m, Cost: cost})
	}
	return out
}

// monthKey reduces a timestamp to its "2006-01" prefix; lexical comparison of
// these keys is calendar-month comparison, matching the frontend's
// `year_month.slice(0, 7)`.
func monthKey(t time.Time) string {
	return t.Format("2006-01")
}
