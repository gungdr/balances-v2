// Package testutil contains test-only helpers shared across the backend.
// NewTestDB spins up an ephemeral Postgres container via testcontainers-go,
// applies the production migrations, and returns a pgxpool ready to use.
// All test isolation strategies (per-test transactions, schema-per-test, etc.)
// are layered on top of the pool returned here.
package testutil

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/kerti/balances-v2/backend/internal/migrations"
)

type TestDB struct {
	Pool *pgxpool.Pool
}

// NewTestDB starts a Postgres container, applies migrations, and returns a
// connection pool. The container and pool are torn down via t.Cleanup.
func NewTestDB(t *testing.T) *TestDB {
	t.Helper()
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
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() { _ = container.Terminate(ctx) })

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get container dsn: %v", err)
	}

	// Apply migrations using the same embedded FS the app uses, so tests
	// run against bit-identical schema.
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		_ = db.Close()
		t.Fatalf("goose dialect: %v", err)
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		_ = db.Close()
		t.Fatalf("migrate up: %v", err)
	}
	_ = db.Close()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(func() { pool.Close() })

	return &TestDB{Pool: pool}
}
