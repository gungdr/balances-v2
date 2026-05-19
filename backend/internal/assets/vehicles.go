package assets

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/repo"
)

// ----- requests -----------------------------------------------------------

type createVehicleReq struct {
	DisplayName            string           `json:"display_name"               validate:"required"`
	Description            *string          `json:"description"`
	OwnershipType          string           `json:"ownership_type"             validate:"required,oneof=sole joint"`
	SoleOwnerUserID        *uuid.UUID       `json:"sole_owner_user_id"         validate:"required_if=OwnershipType sole"`
	NativeCurrency         string           `json:"native_currency"            validate:"required,iso4217"`
	VehicleType            string           `json:"vehicle_type"               validate:"required,oneof=car motorcycle other"`
	Make                   *string          `json:"make"`
	Model                  *string          `json:"model"`
	Year                   *int32           `json:"year"`
	PlateNumber            *string          `json:"plate_number"`
	AnnualDepreciationRate *decimal.Decimal `json:"annual_depreciation_rate"`
}

type updateVehicleReq struct {
	DisplayName            string           `json:"display_name"             validate:"required"`
	Description            *string          `json:"description"`
	VehicleType            string           `json:"vehicle_type"             validate:"required,oneof=car motorcycle other"`
	Make                   *string          `json:"make"`
	Model                  *string          `json:"model"`
	Year                   *int32           `json:"year"`
	PlateNumber            *string          `json:"plate_number"`
	AnnualDepreciationRate *decimal.Decimal `json:"annual_depreciation_rate"`
}

// ----- handlers -----------------------------------------------------------

func (h *Handlers) handleCreateVehicle(w http.ResponseWriter, r *http.Request) {
	var req createVehicleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	vehicle, err := h.repo.CreateVehicle(r.Context(), repo.CreateVehicleParams{
		DisplayName:            req.DisplayName,
		Description:            req.Description,
		OwnershipType:          req.OwnershipType,
		SoleOwnerUserID:        req.SoleOwnerUserID,
		NativeCurrency:         req.NativeCurrency,
		VehicleType:            req.VehicleType,
		Make:                   req.Make,
		Model:                  req.Model,
		Year:                   req.Year,
		PlateNumber:            req.PlateNumber,
		AnnualDepreciationRate: req.AnnualDepreciationRate,
	})
	if err != nil {
		writeRepoError(w, "create vehicle", err)
		return
	}
	writeJSON(w, http.StatusCreated, vehicle)
}

func (h *Handlers) handleListVehicles(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListVehicles(r.Context())
	if err != nil {
		writeRepoError(w, "list vehicles", err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handlers) handleGetVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	vehicle, err := h.repo.GetVehicle(r.Context(), id)
	if err != nil {
		writeRepoError(w, "get vehicle", err)
		return
	}
	writeJSON(w, http.StatusOK, vehicle)
}

func (h *Handlers) handleUpdateVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req updateVehicleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	vehicle, err := h.repo.UpdateVehicle(r.Context(), id, repo.UpdateVehicleParams{
		DisplayName:            req.DisplayName,
		Description:            req.Description,
		VehicleType:            req.VehicleType,
		Make:                   req.Make,
		Model:                  req.Model,
		Year:                   req.Year,
		PlateNumber:            req.PlateNumber,
		AnnualDepreciationRate: req.AnnualDepreciationRate,
	})
	if err != nil {
		writeRepoError(w, "update vehicle", err)
		return
	}
	writeJSON(w, http.StatusOK, vehicle)
}

func (h *Handlers) handleDeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteVehicle(r.Context(), id); err != nil {
		writeRepoError(w, "delete vehicle", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
