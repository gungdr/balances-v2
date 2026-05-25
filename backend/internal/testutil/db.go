// Package testutil contains test-only helpers shared across the backend.
// NewTestDB returns a pgxpool backed by a single Postgres container that is
// started and migrated once per test binary (i.e. once per package). Each
// call truncates all application tables, so every test sees a clean schema
// without paying for a fresh container + migration run. Because Go runs the
// tests within a package sequentially (none call t.Parallel), the shared
// pool needs no per-test locking.
package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // registers pgx as a database/sql driver for goose migrations
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/kerti/balances-v2/backend/internal/migrations"
)

type TestDB struct {
	Pool *pgxpool.Pool
}

// sharedDB holds the per-package container, lazily initialised by the first
// NewTestDB call. The container is reaped by the testcontainers Ryuk sidecar
// when the test process exits, so it needs no explicit teardown.
var (
	sharedOnce sync.Once
	sharedPool *pgxpool.Pool
	sharedErr  error
)

// NewTestDB returns a connection pool to a migrated, freshly-truncated
// Postgres. The first call in a package starts the container and applies
// migrations; subsequent calls reuse it and just truncate.
func NewTestDB(t *testing.T) *TestDB {
	t.Helper()

	sharedOnce.Do(func() {
		sharedPool, sharedErr = startSharedDB()
	})
	if sharedErr != nil {
		t.Fatalf("init shared test DB: %v", sharedErr)
	}

	truncateAll(t, sharedPool)
	return &TestDB{Pool: sharedPool}
}

// startSharedDB boots the Postgres container, applies the embedded production
// migrations, and opens a pgxpool. It is called exactly once per package.
func startSharedDB() (*pgxpool.Pool, error) {
	ctx := context.Background()

	container, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("balances_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("start postgres container: %w", err)
	}

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return nil, fmt.Errorf("get container dsn: %w", err)
	}

	// Apply migrations using the same embedded FS the app uses, so tests
	// run against bit-identical schema.
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}
	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("goose dialect: %w", err)
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate up: %w", err)
	}
	_ = db.Close()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	return pool, nil
}

// truncateAll empties every application table in one statement, resetting
// identity sequences. goose's bookkeeping table is left untouched so the
// schema stays migrated. The table list is read from the catalog so new
// migrations are covered automatically.
func truncateAll(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	rows, err := pool.Query(ctx, `
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> 'goose_db_version'`)
	if err != nil {
		t.Fatalf("list tables for truncate: %v", err)
	}
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			t.Fatalf("scan table name: %v", err)
		}
		tables = append(tables, `"`+name+`"`)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate tables: %v", err)
	}
	if len(tables) == 0 {
		return
	}

	stmt := "TRUNCATE " + strings.Join(tables, ", ") + " RESTART IDENTITY CASCADE"
	if _, err := pool.Exec(ctx, stmt); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}
