package httpserver

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kerti/balances-v2/backend/internal/assets"
	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/config"
	"github.com/kerti/balances-v2/backend/internal/fxrates"
	"github.com/kerti/balances-v2/backend/internal/income"
	"github.com/kerti/balances-v2/backend/internal/investments"
	"github.com/kerti/balances-v2/backend/internal/liabilities"
	"github.com/kerti/balances-v2/backend/internal/receivables"
	"github.com/kerti/balances-v2/backend/internal/reports"
	"github.com/kerti/balances-v2/backend/internal/tags"
)

type Server struct {
	pool         *pgxpool.Pool
	cfg          *config.Config
	authH        *auth.Handlers
	assetsH      *assets.Handlers
	liabilitiesH *liabilities.Handlers
	receivablesH *receivables.Handlers
	investmentsH *investments.Handlers
	incomeH      *income.Handlers
	reportsH     *reports.Handlers
	fxRatesH     *fxrates.Handlers
	tagsH        *tags.Handlers
	router       chi.Router
}

func New(
	pool *pgxpool.Pool,
	cfg *config.Config,
	authH *auth.Handlers,
	assetsH *assets.Handlers,
	liabilitiesH *liabilities.Handlers,
	receivablesH *receivables.Handlers,
	investmentsH *investments.Handlers,
	incomeH *income.Handlers,
	reportsH *reports.Handlers,
	fxRatesH *fxrates.Handlers,
	tagsH *tags.Handlers,
) *Server {
	s := &Server{
		pool:         pool,
		cfg:          cfg,
		authH:        authH,
		assetsH:      assetsH,
		liabilitiesH: liabilitiesH,
		receivablesH: receivablesH,
		investmentsH: investmentsH,
		incomeH:      incomeH,
		reportsH:     reportsH,
		fxRatesH:     fxRatesH,
		tagsH:        tagsH,
	}
	s.router = s.buildRouter()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) buildRouter() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	// No middleware.RealIP: it trusts X-Forwarded-For / X-Real-IP, which any
	// client can spoof when no trusted proxy sits in front (our case — see
	// docker-compose.yml). chi deprecated it for this reason (GHSA-3fxj-6jh8-hvhx).
	// If we ever deploy behind a known proxy, add a trusted-CIDR-aware extractor.
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(s.authH.SessionMiddleware)

	r.Get("/healthz", s.handleHealthz)

	r.Route("/api", func(r chi.Router) {
		s.authH.Mount(r)
		s.assetsH.Mount(r)
		s.liabilitiesH.Mount(r)
		s.receivablesH.Mount(r)
		s.investmentsH.Mount(r)
		s.incomeH.Mount(r)
		s.reportsH.Mount(r)
		s.fxRatesH.Mount(r)
		s.tagsH.Mount(r)
	})

	return r
}
