package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kerti/balances-v2/backend/internal/db"
)

type contextKey int

const (
	userContextKey contextKey = iota
)

const sessionCookieName = "session"

func randomSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (h *Handlers) setSessionCookie(w http.ResponseWriter, sessionID string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handlers) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// UserFromContext returns the authenticated user from the request context, if any.
func UserFromContext(ctx context.Context) (db.User, bool) {
	u, ok := ctx.Value(userContextKey).(db.User)
	return u, ok
}

func withUser(ctx context.Context, u db.User) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

// SessionMiddleware reads the session cookie, looks up the session and user,
// touches the session (sliding TTL), and injects the user into the request
// context. Requests without a valid session continue without a user — handlers
// that require authentication wrap themselves with RequireAuth.
func (h *Handlers) SessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			next.ServeHTTP(w, r)
			return
		}

		ctx := r.Context()
		session, err := h.q.GetSessionByID(ctx, cookie.Value)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				h.clearSessionCookie(w)
			}
			next.ServeHTTP(w, r)
			return
		}

		user, err := h.q.GetUserByID(ctx, session.UserID)
		if err != nil {
			h.clearSessionCookie(w)
			next.ServeHTTP(w, r)
			return
		}

		newExpiresAt := time.Now().Add(h.sessionTTL)
		_ = h.q.TouchSession(ctx, db.TouchSessionParams{
			ExpiresAt: pgtype.Timestamptz{Time: newExpiresAt, Valid: true},
			ID:        session.ID,
		})
		h.setSessionCookie(w, session.ID, newExpiresAt)

		next.ServeHTTP(w, r.WithContext(withUser(ctx, user)))
	})
}

// RequireAuth blocks requests that have no authenticated user in context.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := UserFromContext(r.Context()); !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
