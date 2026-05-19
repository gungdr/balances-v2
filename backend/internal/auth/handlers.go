package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kerti/balances-v2/backend/internal/db"
)

const oauthStateCookieName = "oauth_state"

type Config struct {
	Google       GoogleConfig
	SessionTTL   time.Duration
	CookieSecure bool
	FrontendURL  string
}

type Handlers struct {
	q            *db.Queries
	googleOAuth  *googleOAuth
	sessionTTL   time.Duration
	cookieSecure bool
	frontendURL  string
}

func New(ctx context.Context, q *db.Queries, cfg Config) (*Handlers, error) {
	g, err := newGoogleOAuth(ctx, cfg.Google)
	if err != nil {
		return nil, err
	}
	return &Handlers{
		q:            q,
		googleOAuth:  g,
		sessionTTL:   cfg.SessionTTL,
		cookieSecure: cfg.CookieSecure,
		frontendURL:  cfg.FrontendURL,
	}, nil
}

// Mount registers auth routes under the provided router. The caller is expected
// to apply SessionMiddleware at a higher level so /api/me sees the user.
func (h *Handlers) Mount(r chi.Router) {
	r.Get("/auth/google/start", h.handleStart)
	r.Get("/auth/google/callback", h.handleCallback)
	r.Post("/auth/logout", h.handleLogout)
	r.With(RequireAuth).Get("/me", h.handleMe)
}

func (h *Handlers) handleStart(w http.ResponseWriter, r *http.Request) {
	state, err := randomState()
	if err != nil {
		slog.Error("generate oauth state", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    state,
		Path:     "/",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, h.googleOAuth.cfg.AuthCodeURL(state), http.StatusFound)
}

func (h *Handlers) handleCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	stateCookie, err := r.Cookie(oauthStateCookieName)
	if err != nil || stateCookie.Value == "" {
		http.Error(w, "missing oauth_state cookie", http.StatusBadRequest)
		return
	}
	if r.URL.Query().Get("state") != stateCookie.Value {
		http.Error(w, "oauth state mismatch", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing oauth code", http.StatusBadRequest)
		return
	}

	// State has served its purpose; clear it.
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	claims, err := h.googleOAuth.exchange(ctx, code)
	if err != nil {
		slog.Error("oauth exchange", "err", err)
		http.Error(w, "oauth exchange failed", http.StatusBadGateway)
		return
	}

	user, err := h.q.GetUserByGoogleSub(ctx, claims.Sub)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			slog.Error("lookup user by google_sub", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		user, err = h.createFounder(ctx, claims)
		if err != nil {
			slog.Error("create founder", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	sessionID, err := randomSessionID()
	if err != nil {
		slog.Error("generate session id", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	expiresAt := time.Now().Add(h.sessionTTL)
	var ua *string
	if a := r.Header.Get("User-Agent"); a != "" {
		ua = &a
	}
	if _, err := h.q.CreateSession(ctx, db.CreateSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
		UserAgent: ua,
	}); err != nil {
		slog.Error("create session", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	h.setSessionCookie(w, sessionID, expiresAt)

	http.Redirect(w, r, h.frontendURL, http.StatusFound)
}

func (h *Handlers) createFounder(ctx context.Context, c *googleClaims) (db.User, error) {
	household, err := h.q.CreateHousehold(ctx, db.CreateHouseholdParams{
		DisplayName:       c.Name + "'s Household",
		ReportingCurrency: "IDR",
	})
	if err != nil {
		return db.User{}, err
	}
	return h.q.CreateUser(ctx, db.CreateUserParams{
		HouseholdID: household.ID,
		DisplayName: c.Name,
		Email:       c.Email,
		GoogleSub:   c.Sub,
		Locale:      "id-ID",
		TimeZone:    "Asia/Jakarta",
		CreatedBy:   nil,
	})
}

func (h *Handlers) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		_ = h.q.DeleteSession(r.Context(), cookie.Value)
	}
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

type meResponse struct {
	ID          uuid.UUID `json:"id"`
	HouseholdID uuid.UUID `json:"household_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	Locale      string    `json:"locale"`
	TimeZone    string    `json:"time_zone"`
}

func (h *Handlers) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(meResponse{
		ID:          user.ID,
		HouseholdID: user.HouseholdID,
		DisplayName: user.DisplayName,
		Email:       user.Email,
		Locale:      user.Locale,
		TimeZone:    user.TimeZone,
	})
}
