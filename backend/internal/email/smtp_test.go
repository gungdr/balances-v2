package email_test

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/kerti/balances-v2/backend/internal/email"
)

// TestSMTPMailer_SendToMailpit exercises the SMTPMailer against the local
// Mailpit instance from docker-compose. It is skipped automatically if
// Mailpit is not reachable, so this test is safe to run in environments
// without the dev stack up.
func TestSMTPMailer_SendToMailpit(t *testing.T) {
	conn, err := net.DialTimeout("tcp", "localhost:1025", 200*time.Millisecond)
	if err != nil {
		t.Skip("mailpit not reachable on localhost:1025; skipping")
	}
	_ = conn.Close()

	m, err := email.NewSMTPMailer(email.SMTPConfig{
		Host: "localhost",
		Port: 1025,
		From: "test@balances.local",
	})
	if err != nil {
		t.Fatalf("NewSMTPMailer: %v", err)
	}

	if err := m.Send(context.Background(), email.Message{
		To:      "recipient@example.com",
		Subject: "SMTP smoke test",
		HTML:    "<p>hello from <b>balances-v2</b></p>",
		Text:    "hello from balances-v2",
	}); err != nil {
		t.Fatalf("Send: %v", err)
	}
}
