package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	DatabaseURL string `env:"DATABASE_URL,required"`
	Port        int    `env:"PORT" envDefault:"8080"`
	LogFormat   string `env:"LOG_FORMAT" envDefault:"text"`

	GoogleClientID     string        `env:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string        `env:"GOOGLE_CLIENT_SECRET"`
	OAuthRedirectURL   string        `env:"OAUTH_REDIRECT_URL" envDefault:"http://localhost:8080/api/auth/google/callback"`
	FrontendURL        string        `env:"FRONTEND_URL" envDefault:"http://localhost:5173"`
	SessionTTL         time.Duration `env:"SESSION_TTL" envDefault:"720h"`
	CookieSecure       bool          `env:"COOKIE_SECURE" envDefault:"false"`

	SMTPHost         string `env:"SMTP_HOST" envDefault:"localhost"`
	SMTPPort         int    `env:"SMTP_PORT" envDefault:"1025"`
	SMTPUsername     string `env:"SMTP_USERNAME"`
	SMTPPassword     string `env:"SMTP_PASSWORD"`
	EmailFromAddress string `env:"EMAIL_FROM_ADDRESS" envDefault:"noreply@balances.local"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("env parse: %w", err)
	}
	return &cfg, nil
}
