package repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Pure unit tests for the monthly-report engine — no DB. These carry the
// net-worth rule coverage (carry-forward, gaps, birth, lifecycle suppression,
// per-user/Joint attribution incl. liability subtraction, stale flagging); the
// repo integration test only checks the plumbing.

func ym(y int, m time.Month) time.Time { return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC) }
func dec(s string) decimal.Decimal     { return decimal.RequireFromString(s) }

func findMonth(t *testing.T, reports []monthlyReportData, m time.Time) monthlyReportData {
	t.Helper()
	for _, r := range reports {
		if monthIndex(r.yearMonth) == monthIndex(m) {
			return r
		}
	}
	t.Fatalf("no report generated for %s", m.Format("2006-01"))
	return monthlyReportData{}
}

func contains(ids []uuid.UUID, id uuid.UUID) bool {
	for _, x := range ids {
		if x == id {
			return true
		}
	}
	return false
}

// Carry-forward covers the current month, a mid-history gap, and a never-yet-
// snapshotted (birth) month with one rule: latest snapshot <= M, stale-flagged
// when older than M.
func TestEngine_CarryForward(t *testing.T) {
	a := uuid.New()
	in := reportEngineInput{
		positions: []reportPosition{{id: a, group: groupAsset, ownershipType: "joint"}},
		snapshots: []reportSnapshot{
			{positionID: a, yearMonth: ym(2026, time.January), amount: dec("100")},
			{positionID: a, yearMonth: ym(2026, time.March), amount: dec("300")},
		},
		currentMonth: ym(2026, time.April),
	}
	reports := generateMonthlyReports(in)
	if len(reports) != 4 {
		t.Fatalf("got %d months, want 4 (Jan..Apr)", len(reports))
	}

	cases := []struct {
		month time.Month
		nw    string
		stale bool
	}{
		{time.January, "100", false}, // fresh
		{time.February, "100", true}, // gap → carries Jan
		{time.March, "300", false},   // fresh
		{time.April, "300", true},    // current → carries Mar
	}
	for _, c := range cases {
		r := findMonth(t, reports, ym(2026, c.month))
		if !r.nwTotal.Equal(dec(c.nw)) {
			t.Errorf("%s nwTotal: got %s, want %s", c.month, r.nwTotal, c.nw)
		}
		if got := contains(r.stalePositions, a); got != c.stale {
			t.Errorf("%s stale(a): got %v, want %v", c.month, got, c.stale)
		}
	}
}

// A position born in February contributes nothing to January.
func TestEngine_BirthMonth(t *testing.T) {
	a := uuid.New()
	in := reportEngineInput{
		positions:    []reportPosition{{id: a, group: groupAsset, ownershipType: "joint"}},
		snapshots:    []reportSnapshot{{positionID: a, yearMonth: ym(2026, time.February), amount: dec("500")}},
		currentMonth: ym(2026, time.February),
	}
	reports := generateMonthlyReports(in)
	// First month with data is February — January is never generated.
	if len(reports) != 1 {
		t.Fatalf("got %d months, want 1 (Feb only)", len(reports))
	}
	if mi := monthIndex(reports[0].yearMonth); mi != monthIndex(ym(2026, time.February)) {
		t.Fatalf("first month is not February")
	}
}

// A terminated position contributes through its termination month, then drops.
func TestEngine_TerminatedSuppression(t *testing.T) {
	a := uuid.New()
	feb := ym(2026, time.February)
	in := reportEngineInput{
		positions:    []reportPosition{{id: a, group: groupAsset, ownershipType: "joint", terminatedAt: &feb}},
		snapshots:    []reportSnapshot{{positionID: a, yearMonth: ym(2026, time.January), amount: dec("100")}},
		currentMonth: ym(2026, time.April),
	}
	reports := generateMonthlyReports(in)

	if r := findMonth(t, reports, ym(2026, time.February)); !r.nwTotal.Equal(dec("100")) {
		t.Errorf("Feb (termination month) nwTotal: got %s, want 100", r.nwTotal)
	}
	if r := findMonth(t, reports, ym(2026, time.March)); !r.nwTotal.Equal(dec("0")) {
		t.Errorf("Mar (post-termination) nwTotal: got %s, want 0", r.nwTotal)
	}
}

// Group sums and the per-user / Joint breakdown (with liability subtraction)
// reconcile with the total.
func TestEngine_GroupsAndBreakdown(t *testing.T) {
	alice, bob := uuid.New(), uuid.New()
	a1, a2 := uuid.New(), uuid.New()
	rcv, inv, liab := uuid.New(), uuid.New(), uuid.New()

	jan := ym(2026, time.January)
	in := reportEngineInput{
		members: []uuid.UUID{alice, bob},
		positions: []reportPosition{
			{id: a1, group: groupAsset, ownershipType: "joint"},
			{id: a2, group: groupAsset, ownershipType: "sole", soleOwnerID: &alice},
			{id: rcv, group: groupReceivable, ownershipType: "joint"},
			{id: inv, group: groupInvestment, ownershipType: "joint"},
			{id: liab, group: groupLiability, ownershipType: "sole", soleOwnerID: &bob},
		},
		snapshots: []reportSnapshot{
			{positionID: a1, yearMonth: jan, amount: dec("1000")},
			{positionID: a2, yearMonth: jan, amount: dec("600")},
			{positionID: rcv, yearMonth: jan, amount: dec("50")},
			{positionID: inv, yearMonth: jan, amount: dec("300")},
			{positionID: liab, yearMonth: jan, amount: dec("200")},
		},
		currentMonth: jan,
	}
	r := findMonth(t, generateMonthlyReports(in), jan)

	checks := map[string]struct{ got, want decimal.Decimal }{
		"nwAssets":      {r.nwAssets, dec("1600")},
		"nwReceivables": {r.nwReceivables, dec("50")},
		"nwInvestments": {r.nwInvestments, dec("300")},
		"nwLiabilities": {r.nwLiabilities, dec("200")},                // positive magnitude
		"nwTotal":       {r.nwTotal, dec("1750")},                     // 1600+50+300-200
		"joint":         {r.userBreakdowns[jointKey].NW, dec("1350")}, // 1000+50+300
		"alice":         {r.userBreakdowns[alice.String()].NW, dec("600")},
		"bob":           {r.userBreakdowns[bob.String()].NW, dec("-200")}, // liability subtracts
	}
	for name, c := range checks {
		if !c.got.Equal(c.want) {
			t.Errorf("%s: got %s, want %s", name, c.got, c.want)
		}
	}

	// Breakdown buckets reconcile with the total.
	sum := r.userBreakdowns[jointKey].NW.
		Add(r.userBreakdowns[alice.String()].NW).
		Add(r.userBreakdowns[bob.String()].NW)
	if !sum.Equal(r.nwTotal) {
		t.Errorf("breakdown sum %s != nwTotal %s", sum, r.nwTotal)
	}
}

// No snapshot data → nothing to report.
func TestEngine_EmptyIsNil(t *testing.T) {
	if got := generateMonthlyReports(reportEngineInput{currentMonth: ym(2026, time.January)}); got != nil {
		t.Errorf("empty input: got %v, want nil", got)
	}
}
