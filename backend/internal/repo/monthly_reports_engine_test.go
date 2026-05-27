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

// The transaction → cash mapping (ADR-0008): unit-deducting fees and rolled
// maturity portions move no cash; cash fees and cash-out dispositions do.
func TestEngine_TransactionCashFlows(t *testing.T) {
	amt := func(s string) *decimal.Decimal { v := dec(s); return &v }
	str := func(s string) *string { return &s }
	cases := []struct {
		name    string
		txn     reportTransaction
		in, out string
	}{
		{"buy", reportTransaction{txnType: "buy", amount: amt("350")}, "350", "0"},
		{"sell", reportTransaction{txnType: "sell", amount: amt("400")}, "0", "400"},
		{"coupon", reportTransaction{txnType: "coupon", amount: amt("50")}, "0", "50"},
		{"dividend", reportTransaction{txnType: "dividend", amount: amt("30")}, "0", "30"},
		{"distribution", reportTransaction{txnType: "distribution", amount: amt("20")}, "0", "20"},
		{"fee cash", reportTransaction{txnType: "fee", amount: amt("10")}, "10", "0"},
		{"fee unit-deducted", reportTransaction{txnType: "fee", amount: amt("10"), quantity: amt("2")}, "0", "0"},
		{"maturity both cash_out", reportTransaction{txnType: "maturity", principalAmount: amt("1000"), interestAmount: amt("55"), principalDisposition: str("cash_out"), interestDisposition: str("cash_out")}, "0", "1055"},
		{"maturity both rolled", reportTransaction{txnType: "maturity", principalAmount: amt("1000"), interestAmount: amt("55"), principalDisposition: str("rolled_to_new"), interestDisposition: str("rolled_to_new")}, "0", "0"},
		{"maturity P rolled / I cash", reportTransaction{txnType: "maturity", principalAmount: amt("1000"), interestAmount: amt("55"), principalDisposition: str("rolled_to_new"), interestDisposition: str("cash_out")}, "0", "55"},
	}
	for _, c := range cases {
		cf := transactionCashFlows(c.txn)
		if !cf.in.Equal(dec(c.in)) || !cf.out.Equal(dec(c.out)) {
			t.Errorf("%s: got in=%s out=%s, want in=%s out=%s", c.name, cf.in, cf.out, c.in, c.out)
		}
	}
}

// The income statement: earned income by category, investment return,
// property/vehicle asset value change isolated from the residual, and the
// comprehensive-income identity closing. Baseline month suppresses the derived
// lines. Vehicle depreciation must land in asset_value_change, not expenses.
func TestEngine_IncomeStatement(t *testing.T) {
	bank, veh, stock := uuid.New(), uuid.New(), uuid.New()
	in := reportEngineInput{
		positions: []reportPosition{
			{id: bank, group: groupAsset, subtype: "bank_account", ownershipType: "joint"},
			{id: veh, group: groupAsset, subtype: "vehicle", ownershipType: "joint"},
			{id: stock, group: groupInvestment, subtype: "stock", ownershipType: "joint"},
		},
		snapshots: []reportSnapshot{
			{positionID: bank, yearMonth: ym(2026, time.January), amount: dec("1000")},
			{positionID: bank, yearMonth: ym(2026, time.February), amount: dec("900")},
			{positionID: veh, yearMonth: ym(2026, time.January), amount: dec("200")},
			{positionID: veh, yearMonth: ym(2026, time.February), amount: dec("197")},
			{positionID: stock, yearMonth: ym(2026, time.January), amount: dec("500")},
			{positionID: stock, yearMonth: ym(2026, time.February), amount: dec("560")},
		},
		income: []reportIncome{
			{yearMonth: ym(2026, time.February), amount: dec("50"), category: "salary", ownershipType: "joint"},
		},
		currentMonth: ym(2026, time.February),
	}
	reports := generateMonthlyReports(in)
	jan := findMonth(t, reports, ym(2026, time.January))
	feb := findMonth(t, reports, ym(2026, time.February))

	// Baseline (Jan): derived lines suppressed; earned income still present (0).
	if jan.investmentReturn != nil || jan.assetValueChange != nil || jan.livingExpenses != nil {
		t.Errorf("Jan baseline: derived lines should be nil, got return=%v assetΔ=%v exp=%v",
			jan.investmentReturn, jan.assetValueChange, jan.livingExpenses)
	}
	if !jan.earnedIncome.total.Equal(dec("0")) {
		t.Errorf("Jan earned income: got %s, want 0", jan.earnedIncome.total)
	}

	// Feb income statement.
	if !feb.earnedIncome.salary.Equal(dec("50")) || !feb.earnedIncome.total.Equal(dec("50")) {
		t.Errorf("Feb earned income: got total=%s salary=%s, want 50/50", feb.earnedIncome.total, feb.earnedIncome.salary)
	}
	if feb.investmentReturn == nil || !feb.investmentReturn.total.Equal(dec("60")) || !feb.investmentReturn.stock.Equal(dec("60")) {
		t.Fatalf("Feb investment return: %+v, want total/stock=60", feb.investmentReturn)
	}
	if feb.assetValueChange == nil || !feb.assetValueChange.Equal(dec("-3")) {
		t.Fatalf("Feb asset value change: %v, want -3 (vehicle only; bank excluded)", feb.assetValueChange)
	}
	if feb.livingExpenses == nil || !feb.livingExpenses.Equal(dec("150")) {
		t.Fatalf("Feb living expenses: %v, want 150 (cash residual, depreciation excluded)", feb.livingExpenses)
	}
	// Identity closes: ΔNW == earned + return + assetΔ − expenses.
	deltaNW := feb.nwTotal.Sub(jan.nwTotal)
	rhs := feb.earnedIncome.total.Add(feb.investmentReturn.total).Add(*feb.assetValueChange).Sub(*feb.livingExpenses)
	if !deltaNW.Equal(rhs) {
		t.Errorf("identity broken: ΔNW=%s != earned+return+assetΔ−expenses=%s", deltaNW, rhs)
	}
}

