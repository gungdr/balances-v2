package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kerti/balances-v2/backend/internal/db"
	"github.com/kerti/balances-v2/backend/internal/email"
)

const (
	oauthStateCookieName  = "oauth_state"
	oauthInviteCookieName = "oauth_invite"
	invitationTTL         = 72 * time.Hour
)

type Config struct {
	Google       GoogleConfig
	SessionTTL   time.Duration
	CookieSecure bool
	FrontendURL  string
	BackendURL   string
	EmailFrom    string
	Mailer       email.Mailer
}

type Handlers struct {
	q            *db.Queries
	googleOAuth  googleOAuthClient
	mailer       email.Mailer
	validate     *validator.Validate
	sessionTTL   time.Duration
	cookieSecure bool
	frontendURL  string
	backendURL   string
	emailFrom    string
}

func New(ctx context.Context, q *db.Queries, cfg Config) (*Handlers, error) {
	g, err := newGoogleOAuth(ctx, cfg.Google)
	if err != nil {
		return nil, err
	}
	if cfg.Mailer == nil {
		return nil, errors.New("auth: mailer is required")
	}
	if cfg.BackendURL == "" {
		return nil, errors.New("auth: backend url is required")
	}
	return &Handlers{
		q:            q,
		googleOAuth:  g,
		mailer:       cfg.Mailer,
		validate:     validator.New(validator.WithRequiredStructEnabled()),
		sessionTTL:   cfg.SessionTTL,
		cookieSecure: cfg.CookieSecure,
		frontendURL:  cfg.FrontendURL,
		backendURL:   cfg.BackendURL,
		emailFrom:    cfg.EmailFrom,
	}, nil
}

