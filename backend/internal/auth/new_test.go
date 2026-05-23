package auth

import (
	"context"
	"strings"
	"testing"

	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/email"
	"github.com/kerti/balances-v2/backend/internal/testutil"
)

// TestNew_GoogleConfigValidation covers the short-circuit in newGoogleOAuth
// that rejects empty client_id/secret/redirect_url — the only branch of
// New that's reachable without contacting accounts.google.com. The
// happy-path constructor and the real exchange flow are exercised
// in production; tests substitute googleOAuthClient via installStubOAuth.

func TestNew_RejectsIncompleteGoogleConfig(t *testing.T) {
	tdb := testutil.NewTestDB(t)
	q := db.New(tdb.Pool)

	_, err := New(context.Background(), q, Config{
		// Google config left zero — newGoogleOAuth returns its sentinel error.
		Mailer:     stubMailerForNew{},
		BackendURL: "http://localhost:8080",
	})
	if err == nil {
		t.Fatal("New: expected error when Google config is empty")
	}
	if !strings.Contains(err.Error(), "client id") {
		t.Errorf("err: want mention of client id, got %v", err)
	}
}

// stubMailerForNew is a no-op mailer used purely to satisfy the cfg.Mailer
// non-nil requirement so that the GoogleConfig error path can fire first.
// Defined separately from helpers_test.go's stubMailer because we don't
// need the captured-messages bookkeeping here.
type stubMailerForNew struct{}

func (stubMailerForNew) Send(context.Context, email.Message) error { return nil }
