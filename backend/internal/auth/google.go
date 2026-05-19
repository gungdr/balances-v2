package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

type googleOAuth struct {
	cfg      oauth2.Config
	verifier *oidc.IDTokenVerifier
}

func newGoogleOAuth(ctx context.Context, gc GoogleConfig) (*googleOAuth, error) {
	if gc.ClientID == "" || gc.ClientSecret == "" || gc.RedirectURL == "" {
		return nil, errors.New("google oauth: client id, secret, and redirect url are required")
	}

	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, fmt.Errorf("oidc provider discovery: %w", err)
	}

	return &googleOAuth{
		cfg: oauth2.Config{
			ClientID:     gc.ClientID,
			ClientSecret: gc.ClientSecret,
			RedirectURL:  gc.RedirectURL,
			Endpoint:     google.Endpoint,
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: gc.ClientID}),
	}, nil
}

type googleClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
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
