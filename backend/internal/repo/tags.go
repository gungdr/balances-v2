package repo

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// TagRepo wraps the generated queries for user-defined position Tags
// (ADR-0028). A Tag is a household-scoped grouping label; a Position carries
// at most one via a nullable tag_id on its shared parent table. Assignment is
// a dedicated path here rather than a field on each position's create/update,
// because a Tag is orthogonal to a Position's identity.
type TagRepo struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewTagRepo(pool *pgxpool.Pool) *TagRepo {
	return &TagRepo{pool: pool, q: db.New(pool)}
}

// TagGroup is the position-group discriminator the assign endpoint switches on.
type TagGroup string

const (
	TagGroupAsset      TagGroup = "asset"
	TagGroupLiability  TagGroup = "liability"
	TagGroupReceivable TagGroup = "receivable"
	TagGroupInvestment TagGroup = "investment"
)

func (g TagGroup) valid() bool {
	switch g {
	case TagGroupAsset, TagGroupLiability, TagGroupReceivable, TagGroupInvestment:
		return true
	default:
		return false
	}
}

func (r *TagRepo) CreateTag(ctx context.Context, name, color string) (*db.Tag, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.CreateTag(ctx, db.CreateTagParams{
		HouseholdID: hid,
		Name:        name,
		Color:       color,
		CreatedBy:   &user,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrTagNameExists
		}
		return nil, fmt.Errorf("create tag: %w", err)
	}
	return &row, nil
}

func (r *TagRepo) GetTag(ctx context.Context, id uuid.UUID) (*db.Tag, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.GetTagByID(ctx, db.GetTagByIDParams{ID: id, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *TagRepo) ListTags(ctx context.Context) ([]db.Tag, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := r.q.ListTagsByHousehold(ctx, hid)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	if rows == nil {
		rows = []db.Tag{}
	}
	return rows, nil
}

func (r *TagRepo) UpdateTag(ctx context.Context, id uuid.UUID, name, color string) (*db.Tag, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	row, err := r.q.UpdateTag(ctx, db.UpdateTagParams{
		ID:          id,
		HouseholdID: hid,
		Name:        name,
		Color:       color,
		UpdatedBy:   &user,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, ErrTagNameExists
		}
		return nil, fmt.Errorf("update tag: %w", err)
	}
	return &row, nil
}

// DeleteTag soft-deletes the Tag and clears it from every Position in the same
// transaction, so no Position is left pointing at a dead Tag — it falls back
// to Untagged (ADR-0028).
func (r *TagRepo) DeleteTag(ctx context.Context, id uuid.UUID) error {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	rows, err := qtx.SoftDeleteTag(ctx, db.SoftDeleteTagParams{ID: id, HouseholdID: hid, UpdatedBy: &user})
	if err != nil {
		return fmt.Errorf("soft delete tag: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}

	if err := qtx.ClearAssetTag(ctx, db.ClearAssetTagParams{TagID: &id, HouseholdID: hid}); err != nil {
		return fmt.Errorf("clear asset tag: %w", err)
	}
	if err := qtx.ClearLiabilityTag(ctx, db.ClearLiabilityTagParams{TagID: &id, HouseholdID: hid}); err != nil {
		return fmt.Errorf("clear liability tag: %w", err)
	}
	if err := qtx.ClearReceivableTag(ctx, db.ClearReceivableTagParams{TagID: &id, HouseholdID: hid}); err != nil {
		return fmt.Errorf("clear receivable tag: %w", err)
	}
	if err := qtx.ClearInvestmentTag(ctx, db.ClearInvestmentTagParams{TagID: &id, HouseholdID: hid}); err != nil {
		return fmt.Errorf("clear investment tag: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// AssignTag sets (or, with a nil tagID, clears) the Tag on a Position. A
// non-nil Tag is validated for household ownership first — a Tag from another
// household is ErrNotFound, never a silent cross-tenant link. The per-group
// UPDATE filters the Position by household_id too (belt + suspenders); zero
// rows affected means the Position isn't in this household → ErrNotFound.
func (r *TagRepo) AssignTag(ctx context.Context, group TagGroup, positionID uuid.UUID, tagID *uuid.UUID) error {
	if !group.valid() {
		return ErrNotFound
	}
	user, hid, err := currentUser(ctx)
	if err != nil {
		return err
	}
	if tagID != nil {
		if _, err := r.GetTag(ctx, *tagID); err != nil {
			return err // ErrNotFound for missing / cross-tenant
		}
	}

	var rows int64
	switch group {
	case TagGroupAsset:
		rows, err = r.q.AssignAssetTag(ctx, db.AssignAssetTagParams{TagID: tagID, ID: positionID, HouseholdID: hid, UpdatedBy: &user})
	case TagGroupLiability:
		rows, err = r.q.AssignLiabilityTag(ctx, db.AssignLiabilityTagParams{TagID: tagID, ID: positionID, HouseholdID: hid, UpdatedBy: &user})
	case TagGroupReceivable:
		rows, err = r.q.AssignReceivableTag(ctx, db.AssignReceivableTagParams{TagID: tagID, ID: positionID, HouseholdID: hid, UpdatedBy: &user})
	case TagGroupInvestment:
		rows, err = r.q.AssignInvestmentTag(ctx, db.AssignInvestmentTagParams{TagID: tagID, ID: positionID, HouseholdID: hid, UpdatedBy: &user})
	}
	if err != nil {
		return fmt.Errorf("assign %s tag: %w", group, err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// TagBreakdown returns, per (tag, group, currency), the summed most-recent
// snapshot value of contributing Positions. tag_id NULL is the Untagged
// bucket; the report layer renders liabilities as their own negative slice.
func (r *TagRepo) TagBreakdown(ctx context.Context) ([]db.TagBreakdownByHouseholdRow, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := r.q.TagBreakdownByHousehold(ctx, hid)
	if err != nil {
		return nil, fmt.Errorf("tag breakdown: %w", err)
	}
	if rows == nil {
		rows = []db.TagBreakdownByHouseholdRow{}
	}
	return rows, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
