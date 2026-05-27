package repo

import (
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// This file is the pure compute core of the materialized monthly report
// (ADR-0006 / ADR-0012). It takes plain in-memory inputs and derives one
// report per month — no DB, no context, no I/O — so the net-worth rules
// (carry-forward, lifecycle suppression, per-user/Joint attribution,
// stale-position flagging) are unit-testable without a container. The
// MonthlyReportRepo (monthly_reports.go) fetches the inputs, calls this, and
// upserts the result.
//
// Slice-1 scope: net worth + group breakdowns + per-user/Joint net worth +
// stale positions. The income-statement lines (earned income, investment
// return, asset value change, residual living expenses) and FX conversion
// arrive in M5 slices 2-3.

const jointKey = "joint"

type positionGroup int

const (
	groupAsset positionGroup = iota
	groupLiability
	groupReceivable
	groupInvestment
)

// reportPosition is the lifecycle + ownership metadata the engine needs.
// terminatedAt nil => active (the biconditional CHECK in migration 00012
// guarantees terminatedAt is set iff the position is non-active).
type reportPosition struct {
	id            uuid.UUID
	group         positionGroup
	ownershipType string // "sole" | "joint"
	soleOwnerID   *uuid.UUID
	terminatedAt  *time.Time
}

// reportSnapshot is one monthly observation. amount is the position's value in
// its native currency (slice 1 is single-currency; FX conversion is slice 3).
type reportSnapshot struct {
	positionID uuid.UUID
	yearMonth  time.Time
	amount     decimal.Decimal
}

type reportEngineInput struct {
	positions    []reportPosition
	snapshots    []reportSnapshot
	members      []uuid.UUID // household user IDs — seed the per-user breakdown keys
	currentMonth time.Time   // first-of-month in the requesting user's time zone
}

// userBreakdown is the per-user (or "joint") slice of a month. Slice 1 carries
// net worth only; earned_income / investment_return join it in slice 2.
type userBreakdown struct {
	NW decimal.Decimal `json:"nw"`
}

// monthlyReportData is one generated month, pre-serialisation. The repo maps
// it onto db.UpsertMonthlyReportParams.
type monthlyReportData struct {
	yearMonth      time.Time
	nwTotal        decimal.Decimal
	nwAssets       decimal.Decimal
	nwLiabilities  decimal.Decimal // positive magnitude; subtracted into nwTotal
	nwReceivables  decimal.Decimal
	nwInvestments  decimal.Decimal
	userBreakdowns map[string]userBreakdown
	stalePositions []uuid.UUID
}

// monthAmount is a snapshot reduced to its month ordinal + value, the unit the
// carry-forward scan works over.
type monthAmount struct {
	idx    int
	amount decimal.Decimal
}

// monthIndex collapses a date to a comparable month ordinal, sidestepping any
// time-zone/location drift in the stored DATE values.
func monthIndex(t time.Time) int {
	y, m, _ := t.Date()
	return y*12 + int(m) - 1
}

func monthFromIndex(i int) time.Time {
	return time.Date(i/12, time.Month(i%12+1), 1, 0, 0, 0, 0, time.UTC)
}

// generateMonthlyReports derives one report per month from the first month with
// any snapshot through the later of the current month and the latest snapshot
// month (provisional current month, ADR-0006). Returns nil when there is no
// snapshot data — there is nothing to report.
//
// One rule drives every month: a position contributes its most recent snapshot
// with month <= M (carry-forward), provided it isn't terminated before M; a
// contributing snapshot older than M flags the position stale (ADR-0006).
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

	lastIdx := maxIdx
	if ci := monthIndex(in.currentMonth); ci > lastIdx {
		lastIdx = ci
	}

	positions := sortedPositions(in.positions)

	out := make([]monthlyReportData, 0, lastIdx-minIdx+1)
	for idx := minIdx; idx <= lastIdx; idx++ {
		m := monthlyReportData{
			yearMonth:      monthFromIndex(idx),
			userBreakdowns: make(map[string]userBreakdown, len(in.members)+1),
			stalePositions: []uuid.UUID{},
		}
		for _, u := range in.members {
			m.userBreakdowns[u.String()] = userBreakdown{NW: decimal.Zero}
		}
		m.userBreakdowns[jointKey] = userBreakdown{NW: decimal.Zero}

		for _, p := range positions {
			if p.terminatedAt != nil && idx > monthIndex(*p.terminatedAt) {
				continue // contributes only through its termination month
			}
			carried, ok := latestAtOrBefore(byPos[p.id], idx)
			if !ok {
				continue // no snapshot yet — position not born for this month
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
			key := jointKey
			if p.ownershipType == "sole" && p.soleOwnerID != nil {
				key = p.soleOwnerID.String()
			}
			ub := m.userBreakdowns[key]
			ub.NW = ub.NW.Add(signed)
			m.userBreakdowns[key] = ub
		}

		m.nwTotal = m.nwAssets.Add(m.nwReceivables).Add(m.nwInvestments).Sub(m.nwLiabilities)
		out = append(out, m)
	}
	return out
}

// sortedPositions returns the positions in a stable order so stale_positions
// and breakdown accumulation are deterministic across runs.
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
