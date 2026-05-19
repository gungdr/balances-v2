package httpserver

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/config"
)

type Server struct {
	pool    *pgxpool.Pool
	cfg     *config.Config
	authH   *auth.Handlers
	router  chi.Router
}

func New(pool *pgxpool.Pool, cfg *config.Config, authH *auth.Handlers) *Server {
	s := &Server{pool: pool, cfg: cfg, authH: authH}
	s.router = s.buildRouter()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) buildRouter() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(s.authH.SessionMiddleware)

	r.Get("/healthz", s.handleHealthz)

	r.Route("/api", func(r chi.Router) {
		s.authH.Mount(r)
	})

	return r
}
