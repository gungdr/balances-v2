package assets

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/httperr"
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
	AnnualAppreciationRate *decimal.Decimal `json:"annual_appreciation_rate"`
}

type updatePropertyReq struct {
	DisplayName            string           `json:"display_name"             validate:"required"`
	Description            *string          `json:"description"`
	OwnershipType          string           `json:"ownership_type"           validate:"required,oneof=sole joint"`
	SoleOwnerUserID        *uuid.UUID       `json:"sole_owner_user_id"       validate:"required_if=OwnershipType sole"`
	PropertyType           string           `json:"property_type"            validate:"required,oneof=house apartment land commercial"`
	Address                *string          `json:"address"`
	AcquisitionDate        *string          `json:"acquisition_date"`
	AcquisitionCost        *decimal.Decimal `json:"acquisition_cost"`
	AnnualAppreciationRate *decimal.Decimal `json:"annual_appreciation_rate"`
}

// ----- handlers -----------------------------------------------------------

func (h *Handlers) handleCreateProperty(w http.ResponseWriter, r *http.Request) {
	var req createPropertyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httperr.Write(w, http.StatusBadRequest, httperr.CodeInvalidJSONBody, nil)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		httperr.WriteValidation(w, err)
		return
	}

	acquisitionDate, ok := parseOptionalDate(req.AcquisitionDate)
	if !ok {
		writeInvalidDate(w, "acquisition_date")
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
		AnnualAppreciationRate: req.AnnualAppreciationRate,
	})
	if err != nil {
		httperr.WriteRepo(w, "create property", err)
		return
	}
	writeJSON(w, http.StatusCreated, property)
}

func (h *Handlers) handleListProperties(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListProperties(r.Context())
	if err != nil {
		httperr.WriteRepo(w, "list properties", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	property, err := h.repo.GetProperty(r.Context(), id)
	if err != nil {
		httperr.WriteRepo(w, "get property", err)
		return
	}
	writeJSON(w, http.StatusOK, property)
}

func (h *Handlers) handleUpdateProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	var req updatePropertyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httperr.Write(w, http.StatusBadRequest, httperr.CodeInvalidJSONBody, nil)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		httperr.WriteValidation(w, err)
		return
	}
	acquisitionDate, ok := parseOptionalDate(req.AcquisitionDate)
	if !ok {
		writeInvalidDate(w, "acquisition_date")
		return
	}

	property, err := h.repo.UpdateProperty(r.Context(), id, repo.UpdatePropertyParams{
		DisplayName:            req.DisplayName,
		Description:            req.Description,
		OwnershipType:          req.OwnershipType,
		SoleOwnerUserID:        req.SoleOwnerUserID,
		PropertyType:           req.PropertyType,
		Address:                req.Address,
		AcquisitionDate:        acquisitionDate,
		AcquisitionCost:        req.AcquisitionCost,
		AnnualAppreciationRate: req.AnnualAppreciationRate,
	})
	if err != nil {
		httperr.WriteRepo(w, "update property", err)
		return
	}
	writeJSON(w, http.StatusOK, property)
}

func (h *Handlers) handleDeleteProperty(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		writeInvalidID(w, "id")
		return
	}
	if err := h.repo.DeleteProperty(r.Context(), id); err != nil {
		httperr.WriteRepo(w, "delete property", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseOptionalDate parses an optional ISO date string ("YYYY-MM-DD") into a
// *time.Time. nil-or-empty input yields (nil, true); an unparseable string
// yields (nil, false) so the caller can emit INVALID_DATE with its known
// field name rather than threading the field through here.
func parseOptionalDate(s *string) (*time.Time, bool) {
	if s == nil || *s == "" {
		return nil, true
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, false
	}
	return &t, true
}
