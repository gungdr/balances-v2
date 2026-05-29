package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	// IssuerURL is the OIDC issuer used for discovery. Production leaves this
	// at the Google default; the E2E mock-OIDC server (ADR-0024 option B) points
	// it at a local fake so the real button→redirect→callback→session flow can
	// be exercised without contacting Google.
	IssuerURL string
}

// googleOAuthClient is the seam between Handlers and the Google OAuth +
// OIDC machinery. Production wires the concrete *googleOAuth (real network
// calls); tests substitute a stub that returns pre-baked claims so the
// callback flow can be exercised without contacting Google.
type googleOAuthClient interface {
	authCodeURL(state string) string
	exchange(ctx context.Context, code string) (*googleClaims, error)
}

type googleOAuth struct {
	cfg      oauth2.Config
	verifier *oidc.IDTokenVerifier
}

func (g *googleOAuth) authCodeURL(state string) string {
	return g.cfg.AuthCodeURL(state)
}

func newGoogleOAuth(ctx context.Context, gc GoogleConfig) (*googleOAuth, error) {
	if gc.ClientID == "" || gc.ClientSecret == "" || gc.RedirectURL == "" {
		return nil, errors.New("google oauth: client id, secret, and redirect url are required")
	}
	issuer := gc.IssuerURL
	if issuer == "" {
		issuer = "https://accounts.google.com"
	}

	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("oidc provider discovery: %w", err)
	}

	return &googleOAuth{
		cfg: oauth2.Config{
			ClientID:     gc.ClientID,
			ClientSecret: gc.ClientSecret,
			RedirectURL:  gc.RedirectURL,
			// Use the discovery-provided auth/token endpoints rather than a
			// hardcoded google.Endpoint so the same code path drives both the
			// real Google issuer and the E2E mock (ADR-0024). For Google,
			// discovery returns Google's own endpoints.
			Endpoint: provider.Endpoint(),
			Scopes:   []string{oidc.ScopeOpenID, "email", "profile"},
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: gc.ClientID}),
	}, nil
}

type googleClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	// Picture is the Google account avatar URL, present in the ID token when
	// the "profile" scope is granted. May be empty for accounts without a photo.
	Picture string `json:"picture"`
}

func (g *googleOAuth) exchange(ctx context.Context, code string) (*googleClaims, error) {
	token, err := g.cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchange code: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("google response missing id_token")
	}
	idToken, err := g.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("verify id_token: %w", err)
	}
	var claims googleClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("extract claims: %w", err)
	}
	if !claims.EmailVerified {
		return nil, errors.New("google email not verified")
	}
	return &claims, nil
}

func randomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
