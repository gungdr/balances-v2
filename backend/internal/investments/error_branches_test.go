package investments_test

import (
	"net/http"
	"testing"
)

// TestInvestmentHandlers_ErrorBranches consolidates the 400-branch tests that
// don't fit naturally inside the per-resource Create/Update/Delete suites:
// invalid-UUID path params on PATCH/DELETE, malformed JSON bodies on PATCH,
// validator failures on snapshot/transaction Update, and bad-date branches on
// subtype PATCH that the per-resource suites only test on POST.
func TestInvestmentHandlers_ErrorBranches(t *testing.T) {
	h := newHarness(t)
	stock := h.createStock(t, "Err branches stock")
	bond := h.createBond(t, "Err branches bond")
	gold := h.createGold(t, "Err branches gold")
	mf := h.createMutualFund(t, "Err branches MF")
	td := h.createTimeDeposit(t, "Err branches TD")

	// Seed one snapshot + one transaction we can target for PATCH/DELETE.
	snapRec := h.do(t, "POST", "/investments/"+stock.Investment.ID.String()+"/snapshots", map[string]any{
		"year_month":     "2026-01",
		"amount":         "1",
		"currency":       "IDR",
		"quantity":       "1",
		"price_per_unit": "1",
	})
	requireStatus(t, snapRec, http.StatusCreated)
	snapID := decodeBody[map[string]any](t, snapRec)["id"].(string)

	txnRec := h.do(t, "POST", "/investments/"+stock.Investment.ID.String()+"/transactions", map[string]any{
		"transaction_type": "buy",
		"transaction_date": "2026-01-15",
		"currency":         "IDR",
		"amount":           "100",
		"quantity":         "1",
		"price_per_unit":   "100",
	})
	requireStatus(t, txnRec, http.StatusCreated)
	txnID := decodeBody[map[string]any](t, txnRec)["id"].(string)

	// ----- subtype PATCH/DELETE bad id and bad json --------------------------

	type subtypePatch struct {
		name string
		path string
		body map[string]any
	}
	patches := []subtypePatch{
		{"stock", "/investments/stocks/" + stock.Investment.ID.String(), map[string]any{
			"display_name": "x", "ticker": "x", "exchange": "x",
		}},
		{"bond", "/investments/bonds/" + bond.Investment.ID.String(), map[string]any{
			"display_name": "x", "bond_type": "secondary_market", "issuer": "x",
			"face_value": "1", "coupon_rate": "1", "coupon_frequency": "annual",
			"maturity_date": "2030-01-01",
		}},
		{"gold", "/investments/golds/" + gold.Investment.ID.String(), map[string]any{
			"display_name": "x", "form": "bar", "purity": "0.999",
		}},
		{"mutual_fund", "/investments/mutual-funds/" + mf.Investment.ID.String(), map[string]any{
			"display_name": "x", "fund_code": "x",
		}},
		{"time_deposit", "/investments/time-deposits/" + td.Investment.ID.String(), map[string]any{
			"display_name": "x", "bank_name": "x", "principal": "1",
			"interest_rate": "1", "term_months": 6,
			"placement_date": "2026-01-01", "maturity_date": "2026-07-01",
			"rollover_policy": "no_rollover",
		}},
	}

	// PATCH with an unparseable UUID and PATCH with malformed JSON.
	for _, p := range patches {
		p := p
		// Replace the id portion with not-a-uuid by chopping the trailing UUID.
		// Path shape: /investments/<resource>/<uuid>; we want /investments/<resource>/not-a-uuid.
		badIDPath := p.path[:len(p.path)-36] + "not-a-uuid"
		t.Run(p.name+" PATCH invalid id", func(t *testing.T) {
			rec := h.do(t, "PATCH", badIDPath, p.body)
			requireStatus(t, rec, http.StatusBadRequest)
		})
		t.Run(p.name+" PATCH invalid json", func(t *testing.T) {
			rec := h.do(t, "PATCH", p.path, "{not-json")
			requireStatus(t, rec, http.StatusBadRequest)
		})
		t.Run(p.name+" DELETE invalid id", func(t *testing.T) {
			rec := h.do(t, "DELETE", badIDPath, nil)
			requireStatus(t, rec, http.StatusBadRequest)
		})
	}

	// ----- bond/TD PATCH bad date formats (existing tests cover POST only) ---

	t.Run("bond PATCH bad maturity_date", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/bonds/"+bond.Investment.ID.String(), map[string]any{
			"display_name": "x", "bond_type": "secondary_market", "issuer": "x",
			"face_value": "1", "coupon_rate": "1", "coupon_frequency": "annual",
			"maturity_date": "01/01/2030",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("TD PATCH bad placement_date", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/time-deposits/"+td.Investment.ID.String(), map[string]any{
			"display_name": "x", "bank_name": "x", "principal": "1",
			"interest_rate": "1", "term_months": 6,
			"placement_date": "01/01/2026", "maturity_date": "2026-07-01",
			"rollover_policy": "no_rollover",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("TD PATCH bad maturity_date", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/investments/time-deposits/"+td.Investment.ID.String(), map[string]any{
			"display_name": "x", "bank_name": "x", "principal": "1",
			"interest_rate": "1", "term_months": 6,
			"placement_date": "2026-01-01", "maturity_date": "07/01/2026",
			"rollover_policy": "no_rollover",
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	// ----- snapshots: List/Update/Delete error branches ----------------------

	t.Run("snapshot list invalid investment id", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/not-a-uuid/snapshots", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/snapshots/not-a-uuid",
			map[string]any{"amount": "1", "currency": "IDR", "quantity": "1", "price_per_unit": "1"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/snapshots/"+snapID,
			"{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH missing required amount", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/snapshots/"+snapID,
			map[string]any{"currency": "IDR", "quantity": "1", "price_per_unit": "1"})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot PATCH bad as_of_date", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/snapshots/"+snapID,
			map[string]any{
				"amount": "1", "currency": "IDR", "quantity": "1", "price_per_unit": "1",
				"as_of_date": "tomorrow",
			})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("snapshot DELETE invalid snapshot id", func(t *testing.T) {
		rec := h.do(t, "DELETE",
			"/investments/"+stock.Investment.ID.String()+"/snapshots/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	// ----- transactions: List/Update/Delete error branches -------------------

	t.Run("transaction list invalid investment id", func(t *testing.T) {
		rec := h.do(t, "GET", "/investments/not-a-uuid/transactions", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("transaction PATCH invalid txn id", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/transactions/not-a-uuid",
			map[string]any{
				"transaction_date": "2026-01-01", "currency": "IDR", "amount": "1",
				"quantity": "1", "price_per_unit": "1",
			})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("transaction PATCH invalid json", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/transactions/"+txnID,
			"{not-json")
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("transaction PATCH missing required currency", func(t *testing.T) {
		rec := h.do(t, "PATCH",
			"/investments/"+stock.Investment.ID.String()+"/transactions/"+txnID,
			map[string]any{
				"transaction_date": "2026-01-01", "amount": "1",
				"quantity": "1", "price_per_unit": "1",
			})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("transaction DELETE invalid txn id", func(t *testing.T) {
		rec := h.do(t, "DELETE",
			"/investments/"+stock.Investment.ID.String()+"/transactions/not-a-uuid", nil)
		requireStatus(t, rec, http.StatusBadRequest)
	})
}
