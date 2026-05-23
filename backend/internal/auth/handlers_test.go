package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kerti/balances-v2/backend/internal/db"
)

func TestHandleStart(t *testing.T) {
	h := newAuthHarness(t)

	t.Run("redirects to Google AuthCodeURL with state cookie", func(t *testing.T) {
		rec := h.doRaw(t, "GET", "/auth/google/start", nil, nil)
		if rec.Code != http.StatusFound {
			t.Fatalf("status: want 302, got %d", rec.Code)
		}
		stateCookie := findCookie(rec, oauthStateCookieName)
		if stateCookie == nil || stateCookie.Value == "" {
			t.Fatal("expected oauth_state cookie to be set with a non-empty value")
		}
		if !stateCookie.HttpOnly {
			t.Error("oauth_state cookie should be HttpOnly")
		}

		loc, err := url.Parse(rec.Header().Get("Location"))
		if err != nil {
			t.Fatalf("parse Location: %v", err)
		}
		if !strings.Contains(loc.Host, "google") {
			t.Errorf("redirect host should be google: got %q", loc.Host)
		}
		if loc.Query().Get("state") != stateCookie.Value {
			t.Errorf("redirect state mismatch: cookie=%q, query=%q",
				stateCookie.Value, loc.Query().Get("state"))
		}
		if loc.Query().Get("client_id") == "" {
			t.Error("redirect missing client_id")
		}
	})

	t.Run("sets invite cookie when ?invite= present", func(t *testing.T) {
		rec := h.doRaw(t, "GET", "/auth/google/start?invite=invite-token-123", nil, nil)
		if rec.Code != http.StatusFound {
			t.Fatalf("status: want 302, got %d", rec.Code)
		}
		c := findCookie(rec, oauthInviteCookieName)
		if c == nil {
			t.Fatal("expected oauth_invite cookie to be set")
		}
		if c.Value != "invite-token-123" {
			t.Errorf("invite cookie value: got %q", c.Value)
		}
	})

	t.Run("no invite cookie when ?invite= absent", func(t *testing.T) {
		rec := h.doRaw(t, "GET", "/auth/google/start", nil, nil)
		if c := findCookie(rec, oauthInviteCookieName); c != nil {
			t.Errorf("unexpected oauth_invite cookie: %+v", c)
		}
	})
}

func TestHandleMe(t *testing.T) {
	h := newAuthHarness(t)

	t.Run("200 returns the authed user", func(t *testing.T) {
		rec := h.do(t, "GET", "/me", nil)
		requireStatus(t, rec, http.StatusOK)
		body := decodeBody[meResponse](t, rec)
		if body.ID != h.user.ID {
			t.Errorf("id: want %s, got %s", h.user.ID, body.ID)
		}
		if body.Email != h.user.Email {
			t.Errorf("email: want %q, got %q", h.user.Email, body.Email)
		}
		if body.HouseholdID != h.user.HouseholdID {
			t.Errorf("household_id mismatch")
		}
	})

	t.Run("401 without user in context", func(t *testing.T) {
		rec := h.doRaw(t, "GET", "/me", nil, nil)
		requireStatus(t, rec, http.StatusUnauthorized)
	})
}

func TestHandleLogout(t *testing.T) {
	h := newAuthHarness(t)

	t.Run("204 and deletes the session row when cookie is present", func(t *testing.T) {
		sessionID := mustRandomSessionID(t)
		_, err := h.q.CreateSession(context.Background(), db.CreateSessionParams{
			ID:        sessionID,
			UserID:    h.user.ID,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(30 * time.Minute), Valid: true},
		})
		if err != nil {
			t.Fatalf("seed session: %v", err)
		}

		req := httptest.NewRequest("POST", "/auth/logout", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionID})
		rec := httptest.NewRecorder()
		h.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Errorf("status: want 204, got %d (body: %s)", rec.Code, rec.Body.String())
		}

		// Session row should now be gone (GetSessionByID filters out expired
		// AND missing rows the same way).
		_, err = h.q.GetSessionByID(context.Background(), sessionID)
		if err == nil {
			t.Error("expected session to be deleted, GetSessionByID still found it")
		}

		// Cookie cleared.
		c := findCookie(rec, sessionCookieName)
		if c == nil || c.MaxAge >= 0 {
			t.Errorf("expected cleared session cookie, got %+v", c)
		}
	})

	t.Run("204 even without a cookie (idempotent)", func(t *testing.T) {
		rec := h.doRaw(t, "POST", "/auth/logout", nil, nil)
		if rec.Code != http.StatusNoContent {
			t.Errorf("status: want 204, got %d", rec.Code)
		}
		c := findCookie(rec, sessionCookieName)
		if c == nil || c.MaxAge >= 0 {
			t.Errorf("expected cleared session cookie, got %+v", c)
		}
	})
}
