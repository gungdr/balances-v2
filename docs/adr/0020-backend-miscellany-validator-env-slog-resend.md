# Backend miscellany: validator, env-config, slog, Resend

Four small decisions batched into one record so they don't fragment across micro-ADRs. None of these is load-bearing in the architectural sense, but each pins a default that we don't want to relitigate on every PR.

## Validation: `go-playground/validator/v10`

Struct-tag-based request validation. The de facto standard for Go HTTP services and the one most AI assistance assumes.

```go
type CreateIncomeRequest struct {
    Amount   decimal.Decimal `json:"amount" validate:"required,gt=0"`
    Currency string          `json:"currency" validate:"required,iso4217"`
    Category string          `json:"category" validate:"required,oneof=salary business rental gift tax_refund insurance other"`
}
```

A single shared `*validator.Validate` instance is constructed at startup; handlers decode the request body, call `Validate.Struct`, and return a 400 with field-level errors on failure.

**Considered alternatives:**
- `ozzo-validation` — programmatic style, cleaner for very complex cross-field rules. Rejected — adds a different validation flavour without strong upside at our rule complexity.
- Hand-rolled per-handler checks — fine for one or two endpoints, but multiplies with every new request type.

## Config: `caarlos0/env/v11`

Struct-based env-var loading with defaults and required-field enforcement. Replaces ad-hoc `os.Getenv` patterns.

```go
type Config struct {
    DatabaseURL       string        `env:"DATABASE_URL,required"`
    SessionTTL        time.Duration `env:"SESSION_TTL" envDefault:"720h"`
    GoogleClientID    string        `env:"GOOGLE_CLIENT_ID,required"`
    GoogleClientSecret string       `env:"GOOGLE_CLIENT_SECRET,required"`
    ResendAPIKey      string        `env:"RESEND_API_KEY,required"`
    EmailFromAddress  string        `env:"EMAIL_FROM_ADDRESS" envDefault:"noreply@example.com"`
    Port              int           `env:"PORT" envDefault:"8080"`
    LogLevel          string        `env:"LOG_LEVEL" envDefault:"info"`
}
```

Failing to start when a required env var is missing is the desired behaviour — better than discovering missing config on the first auth request.

**Considered alternatives:**
- Stdlib `os.Getenv` with a hand-rolled loader — viable but tedious. The library's worth its weight.
- `spf13/viper` — supports config files, flags, env, key-value stores. Overkill for an app that takes its config purely from environment variables.

## Logging: `log/slog` (stdlib)

Structured logging using the Go 1.21+ stdlib package. No external dependency, native JSON output for production, human-readable text for dev.

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    AddSource: true,
    Level:     parseLevel(cfg.LogLevel),
}))
slog.SetDefault(logger)

slog.Info("position created", "household_id", hid, "position_id", pid, "subtype", subtype)
```

Log lines emit JSON in production and text in dev (toggle via `LOG_FORMAT` env var). The `household_id` is added to every authenticated-request log line via a middleware that wraps the handler with `slog.With(...)`.

**Considered alternatives:**
- `zerolog` / `zap` — measurably faster, but the throughput difference is irrelevant at household-finance traffic. No reason to take on the dependency.
- `logrus` — maintenance mode; deprecated direction for new projects.

## Email delivery: Resend

For sending household-invitation emails (ADR-0017). Volume will be tiny — single digits of emails per month, ever.

Resend wins on developer experience:
- Simple REST API (`POST /emails`), can be called via stdlib `net/http` if we don't want the SDK.
- 3,000 emails/month free — ~3,000× our actual need.
- Modern templating (HTML + plaintext), no fights with old-school SMTP.
- First-class React-Email integration if we ever want richer templates.

**Considered alternatives:**
- **Postmark.** Excellent deliverability and developer experience. Lower free tier (100/month). Defensible if Resend deliverability ever becomes a concern; both speak REST, so swap is a config change.
- **Mailgun / SendGrid / Brevo / SES.** All workable. Pricier per email at scale, less polished APIs, or more setup overhead (SES).
- **SMTP relay via Gmail.** Rate-limited, against the Gmail ToS for application use, brittle. Don't.

The email sender is wrapped behind a small interface (`Mailer.Send(ctx, to, subject, htmlBody, textBody)`) so the concrete provider stays swappable.

## Consequences

- Four new dependencies on the Go side: `go-playground/validator`, `caarlos0/env`, `resend/resend-go` (or hand-rolled REST), and the stdlib `log/slog` (already available).
- `Mailer` interface in `internal/email/` keeps the provider behind a port, so future swaps are surgical.
- `Config` struct is loaded once in `main.go` and passed by value to subsystems that need it.
- Validation errors return field-level 400 responses to the frontend, formatted consistently so React Hook Form can map them back onto form fields.
- Log level and format are env-controlled; production runs JSON + info, dev runs text + debug.
