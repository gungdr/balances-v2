package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/kerti/balances-v2/backend/internal/config"
)

// All env keys Config reads. clearConfigEnv unsets every one (restoring on
// cleanup) so a developer's sourced .env doesn't leak ambient values into the
// defaults assertions. Empty-string is NOT equivalent to unset for caarlos0/env
// — envDefault only applies when the var is genuinely absent — so we Unsetenv
// rather than t.Setenv("").
var configEnvKeys = []string{
	"DATABASE_URL", "PORT", "LOG_FORMAT",
	"GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OIDC_ISSUER_URL",
	"OAUTH_REDIRECT_URL", "FRONTEND_URL", "BACKEND_URL",
	"SESSION_TTL", "COOKIE_SECURE",
	"SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD",
	"EMAIL_FROM_ADDRESS",
}

func clearConfigEnv(t *testing.T) {
	t.Helper()
	for _, k := range configEnvKeys {
		if v, ok := os.LookupEnv(k); ok {
			_ = os.Unsetenv(k)
			k, v := k, v
			t.Cleanup(func() { _ = os.Setenv(k, v) })
		}
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearConfigEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/db")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.DatabaseURL != "postgres://localhost/db" {
		t.Errorf("DatabaseURL = %q", cfg.DatabaseURL)
	}
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want default 8080", cfg.Port)
	}
	if cfg.LogFormat != "text" {
		t.Errorf("LogFormat = %q, want default text", cfg.LogFormat)
	}
	if cfg.OIDCIssuerURL != "https://accounts.google.com" {
		t.Errorf("OIDCIssuerURL = %q", cfg.OIDCIssuerURL)
	}
	if cfg.SessionTTL != 720*time.Hour {
		t.Errorf("SessionTTL = %v, want 720h", cfg.SessionTTL)
	}
	if cfg.CookieSecure {
		t.Errorf("CookieSecure = true, want default false")
	}
	if cfg.SMTPPort != 1025 {
		t.Errorf("SMTPPort = %d, want default 1025", cfg.SMTPPort)
	}
	if cfg.EmailFromAddress != "noreply@balances.local" {
		t.Errorf("EmailFromAddress = %q", cfg.EmailFromAddress)
	}
}

func TestLoad_Overrides(t *testing.T) {
	clearConfigEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/db")
	t.Setenv("PORT", "9999")
	t.Setenv("LOG_FORMAT", "json")
	t.Setenv("SESSION_TTL", "1h")
	t.Setenv("COOKIE_SECURE", "true")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != 9999 {
		t.Errorf("Port = %d, want 9999", cfg.Port)
	}
	if cfg.LogFormat != "json" {
		t.Errorf("LogFormat = %q, want json", cfg.LogFormat)
	}
	if cfg.SessionTTL != time.Hour {
		t.Errorf("SessionTTL = %v, want 1h", cfg.SessionTTL)
	}
	if !cfg.CookieSecure {
		t.Errorf("CookieSecure = false, want true")
	}
}

func TestLoad_MissingRequiredDatabaseURL(t *testing.T) {
	clearConfigEnv(t) // unsets DATABASE_URL too

	if _, err := config.Load(); err == nil {
		t.Fatal("Load: want error when DATABASE_URL is unset, got nil")
	}
}

func TestLoad_InvalidValue(t *testing.T) {
	clearConfigEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/db")
	t.Setenv("PORT", "not-a-number")

	if _, err := config.Load(); err == nil {
		t.Fatal("Load: want error for non-integer PORT, got nil")
	}
}
