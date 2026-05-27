package repo

import (
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// This file is the pure compute core of the materialized monthly report
// (ADR-0006 / ADR-0012). It takes plain in-memory inputs and derives one
// report per month — no DB, no context, no I/O — so the rules (carry-forward,
// lifecycle suppression, per-user/Joint attribution, stale flagging, and the
// comprehensive-income identity) are unit-testable without a container. The
// MonthlyReportRepo (monthly_reports.go) fetches the inputs, calls this, and
// upserts the result.
//
// Slice-2 scope: net worth + group breakdowns + the income statement (earned
// income by category, investment return by subtype, property/vehicle asset
// value change, residual living expenses). FX conversion is slice 3 — amounts
// are summed in their native currency for now.

const jointKey = "joint"

type positionGroup int

const (
	groupAsset positionGroup = iota
	groupLiability
	groupReceivable
	groupInvestment
)

// reportPosition is the lifecycle + ownership + subtype metadata the engine
// needs. terminatedAt nil => active (migration 00012's biconditional CHECK
// guarantees terminatedAt is set iff non-active). subtype distinguishes
// property/vehicle from bank_account (for asset value change) and carries the
// investment subtype (for the per-subtype return breakdown).
type reportPosition struct {
	id            uuid.UUID
	group         positionGroup
	subtype       string
	ownershipType string // "sole" | "joint"
	soleOwnerID   *uuid.UUID
	terminatedAt  *time.Time
}

// reportSnapshot is one monthly observation. amount is the position's value in
// its native currency (slice 2 is still single-currency; FX is slice 3).
type reportSnapshot struct {
	positionID uuid.UUID
	yearMonth  time.Time
	amount     decimal.Decimal
}

// reportIncome is one earned-income event, bucketed by its date's month.
type reportIncome struct {
	yearMonth     time.Time
	amount        decimal.Decimal
	category      string
	ownershipType string
	soleOwnerID   *uuid.UUID
}

// reportTransaction is one investment-ledger event; the engine maps it to
// cash_in/cash_out for the return formula (ADR-0008).
type reportTransaction struct {
	investmentID         uuid.UUID
	yearMonth            time.Time
	txnType              string
	amount               *decimal.Decimal
	quantity             *decimal.Decimal
	principalAmount      *decimal.Decimal
	interestAmount       *decimal.Decimal
	principalDisposition *string
	interestDisposition  *string
}

type reportEngineInput struct {
	positions    []reportPosition
	snapshots    []reportSnapshot
	income       []reportIncome
	transactions []reportTransaction
	members      []uuid.UUID // household user IDs — seed the per-user breakdown keys
	currentMonth time.Time   // first-of-month in the requesting user's time zone
}

// userBreakdown is the per-user (or "joint") slice of a month.
type userBreakdown struct {
	NW               decimal.Decimal `json:"nw"`
	EarnedIncome     decimal.Decimal `json:"earned_income"`
	InvestmentReturn decimal.Decimal `json:"investment_return"`
}

type earnedIncomeAmounts struct {
	total, salary, business, rental, gift, taxRefund, insurance, other decimal.Decimal
}

func (e *earnedIncomeAmounts) add(category string, v decimal.Decimal) {
	e.total = e.total.Add(v)
	switch category {
	case "salary":
		e.salary = e.salary.Add(v)
	case "business_income":
		e.business = e.business.Add(v)
	case "rental_income":
		e.rental = e.rental.Add(v)
	case "gift":
		e.gift = e.gift.Add(v)
	case "tax_refund":
		e.taxRefund = e.taxRefund.Add(v)
	case "insurance_payout":
		e.insurance = e.insurance.Add(v)
	case "other":
		e.other = e.other.Add(v)
	}
}

type investmentReturnAmounts struct {
	total, stock, mutualFund, bond, gold, timeDeposit decimal.Decimal
}

func (r *investmentReturnAmounts) add(subtype string, v decimal.Decimal) {
	r.total = r.total.Add(v)
	switch subtype {
	case "stock":
		r.stock = r.stock.Add(v)
	case "mutual_fund":
		r.mutualFund = r.mutualFund.Add(v)
	case "bond":
		r.bond = r.bond.Add(v)
	case "gold":
		r.gold = r.gold.Add(v)
	case "time_deposit":
		r.timeDeposit = r.timeDeposit.Add(v)
	}
}

// monthlyReportData is one generated month, pre-serialisation. The income-
// statement pointers are nil on the first-month baseline (no prior month to
// difference against — ADR-0006); earnedIncome is always present (a tracked
// fact, not derived).
type monthlyReportData struct {
	yearMonth        time.Time
	nwTotal          decimal.Decimal
	nwAssets         decimal.Decimal
	nwLiabilities    decimal.Decimal // positive magnitude; subtracted into nwTotal
	nwReceivables    decimal.Decimal
	nwInvestments    decimal.Decimal
	earnedIncome     earnedIncomeAmounts
	investmentReturn *investmentReturnAmounts // nil on baseline
	assetValueChange *decimal.Decimal         // nil on baseline
	livingExpenses   *decimal.Decimal         // nil on baseline
	userBreakdowns   map[string]userBreakdown
	stalePositions   []uuid.UUID
}

type monthAmount struct {
	idx    int
	amount decimal.Decimal
}

type cashFlow struct{ in, out decimal.Decimal }

func monthIndex(t time.Time) int {
	y, m, _ := t.Date()
	return y*12 + int(m) - 1
}

func monthFromIndex(i int) time.Time {
	return time.Date(i/12, time.Month(i%12+1), 1, 0, 0, 0, 0, time.UTC)
}

func ownerKey(ownershipType string, soleOwnerID *uuid.UUID) string {
	if ownershipType == "sole" && soleOwnerID != nil {
		return soleOwnerID.String()
	}
	return jointKey
}

func decOrZero(d *decimal.Decimal) decimal.Decimal {
	if d == nil {
		return decimal.Zero
	}
	return *d
}

// transactionCashFlows maps an investment transaction to the cash that moved
// between the instrument and the bank, per ADR-0008. Unit-deducting fees
// (quantity set) move no cash — they're absorbed in the snapshot delta; rolled
// maturity portions move no cash — captured by the new instrument's snapshot.
func transactionCashFlows(t reportTransaction) cashFlow {
	switch t.txnType {
	case "buy":
		return cashFlow{in: decOrZero(t.amount)}
	case "sell", "coupon", "dividend", "distribution":
		return cashFlow{out: decOrZero(t.amount)}
	case "fee":
		if t.quantity == nil {
			return cashFlow{in: decOrZero(t.amount)}
		}
		return cashFlow{}
	case "maturity":
		var out decimal.Decimal
		if t.principalDisposition != nil && *t.principalDisposition == "cash_out" {
			out = out.Add(decOrZero(t.principalAmount))
		}
		if t.interestDisposition != nil && *t.interestDisposition == "cash_out" {
			out = out.Add(decOrZero(t.interestAmount))
		}
		return cashFlow{out: out}
	}
	return cashFlow{}
}

// generateMonthlyReports derives one report per month from the first month with
// any snapshot through the later of the current month and the latest snapshot
// month (provisional current month, ADR-0006). Returns nil when there is no
// snapshot data.
//
// Net worth uses carry-forward (latest snapshot <= M, stale-flagged when older
// than M). The income statement is the comprehensive-income identity (ADR-0008):
// ΔNW = earned income + investment return + asset value change − living
// expenses, all derived here so living expenses is the residual.
func generateMonthlyReports(in reportEngineInput) []monthlyReportData {
	if len(in.snapshots) == 0 {
		return nil
	}

	byPos := make(map[uuid.UUID][]monthAmount, len(in.positions))
	var minIdx, maxIdx int
	for i, s := range in.snapshots {
		si := monthIndex(s.yearMonth)
		byPos[s.positionID] = append(byPos[s.positionID], monthAmount{idx: si, amount: s.amount})
		if i == 0 || si < minIdx {
			minIdx = si
		}
		if i == 0 || si > maxIdx {
			maxIdx = si
		}
	}
	for _, ss := range byPos {
		sort.Slice(ss, func(i, j int) bool { return ss[i].idx < ss[j].idx })
	}

	// income by month, and transaction cash flows by (instrument, month).
	incomeByMonth := make(map[int][]reportIncome)
	for _, inc := range in.income {
		mi := monthIndex(inc.yearMonth)
		incomeByMonth[mi] = append(incomeByMonth[mi], inc)
	}
	cashByPos := make(map[uuid.UUID]map[int]cashFlow)
	for _, t := range in.transactions {
		cf := transactionCashFlows(t)
		mi := monthIndex(t.yearMonth)
		m := cashByPos[t.investmentID]
		if m == nil {
			m = make(map[int]cashFlow)
			cashByPos[t.investmentID] = m
		}
		c := m[mi]
		c.in = c.in.Add(cf.in)
		c.out = c.out.Add(cf.out)
		m[mi] = c
	}

	lastIdx := maxIdx
	if ci := monthIndex(in.currentMonth); ci > lastIdx {
		lastIdx = ci
	}
	positions := sortedPositions(in.positions)

	var prevNwTotal decimal.Decimal
	out := make([]monthlyReportData, 0, lastIdx-minIdx+1)
	for idx := minIdx; idx <= lastIdx; idx++ {
		baseline := idx == minIdx
		m := monthlyReportData{
			yearMonth:      monthFromIndex(idx),
			userBreakdowns: make(map[string]userBreakdown, len(in.members)+1),
			stalePositions: []uuid.UUID{},
		}
		for _, u := range in.members {
			m.userBreakdowns[u.String()] = userBreakdown{}
		}
		m.userBreakdowns[jointKey] = userBreakdown{}

		// ----- earned income (always; a tracked fact, not derived) --------
		for _, inc := range incomeByMonth[idx] {
			m.earnedIncome.add(inc.category, inc.amount)
			key := ownerKey(inc.ownershipType, inc.soleOwnerID)
			b := m.userBreakdowns[key]
			b.EarnedIncome = b.EarnedIncome.Add(inc.amount)
			m.userBreakdowns[key] = b
		}

		// ----- net worth (always; carry-forward, gated on a snapshot) -----
		for _, p := range positions {
			if terminatedBefore(p, idx) {
				continue
			}
			carried, ok := latestAtOrBefore(byPos[p.id], idx)
			if !ok {
				continue
			}
			if carried.idx < idx {
				m.stalePositions = append(m.stalePositions, p.id)
			}
			v := carried.amount
			switch p.group {
			case groupAsset:
				m.nwAssets = m.nwAssets.Add(v)
			case groupLiability:
				m.nwLiabilities = m.nwLiabilities.Add(v)
			case groupReceivable:
				m.nwReceivables = m.nwReceivables.Add(v)
			case groupInvestment:
				m.nwInvestments = m.nwInvestments.Add(v)
			}
			signed := v
			if p.group == groupLiability {
				signed = v.Neg()
			}
			key := ownerKey(p.ownershipType, p.soleOwnerID)
			b := m.userBreakdowns[key]
			b.NW = b.NW.Add(signed)
			m.userBreakdowns[key] = b
		}
		m.nwTotal = m.nwAssets.Add(m.nwReceivables).Add(m.nwInvestments).Sub(m.nwLiabilities)

		// ----- income statement (suppressed on the baseline month) --------
		if !baseline {
			ret := &investmentReturnAmounts{}
			for _, p := range positions {
				if p.group != groupInvestment || terminatedBefore(p, idx) {
					continue
				}
				// Not gated on a snapshot: a transaction in a month the
				// instrument wasn't snapshotted still contributes its cash
				// flow (ADR-0008 timing noise — cumulative-correct).
				delta := carriedValue(byPos[p.id], idx).Sub(carriedValue(byPos[p.id], idx-1))
				cf := cashByPos[p.id][idx]
				r := delta.Add(cf.out).Sub(cf.in)
				ret.add(p.subtype, r)
				key := ownerKey(p.ownershipType, p.soleOwnerID)
				b := m.userBreakdowns[key]
				b.InvestmentReturn = b.InvestmentReturn.Add(r)
				m.userBreakdowns[key] = b
			}
			m.investmentReturn = ret

			avc := decimal.Zero
			for _, p := range positions {
				if p.group != groupAsset || terminatedBefore(p, idx) {
					continue
				}
				if p.subtype != "property" && p.subtype != "vehicle" {
					continue // bank accounts are cash — stay in the residual
				}
				avc = avc.Add(carriedValue(byPos[p.id], idx).Sub(carriedValue(byPos[p.id], idx-1)))
			}
			m.assetValueChange = &avc

			// Living expenses = the residual that closes the identity.
			deltaNW := m.nwTotal.Sub(prevNwTotal)
			exp := m.earnedIncome.total.Add(ret.total).Add(avc).Sub(deltaNW)
			m.livingExpenses = &exp
		}

		prevNwTotal = m.nwTotal
		out = append(out, m)
	}
	return out
}

// terminatedBefore reports whether a position has stopped contributing by month
// idx — it contributes through its termination month, then drops.
func terminatedBefore(p reportPosition, idx int) bool {
	return p.terminatedAt != nil && idx > monthIndex(*p.terminatedAt)
}

func sortedPositions(ps []reportPosition) []reportPosition {
	out := make([]reportPosition, len(ps))
	copy(out, ps)
	sort.Slice(out, func(i, j int) bool { return out[i].id.String() < out[j].id.String() })
	return out
}

// latestAtOrBefore returns the most recent snapshot with month <= idx from a
// slice already sorted ascending by month index.
func latestAtOrBefore(ss []monthAmount, idx int) (monthAmount, bool) {
	var found monthAmount
	ok := false
	for k := range ss {
		if ss[k].idx <= idx {
			found = ss[k]
			ok = true
		} else {
			break
		}
	}
	return found, ok
}

// carriedValue is latestAtOrBefore reduced to its amount, 0 when none exists.
func carriedValue(ss []monthAmount, idx int) decimal.Decimal {
	if c, ok := latestAtOrBefore(ss, idx); ok {
		return c.amount
	}
	return decimal.Zero
}
