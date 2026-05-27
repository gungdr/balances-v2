package auth

import (
	"context"
	"net/http"
	"testing"

	"github.com/kerti/balances-v2/backend/internal/db"
)

func TestHandleUpdateHouseholdSettings(t *testing.T) {
	h := newAuthHarness(t)

	t.Run("200 enable multi-currency", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/household/settings", map[string]any{
			"reporting_currency": "IDR", "multi_currency_enabled": true,
		})
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[householdSettings](t, rec)
		if !body.MultiCurrencyEnabled {
			t.Errorf("multi_currency_enabled: got false, want true")
		}
	})

	t.Run("400 bad reporting currency", func(t *testing.T) {
		rec := h.do(t, "PATCH", "/household/settings", map[string]any{
			"reporting_currency": "RUPIAH", "multi_currency_enabled": true,
		})
		requireStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("409 disable while foreign positions exist", func(t *testing.T) {
		if _, err := h.q.CreateAsset(context.Background(), db.CreateAssetParams{
			HouseholdID: h.user.HouseholdID, DisplayName: "USD acct", Subtype: "bank_account",
			OwnershipType: "joint", NativeCurrency: "USD", CreatedBy: &h.user.ID,
		}); err != nil {
			t.Fatalf("seed USD asset: %v", err)
		}
		rec := h.do(t, "PATCH", "/household/settings", map[string]any{
			"reporting_currency": "IDR", "multi_currency_enabled": false,
		})
		requireStatus(t, rec, http.StatusConflict)
	})

	t.Run("401 unauthenticated", func(t *testing.T) {
		rec := h.doRaw(t, "PATCH", "/household/settings", map[string]any{
			"reporting_currency": "IDR", "multi_currency_enabled": true,
		}, nil)
		requireStatus(t, rec, http.StatusUnauthorized)
	})
}

func TestHandleMe_IncludesCurrencySettings(t *testing.T) {
	h := newAuthHarness(t)
	rec := h.do(t, "GET", "/me", nil)
	requireStatus(t, rec, http.StatusOK)
	body := decodeBody[meResponse](t, rec)
	if body.ReportingCurrency != "IDR" {
		t.Errorf("reporting_currency: got %q, want IDR", body.ReportingCurrency)
	}
}
