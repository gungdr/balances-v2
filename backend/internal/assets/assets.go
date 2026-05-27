// Package assets exposes HTTP handlers for the Asset position group.
// The handler layer is thin — it decodes JSON, validates the request via
// go-playground/validator, dispatches to repo.AssetRepo, and encodes the
// response. Tenancy enforcement lives in the repo + SQL layers (per
// ADR-0005 + M3.2 / M3.3); these handlers just thread the request context
// through.
package assets

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/repo"
)

type Handlers struct {
	repo     *repo.AssetRepo
	validate *validator.Validate
}

func New(r *repo.AssetRepo) *Handlers {
	return &Handlers{
		repo:     r,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// Mount registers all asset routes. Caller is expected to mount this under
// `/api` and apply SessionMiddleware at a higher level; RequireAuth is
// applied inside Mount so all routes are protected.
//
// Snapshots live under /assets/{id}/snapshots rather than under each
// subtype's path because the snapshot shape and storage table
// (asset_snapshots, per ADR-0022) are shared across all asset subtypes.
func (h *Handlers) Mount(r chi.Router) {
	r.Route("/bank-accounts", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreateBankAccount)
		r.Get("/", h.handleListBankAccounts)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.handleGetBankAccount)
			r.Patch("/", h.handleUpdateBankAccount)
			r.Delete("/", h.handleDeleteBankAccount)
		})
	})

	r.Route("/properties", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreateProperty)
		r.Get("/", h.handleListProperties)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.handleGetProperty)
			r.Patch("/", h.handleUpdateProperty)
			r.Delete("/", h.handleDeleteProperty)
		})
	})

	r.Route("/vehicles", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreateVehicle)
		r.Get("/", h.handleListVehicles)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.handleGetVehicle)
			r.Patch("/", h.handleUpdateVehicle)
			r.Delete("/", h.handleDeleteVehicle)
		})
	})

	r.Route("/assets/{id}/snapshots", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", h.handleCreateSnapshot)
		r.Get("/", h.handleListSnapshots)
		r.Patch("/{snapshotID}", h.handleUpdateSnapshot)
		r.Delete("/{snapshotID}", h.handleDeleteSnapshot)
		// Bulk import (M6 side item): download a scoped .xlsx template, then
		// upload a filled one. ?mode=preview (default) validates + counts;
		// ?mode=commit upserts all-or-nothing. Static segments, so no clash
		// with the /{snapshotID} routes above.
		r.Get("/import-template", h.handleImportTemplate)
		r.Post("/import", h.handleImportSnapshots)
	})

	// Lifecycle (status/terminated_at/termination_note) lives at the parent
	// /assets level — like snapshots — because it operates on the shared
	// `assets` table, not on subtype-specific fields (ADR-0009).
	r.Route("/assets/{id}/lifecycle", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Patch("/", h.handleUpdateLifecycle)
	})
}

// ----- helpers shared across handlers -------------------------------------

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

// repoErrorStatus maps repo errors to appropriate HTTP statuses.
// repo.ErrUnauthenticated is unreachable here — RequireAuth gates every
// route in Mount, so the repo's currentUser() helper always finds a user.
func repoErrorStatus(err error) int {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, repo.ErrInvalidLifecycle):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

func writeRepoError(w http.ResponseWriter, op string, err error) {
	status := repoErrorStatus(err)
	if status == http.StatusInternalServerError {
		slog.Error(op, "err", err)
		http.Error(w, "internal error", status)
		return
	}
	http.Error(w, err.Error(), status)
}

func parseIDParam(r *http.Request, name string) (uuid.UUID, error) {
	raw := chi.URLParam(r, name)
	return uuid.Parse(raw)
}