// Mount registers auth routes under the provided router. The caller is expected
// to apply SessionMiddleware at a higher level so /api/me sees the user.
func (h *Handlers) Mount(r chi.Router) {
	r.Get("/auth/google/start", h.handleStart)
	r.Get("/auth/google/callback", h.handleCallback)
	r.Post("/auth/logout", h.handleLogout)
	r.With(RequireAuth).Get("/me", h.handleMe)
	r.With(RequireAuth).Patch("/me", h.handleUpdateMe)
	r.With(RequireAuth).Get("/household/members", h.handleListHouseholdMembers)
	r.With(RequireAuth).Patch("/household/settings", h.handleUpdateHouseholdSettings)
	r.With(RequireAuth).Post("/invitations", h.handleCreateInvitation)
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

	if invite := r.URL.Query().Get("invite"); invite != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     oauthInviteCookieName,
			Value:    invite,
			Path:     "/",
			MaxAge:   300,
			HttpOnly: true,
			Secure:   h.cookieSecure,
			SameSite: http.SameSiteLaxMode,
		})
	}

	http.Redirect(w, r, h.googleOAuth.authCodeURL(state), http.StatusFound)
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

	// State has served its purpose; clear it (and the invite cookie if any —
	// we'll read its value before clearing).
	var inviteToken string
	if inviteCookie, err := r.Cookie(oauthInviteCookieName); err == nil {
		inviteToken = inviteCookie.Value
	}
	h.clearShortCookie(w, oauthStateCookieName)
	h.clearShortCookie(w, oauthInviteCookieName)

	claims, err := h.googleOAuth.exchange(ctx, code)
	if err != nil {
		slog.Error("oauth exchange", "err", err)
		http.Error(w, "oauth exchange failed", http.StatusBadGateway)
		return
	}

	user, err := h.q.GetUserByGoogleSub(ctx, claims.Sub)
	switch {
	case err == nil:
		// existing user — just sign them in
	case errors.Is(err, pgx.ErrNoRows):
		user, err = h.bootstrapNewUser(ctx, claims, inviteToken)
		if err != nil {
			slog.Error("bootstrap new user", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	default:
		slog.Error("lookup user by google_sub", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
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

// bootstrapNewUser creates either a founder (new household + user, no
// invitation) or a household member (existing household referenced by a valid
// invitation). The invitation path verifies the Google-supplied email matches
// the invitation's invited_email (per ADR-0017) so a forwarded link can't be
// used by an unintended account.
func (h *Handlers) bootstrapNewUser(ctx context.Context, c *googleClaims, inviteToken string) (db.User, error) {
	if inviteToken == "" {
		return h.createFounder(ctx, c)
	}

	invite, err := h.q.GetInvitationByToken(ctx, inviteToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, errors.New("invitation not found")
		}
		return db.User{}, err
	}
	if invite.UsedAt.Valid {
		return db.User{}, errors.New("invitation already used")
	}
	if !invite.ExpiresAt.Valid || invite.ExpiresAt.Time.Before(time.Now()) {
		return db.User{}, errors.New("invitation expired")
	}
	if c.Email != invite.InvitedEmail {
		return db.User{}, errors.New("invitation email does not match google account")
	}

	user, err := h.q.CreateUser(ctx, db.CreateUserParams{
		HouseholdID: invite.HouseholdID,
		DisplayName: c.Name,
		Email:       c.Email,
		GoogleSub:   c.Sub,
		Locale:      "id-ID",
		TimeZone:    "Asia/Jakarta",
		CreatedBy:   &invite.CreatedBy,
	})
	if err != nil {
		return db.User{}, err
	}
	if err := h.q.MarkInvitationUsed(ctx, invite.ID); err != nil {
		return db.User{}, err
	}
	return user, nil
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

func (h *Handlers) clearShortCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
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
	ID                   uuid.UUID `json:"id"`
	HouseholdID          uuid.UUID `json:"household_id"`
	DisplayName          string    `json:"display_name"`
	Nickname             *string   `json:"nickname"`
	Email                string    `json:"email"`
	Locale               string    `json:"locale"`
	TimeZone             string    `json:"time_zone"`
	ReportingCurrency    string    `json:"reporting_currency"`
	MultiCurrencyEnabled bool      `json:"multi_currency_enabled"`
}

func meResponseFor(user db.User, hh db.Household) meResponse {
	return meResponse{
		ID:                   user.ID,
		HouseholdID:          user.HouseholdID,
		DisplayName:          user.DisplayName,
		Nickname:             user.Nickname,
		Email:                user.Email,
		Locale:               user.Locale,
		TimeZone:             user.TimeZone,
		ReportingCurrency:    hh.ReportingCurrency,
		MultiCurrencyEnabled: hh.MultiCurrencyEnabled,
	}
}

func (h *Handlers) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	hh, err := h.q.GetHouseholdByID(r.Context(), user.HouseholdID)
	if err != nil {
		slog.Error("get household for /me", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(meResponseFor(user, hh))
}

const maxNicknameLen = 32

type updateMeReq struct {
	Nickname *string `json:"nickname"`
}

// handleUpdateMe updates the current user's own profile. Today that is only the
// self-set nickname (the compact owner label, falling back to display_name on
// read). display_name itself stays Google-sourced and is not editable here.
// A blank/whitespace nickname clears it (stored NULL); over 32 chars is 400.
func (h *Handlers) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req updateMeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	var nickname *string
	if req.Nickname != nil {
		if trimmed := strings.TrimSpace(*req.Nickname); trimmed != "" {
			if utf8.RuneCountInString(trimmed) > maxNicknameLen {
				http.Error(w, "invalid request: nickname must be 32 characters or fewer", http.StatusBadRequest)
				return
			}
			nickname = &trimmed
		}
	}
	updated, err := h.q.UpdateUserNickname(r.Context(), db.UpdateUserNicknameParams{
		UpdatedBy: &user.ID,
		Nickname:  nickname,
	})
	if err != nil {
		slog.Error("update user nickname", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	hh, err := h.q.GetHouseholdByID(r.Context(), updated.HouseholdID)
	if err != nil {
		slog.Error("get household for update me", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(meResponseFor(updated, hh))
}

// householdMember is the public shape — only fields the frontend needs for
// the sole-owner picker. Deliberately omits google_sub, audit cols, etc.
type householdMember struct {
	ID          uuid.UUID `json:"id"`
	DisplayName string    `json:"display_name"`
	Nickname    *string   `json:"nickname"`
	Email       string    `json:"email"`
}

func (h *Handlers) handleListHouseholdMembers(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rows, err := h.q.ListUsersByHousehold(r.Context(), user.HouseholdID)
	if err != nil {
		slog.Error("list household members", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]householdMember, 0, len(rows))
	for _, u := range rows {
		out = append(out, householdMember{
			ID:          u.ID,
			DisplayName: u.DisplayName,
			Nickname:    u.Nickname,
			Email:       u.Email,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

type householdSettings struct {
	ID                   uuid.UUID `json:"id"`
	DisplayName          string    `json:"display_name"`
	ReportingCurrency    string    `json:"reporting_currency"`
	MultiCurrencyEnabled bool      `json:"multi_currency_enabled"`
}

type updateHouseholdSettingsReq struct {
	ReportingCurrency    string `json:"reporting_currency"`
	MultiCurrencyEnabled bool   `json:"multi_currency_enabled"`
}

// handleUpdateHouseholdSettings sets the reporting currency + multi-currency
// toggle (ADR-0002). Turning multi-currency off is blocked while positions in a
// non-reporting currency still exist — their values would silently be summed as
// reporting currency.
func (h *Handlers) handleUpdateHouseholdSettings(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req updateHouseholdSettingsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if len(req.ReportingCurrency) != 3 {
		http.Error(w, "invalid request: reporting_currency must be a 3-letter code", http.StatusBadRequest)
		return
	}
	if !req.MultiCurrencyEnabled {
		n, err := h.q.CountForeignCurrencyPositions(r.Context(), db.CountForeignCurrencyPositionsParams{
			HouseholdID:    user.HouseholdID,
			NativeCurrency: req.ReportingCurrency,
		})
		if err != nil {
			slog.Error("count foreign positions", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if n > 0 {
			http.Error(w, "cannot disable multi-currency while foreign-currency positions exist", http.StatusConflict)
			return
		}
	}
	hh, err := h.q.UpdateHouseholdSettings(r.Context(), db.UpdateHouseholdSettingsParams{
		ID:                   user.HouseholdID,
		ReportingCurrency:    req.ReportingCurrency,
		MultiCurrencyEnabled: req.MultiCurrencyEnabled,
		UpdatedBy:            &user.ID,
	})
	if err != nil {
		slog.Error("update household settings", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(householdSettings{
		ID:                   hh.ID,
		DisplayName:          hh.DisplayName,
		ReportingCurrency:    hh.ReportingCurrency,
		MultiCurrencyEnabled: hh.MultiCurrencyEnabled,
	})
}
