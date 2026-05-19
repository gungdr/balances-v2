package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/kerti/balances-v2/backend/internal/auth"
	"github.com/kerti/balances-v2/backend/internal/config"
	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/httpserver"
	"github.com/kerti/balances-v2/backend/internal/migrations"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "serve":
		if err := serveCmd(); err != nil {
			slog.Error("server stopped", "err", err)
			os.Exit(1)
		}
	case "migrate":
		if err := migrateCmd(os.Args[2:]); err != nil {
			slog.Error("migrate failed", "err", err)
			os.Exit(1)
		}
	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: balances <command> [args]")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "commands:")
	fmt.Fprintln(os.Stderr, "  serve              run the HTTP server")
	fmt.Fprintln(os.Stderr, "  migrate up         apply all pending migrations")
	fmt.Fprintln(os.Stderr, "  migrate up-by-one  apply the next migration")
	fmt.Fprintln(os.Stderr, "  migrate down       roll back one migration")
	fmt.Fprintln(os.Stderr, "  migrate status     show migration status")
	fmt.Fprintln(os.Stderr, "  migrate version    show current revision")
}

func serveCmd() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	slog.SetDefault(newLogger(cfg))

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}
	defer pool.Close()

	queries := db.New(pool)

	authH, err := auth.New(ctx, queries, auth.Config{
		Google: auth.GoogleConfig{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.OAuthRedirectURL,
		},
		SessionTTL:   cfg.SessionTTL,
		CookieSecure: cfg.CookieSecure,
		FrontendURL:  cfg.FrontendURL,
	})
	if err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	srv := httpserver.New(pool, cfg, authH)

	httpSrv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	slog.Info("server starting", "addr", httpSrv.Addr)

	errCh := make(chan error, 1)
	go func() {
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case <-ctx.Done():
		slog.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpSrv.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

func migrateCmd(args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	slog.SetDefault(newLogger(cfg))

	if len(args) == 0 {
		args = []string{"status"}
	}

	dbConn, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer dbConn.Close()

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	cmd := args[0]
	var rest []string
	if len(args) > 1 {
		rest = args[1:]
	}

	return goose.RunContext(context.Background(), cmd, dbConn, ".", rest...)
}

func newLogger(cfg *config.Config) *slog.Logger {
	opts := &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelInfo,
	}
	var handler slog.Handler
	if cfg.LogFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}
