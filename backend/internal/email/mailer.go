// Package email exposes a Mailer interface for sending transactional email.
// The Mailer is wired behind an interface (per ADR-0020) so the concrete
// provider can be swapped without touching call sites — SMTP (dev / Mailpit)
// today, Resend or another provider in production later.
package email

import "context"

// Message is the payload sent through any Mailer implementation.
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

// Mailer sends transactional email. Implementations are responsible for their
// own retry semantics; callers should treat Send as best-effort and log the
// error rather than block user-facing flows on it.
type Mailer interface {
	Send(ctx context.Context, msg Message) error
}