// Multi-currency: a foreign holding is converted to the reporting currency at
// the month's rate, and the rate is recorded in fx_rates_used.
func TestEngine_FxConversion(t *testing.T) {
	usdAcct := uuid.New()
	in := reportEngineInput{
		reportingCurrency: "IDR",
		multiCurrency:     true,
		positions:         []reportPosition{{id: usdAcct, group: groupAsset, subtype: "bank_account", ownershipType: "joint"}},
		snapshots:         []reportSnapshot{{positionID: usdAcct, yearMonth: ym(2026, time.January), amount: dec("100"), currency: "USD"}},
		fxRates:           []reportFxRate{{currency: "USD", yearMonth: ym(2026, time.January), rate: dec("16000")}},
		currentMonth:      ym(2026, time.January),
	}
	r := findMonth(t, generateMonthlyReports(in), ym(2026, time.January))
	if !r.nwTotal.Equal(dec("1600000")) { // 100 USD × 16000
		t.Errorf("nwTotal: got %s, want 1600000", r.nwTotal)
	}
	if got := r.fxRatesUsed["USD"]; !got.Equal(dec("16000")) {
		t.Errorf("fx_rates_used[USD]: got %s, want 16000", got)
	}
	if len(r.missingFx) != 0 {
		t.Errorf("missingFx: got %v, want empty", r.missingFx)
	}
}

// A rate carries forward to later months that have no rate of their own.
func TestEngine_FxCarryForward(t *testing.T) {
	usdAcct := uuid.New()
	in := reportEngineInput{
		reportingCurrency: "IDR",
		multiCurrency:     true,
		positions:         []reportPosition{{id: usdAcct, group: groupAsset, subtype: "bank_account", ownershipType: "joint"}},
		snapshots: []reportSnapshot{
			{positionID: usdAcct, yearMonth: ym(2026, time.January), amount: dec("100"), currency: "USD"},
			{positionID: usdAcct, yearMonth: ym(2026, time.February), amount: dec("100"), currency: "USD"},
		},
		fxRates:      []reportFxRate{{currency: "USD", yearMonth: ym(2026, time.January), rate: dec("16000")}}, // Jan only
		currentMonth: ym(2026, time.February),
	}
	feb := findMonth(t, generateMonthlyReports(in), ym(2026, time.February))
	if !feb.nwTotal.Equal(dec("1600000")) { // carries Jan's rate
		t.Errorf("Feb nwTotal: got %s, want 1600000 (Jan rate carried)", feb.nwTotal)
	}
}

