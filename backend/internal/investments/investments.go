// Package investments exposes HTTP handlers for the Investment position
// group. The handler layer is thin — it decodes JSON, validates the request,
// dispatches to repo.InvestmentRepo, and encodes the response. Subtype
// routes (stocks, mutual-funds, golds) sit alongside a shared
// /investments/{id}/snapshots route since investment_snapshots is one
// table per ADR-0022; the repo enforces the subtype→shape XOR mapping
// that the DB CHECK can't see.
package investments

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
	repo     *repo.InvestmentRepo
	validate *validator.Validate
}

func New(r *repo.InvestmentRepo) *Handlers {
	return &Handlers{
		repo:     r,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// Mount registers all investment routes under /investments. Caller mounts
// this under /api and applies SessionMiddleware higher up; RequireAuth is
// applied per-route here.
//
// Snapshots live under /investments/{id}/snapshots because the snapshot
// table is shared across all subtypes (ADR-0022). The repo validates
// shape (quantity+price for stock/mutual_fund/gold; accrued_interest
// for bond/time_deposit) based on the parent investment's subtype.
func (h *Handlers) Mount(r chi.Router) {
	r.Route("/investments", func(r chi.Router) {
		r.Use(auth.RequireAuth)

		r.Route("/stocks", func(r chi.Router) {
			r.Post("/", h.handleCreateStock)
			r.Get("/", h.handleListStocks)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.handleGetStock)
				r.Patch("/", h.handleUpdateStock)
				r.Delete("/", h.handleDeleteStock)
			})
		})

		r.Route("/mutual-funds", func(r chi.Router) {
			r.Post("/", h.handleCreateMutualFund)
			r.Get("/", h.handleListMutualFunds)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.handleGetMutualFund)
				r.Patch("/", h.handleUpdateMutualFund)
				r.Delete("/", h.handleDeleteMutualFund)
			})
		})

		r.Route("/golds", func(r chi.Router) {
			r.Post("/", h.handleCreateGold)
			r.Get("/", h.handleListGolds)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.handleGetGold)
				r.Patch("/", h.handleUpdateGold)
				r.Delete("/", h.handleDeleteGold)
			})
		})

		r.Route("/{id}/snapshots", func(r chi.Router) {
			r.Post("/", h.handleCreateSnapshot)
			r.Get("/", h.handleListSnapshots)
			r.Patch("/{snapshotID}", h.handleUpdateSnapshot)
			r.Delete("/{snapshotID}", h.handleDeleteSnapshot)
		})
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

// repoErrorStatus maps repo errors to HTTP statuses. ErrInvalidSnapshotShape
// is a client-side mistake (wrong value-column combo for the subtype) so it
// maps to 400 rather than 500.
func repoErrorStatus(err error) int {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, repo.ErrUnauthenticated):
		return http.StatusUnauthorized
	case errors.Is(err, repo.ErrInvalidSnapshotShape):
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
	return uuid.Parse(chi.URLParam(r, name))
}
