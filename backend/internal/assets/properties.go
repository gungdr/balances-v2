package assets

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

// ----- requests -----------------------------------------------------------

type createPropertyReq struct {
	DisplayName            string           `json:"display_name"               validate:"required"`
	Description            *string          `json:"description"`
	OwnershipType          string           `json:"ownership_type"             validate:"required,oneof=sole joint"`
	SoleOwnerUserID        *uuid.UUID       `json:"sole_owner_user_id"         validate:"required_if=OwnershipType sole"`
	NativeCurrency         string           `json:"native_currency"            validate:"required,iso4217"`
	PropertyType           string           `json:"property_type"              validate:"required,oneof=house apartment land commercial"`
	Address                *string          `json:"address"`
	AcquisitionDate        *string          `json:"acquisition_date"`
	AcquisitionCost        *decimal.Decimal `json:"acquisition_cost"`
	AnnualAmortizationRate *decimal.Decimal `json:"annual_amortization_rate"`
}

type updatePropertyReq struct {
	DisplayName            string           `json:"display_name"             validate:"required"`
	Description            *string          `json:"description"`
	PropertyType           string           `json:"property_type"            validate:"required,oneof=house apartment land commercial"`
	Address                *string          `json:"address"`
	AcquisitionDate        *string          `json:"acquisition_date"`
	AcquisitionCost        *decimal.Decimal `json:"acquisition_cost"`
	AnnualAmortizationRate *decimal.Decimal `json:"annual_amortization_rate"`
}

// ----- handlers -----------------------------------------------------------

func (h *Handlers) handleCreateProperty(w http.ResponseWriter, r *http.Request) {
	var req createPropertyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	acquisitionDate, err := parseOptionalDate(req.AcquisitionDate, "acquisition_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	property, err := h.repo.CreateProperty(r.Context(), repo.CreatePropertyParams{
		DisplayName:            req.DisplayName,
		Description:            req.Description,
		OwnershipType:          req.OwnershipType,
		SoleOwnerUserID:        req.SoleOwnerUserID,
		NativeCurrency:         req.NativeCurrency,
		PropertyType:           req.PropertyType,
		Address:                req.Address,
		AcquisitionDate:        acquisitionDate,
		AcquisitionCost:        req.AcquisitionCost,
		AnnualAmortizationRate: req.AnnualAmortizationRate,
	})
	if err != nil {
		writeRepoError(w, "create property", err)
		return
	}
	writeJSON(w, http.StatusCreated, property)
}

func (h *Handlers) handleListProperties(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListProperties(r.Context())
	if err != nil {
		writeRepoError(w, "list properties", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	property, err := h.repo.GetProperty(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get property", err)
		return
	}
	writeJSON(w, http.StatusOK, property)
}

func (h *Handlers) handleUpdateProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updatePropertyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	acquisitionDate, err := parseOptionalDate(req.AcquisitionDate, "acquisition_date")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	property, err := h.repo.UpdateProperty(r.Context(), id, repo.UpdatePropertyParams{
		DisplayName:            req.DisplayName,
		Description:            req.Description,
		PropertyType:           req.PropertyType,
		Address:                req.Address,
		AcquisitionDate:        acquisitionDate,
		AcquisitionCost:        req.AcquisitionCost,
		AnnualAmortizationRate: req.AnnualAmortizationRate,
	})
	if err != nil {
		writeRepoError(w, "update property", err)
		return
	}
	writeJSON(w, http.StatusOK, property)
}

func (h *Handlers) handleDeleteProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteProperty(r.Context(), id); err != nil {
		writeRepoError(w, "delete property", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseOptionalDate parses an optional ISO date string ("YYYY-MM-DD") into a
// *time.Time. nil-or-empty input yields nil with no error.
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