// A foreign currency with no rate at or before the month excludes those
// positions from net worth and records them in missing_fx — never 1:1.
func TestEngine_FxMissingRate(t *testing.T) {
	usdAcct, idrAcct := uuid.New(), uuid.New()
	in := reportEngineInput{
		reportingCurrency: "IDR",
		multiCurrency:     true,
		positions: []reportPosition{
			{id: usdAcct, group: groupAsset, subtype: "bank_account", ownershipType: "joint"},
			{id: idrAcct, group: groupAsset, subtype: "bank_account", ownershipType: "joint"},
		},
		snapshots: []reportSnapshot{
			{positionID: usdAcct, yearMonth: ym(2026, time.January), amount: dec("100"), currency: "USD"},
			{positionID: idrAcct, yearMonth: ym(2026, time.January), amount: dec("500"), currency: "IDR"},
		},
		// no USD rate
		currentMonth: ym(2026, time.January),
	}
	r := findMonth(t, generateMonthlyReports(in), ym(2026, time.January))
	if !r.nwTotal.Equal(dec("500")) { // only the IDR account counts
		t.Errorf("nwTotal: got %s, want 500 (USD excluded)", r.nwTotal)
	}
	if len(r.missingFx) != 1 || r.missingFx[0].Currency != "USD" || r.missingFx[0].PositionID == nil || *r.missingFx[0].PositionID != usdAcct {
		t.Errorf("missingFx: got %+v, want one USD entry for the usd account", r.missingFx)
	}
}

// Regression: with multi-currency off the converter is a no-op — amounts sum at
// face value, no missing_fx, no fx_rates_used (the single-currency path).
func TestEngine_FxOffPathUnchanged(t *testing.T) {
	acct := uuid.New()
	in := reportEngineInput{
		reportingCurrency: "IDR",
		multiCurrency:     false, // off
		positions:         []reportPosition{{id: acct, group: groupAsset, subtype: "bank_account", ownershipType: "joint"}},
		snapshots:         []reportSnapshot{{positionID: acct, yearMonth: ym(2026, time.January), amount: dec("100"), currency: "USD"}},
		fxRates:           []reportFxRate{{currency: "USD", yearMonth: ym(2026, time.January), rate: dec("16000")}},
		currentMonth:      ym(2026, time.January),
	}
	r := findMonth(t, generateMonthlyReports(in), ym(2026, time.January))
	if !r.nwTotal.Equal(dec("100")) { // face value, no conversion
		t.Errorf("nwTotal: got %s, want 100 (off path, no conversion)", r.nwTotal)
	}
	if len(r.missingFx) != 0 || len(r.fxRatesUsed) != 0 {
		t.Errorf("off path should not produce missingFx (%v) or fxRatesUsed (%v)", r.missingFx, r.fxRatesUsed)
	}
}

// Investment return counts the transaction cash flow: a Buy reduces return by
// the cash put in, so a holding that rose 400 on 300 of new cash returns 100.
func TestEngine_InvestmentReturnWithCashFlow(t *testing.T) {
	stock := uuid.New()
	buy := dec("300")
	in := reportEngineInput{
		positions: []reportPosition{{id: stock, group: groupInvestment, subtype: "stock", ownershipType: "joint"}},
		snapshots: []reportSnapshot{
			{positionID: stock, yearMonth: ym(2026, time.January), amount: dec("500")},
			{positionID: stock, yearMonth: ym(2026, time.February), amount: dec("500")},
			{positionID: stock, yearMonth: ym(2026, time.March), amount: dec("900")},
		},
		transactions: []reportTransaction{
			{investmentID: stock, yearMonth: ym(2026, time.March), txnType: "buy", amount: &buy},
		},
		currentMonth: ym(2026, time.March),
	}
	mar := findMonth(t, generateMonthlyReports(in), ym(2026, time.March))
	if mar.investmentReturn == nil || !mar.investmentReturn.total.Equal(dec("100")) {
		t.Fatalf("Mar return: %+v, want 100 (Δsnapshot 400 − cashIn 300)", mar.investmentReturn)
	}
}
