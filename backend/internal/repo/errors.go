// Package repo wraps the generated db.Queries with tenancy-aware methods.
// Every method reads the authenticated user (and therefore household_id)
// from the request context via auth.UserFromContext, then delegates to the
// generated query — which carries household_id in its WHERE clause for
// belt + suspenders enforcement (per ADR-0005 + sqlc query design).
package repo

import "errors"

var (
	// ErrUnauthenticated is returned when a repository method runs without a
	// user attached to the request context. Handlers should already be guarded
	// by RequireAuth, so seeing this in practice means a misconfigured route.
	ErrUnauthenticated = errors.New("repo: no user in request context")

	// ErrNotFound is returned when a query that expected a single row found
	// none — either the row genuinely doesn't exist or it belongs to a
	// different Household (the SQL filter makes the two cases indistinguishable
	// from the caller's perspective, which is intentional).
	ErrNotFound = errors.New("repo: not found")

	// ErrInvalidSnapshotShape is returned when an Investment snapshot mutation
	// supplies a value-column combination that violates the subtype's expected
	// shape (per ADR-0022). Stock/MutualFund/Gold require quantity+price_per_unit
	// and reject accrued_interest; Bond/TimeDeposit require accrued_interest
	// and reject quantity+price_per_unit. The DB's CHECK constraint catches
	// rows that satisfy no shape; this error catches rows that pick the wrong
	// shape for their parent's subtype (which the DB can't see).
	ErrInvalidSnapshotShape = errors.New("repo: invalid investment snapshot shape for subtype")

	// ErrInvalidTransactionType is returned when an Investment transaction
	// mutation asks for a transaction_type the parent's subtype doesn't
	// support (e.g., Coupon on a Stock, Buy on a TimeDeposit). The DB-level
	// CHECK enforces shape-vs-type consistency; this error enforces the
	// subtype-vs-type compatibility matrix (which the DB can't see).
	ErrInvalidTransactionType = errors.New("repo: invalid transaction type for subtype")

	// ErrInvalidTransactionShape is returned when an Investment transaction
	// mutation supplies a value-column combination that doesn't match its
	// declared transaction_type (e.g., Buy without quantity, Maturity
	// without principal_disposition). Caught at the repo layer with a
	// human-readable message; the DB CHECK would also reject these but
	// later in the call.
	ErrInvalidTransactionShape = errors.New("repo: invalid transaction shape for type")
)
