package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// ImportSnapshotRow is one snapshot to upsert during a bulk import. It mirrors
// CreateAssetSnapshotParams minus the asset id, which is supplied once for the
// whole batch.
type ImportSnapshotRow struct {
	YearMonth   time.Time
	Amount      decimal.Decimal
	Currency    string
	AsOfDate    *time.Time
	Description *string
}

// ImportResult summarises an import or its dry-run preview: how many rows would
// create a new month vs overwrite an existing one.
type ImportResult struct {
	ToInsert int
	ToUpdate int
}

// AssetImportMeta returns the display name + native currency of an owned asset,
// used to scope a download template (and as an early ownership check -> 404).
func (r *AssetRepo) AssetImportMeta(ctx context.Context, assetID uuid.UUID) (name, currency string, err error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return "", "", err
	}
	row, err := r.q.GetAssetForImport(ctx, db.GetAssetForImportParams{ID: assetID, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrNotFound
		}
		return "", "", fmt.Errorf("asset import meta: %w", err)
	}
	return row.DisplayName, row.NativeCurrency, nil
}

// ImportAssetSnapshots upserts a batch of snapshots for one asset in a single
// transaction (all-or-nothing). When dryRun is true it classifies the rows
// against the asset's existing months and returns without writing. The asset
// must belong to the caller's household, otherwise ErrNotFound.
//
// Classification (insert vs update) is computed from a snapshot read taken
// before the write; in a single-household app the window between preview and
// commit is not worth locking against.
func (r *AssetRepo) ImportAssetSnapshots(ctx context.Context, assetID uuid.UUID, rows []ImportSnapshotRow, dryRun bool) (*ImportResult, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	// Ownership + existence: ErrNoRows means the asset isn't in this household
	// (or is soft-deleted) -> 404, before we touch anything.
	if _, err := r.q.GetAssetForImport(ctx, db.GetAssetForImportParams{ID: assetID, HouseholdID: hid}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("import: load asset: %w", err)
	}

	existing, err := r.q.ListAssetSnapshotsForAsset(ctx, db.ListAssetSnapshotsForAssetParams{
		AssetID:     assetID,
		HouseholdID: hid,
	})
	if err != nil {
		return nil, fmt.Errorf("import: list existing snapshots: %w", err)
	}
	months := make(map[string]struct{}, len(existing))
	for _, s := range existing {
		months[s.YearMonth.Format("2006-01")] = struct{}{}
	}

	var res ImportResult
	for _, row := range rows {
		if _, ok := months[row.YearMonth.Format("2006-01")]; ok {
			res.ToUpdate++
		} else {
			res.ToInsert++
		}
	}

	if dryRun || len(rows) == 0 {
		return &res, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("import: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	for _, row := range rows {
		if _, err := qtx.UpsertAssetSnapshot(ctx, db.UpsertAssetSnapshotParams{
			ID:          assetID,
			YearMonth:   row.YearMonth,
			Amount:      row.Amount,
			Currency:    row.Currency,
			AsOfDate:    row.AsOfDate,
			Description: row.Description,
			CreatedBy:   &user,
			HouseholdID: hid,
		}); err != nil {
			return nil, fmt.Errorf("import: upsert %s: %w", row.YearMonth.Format("2006-01"), err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("import: commit: %w", err)
	}
	return &res, nil
}

// LiabilityImportMeta mirrors AssetImportMeta for the Liability group: display
// name + native currency of an owned liability, doubling as the ownership
// check (-> ErrNotFound on a miss).
func (r *LiabilityRepo) LiabilityImportMeta(ctx context.Context, liabilityID uuid.UUID) (name, currency string, err error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return "", "", err
	}
	row, err := r.q.GetLiabilityForImport(ctx, db.GetLiabilityForImportParams{ID: liabilityID, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrNotFound
		}
		return "", "", fmt.Errorf("liability import meta: %w", err)
	}
	return row.DisplayName, row.NativeCurrency, nil
}

// ImportLiabilitySnapshots is the Liability-group analogue of
// ImportAssetSnapshots: all-or-nothing upsert in one tx, dry-run classifies
// without writing, ownership enforced via GetLiabilityForImport.
func (r *LiabilityRepo) ImportLiabilitySnapshots(ctx context.Context, liabilityID uuid.UUID, rows []ImportSnapshotRow, dryRun bool) (*ImportResult, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	if _, err := r.q.GetLiabilityForImport(ctx, db.GetLiabilityForImportParams{ID: liabilityID, HouseholdID: hid}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("import: load liability: %w", err)
	}

	existing, err := r.q.ListLiabilitySnapshotsForLiability(ctx, db.ListLiabilitySnapshotsForLiabilityParams{
		LiabilityID: liabilityID,
		HouseholdID: hid,
	})
	if err != nil {
		return nil, fmt.Errorf("import: list existing snapshots: %w", err)
	}
	months := make(map[string]struct{}, len(existing))
	for _, s := range existing {
		months[s.YearMonth.Format("2006-01")] = struct{}{}
	}

	var res ImportResult
	for _, row := range rows {
		if _, ok := months[row.YearMonth.Format("2006-01")]; ok {
			res.ToUpdate++
		} else {
			res.ToInsert++
		}
	}

	if dryRun || len(rows) == 0 {
		return &res, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("import: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	for _, row := range rows {
		if _, err := qtx.UpsertLiabilitySnapshot(ctx, db.UpsertLiabilitySnapshotParams{
			ID:          liabilityID,
			YearMonth:   row.YearMonth,
			Amount:      row.Amount,
			Currency:    row.Currency,
			AsOfDate:    row.AsOfDate,
			Description: row.Description,
			CreatedBy:   &user,
			HouseholdID: hid,
		}); err != nil {
			return nil, fmt.Errorf("import: upsert %s: %w", row.YearMonth.Format("2006-01"), err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("import: commit: %w", err)
	}
	return &res, nil
}

// ReceivableImportMeta mirrors AssetImportMeta for the Receivable group.
func (r *ReceivableRepo) ReceivableImportMeta(ctx context.Context, receivableID uuid.UUID) (name, currency string, err error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return "", "", err
	}
	row, err := r.q.GetReceivableForImport(ctx, db.GetReceivableForImportParams{ID: receivableID, HouseholdID: hid})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrNotFound
		}
		return "", "", fmt.Errorf("receivable import meta: %w", err)
	}
	return row.DisplayName, row.NativeCurrency, nil
}

// ImportReceivableSnapshots is the Receivable-group analogue of
// ImportAssetSnapshots.
func (r *ReceivableRepo) ImportReceivableSnapshots(ctx context.Context, receivableID uuid.UUID, rows []ImportSnapshotRow, dryRun bool) (*ImportResult, error) {
	user, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}

	if _, err := r.q.GetReceivableForImport(ctx, db.GetReceivableForImportParams{ID: receivableID, HouseholdID: hid}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("import: load receivable: %w", err)
	}

	existing, err := r.q.ListReceivableSnapshotsForReceivable(ctx, db.ListReceivableSnapshotsForReceivableParams{
		ReceivableID: receivableID,
		HouseholdID:  hid,
	})
	if err != nil {
		return nil, fmt.Errorf("import: list existing snapshots: %w", err)
	}
	months := make(map[string]struct{}, len(existing))
	for _, s := range existing {
		months[s.YearMonth.Format("2006-01")] = struct{}{}
	}

	var res ImportResult
	for _, row := range rows {
		if _, ok := months[row.YearMonth.Format("2006-01")]; ok {
			res.ToUpdate++
		} else {
			res.ToInsert++
		}
	}

	if dryRun || len(rows) == 0 {
		return &res, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("import: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	for _, row := range rows {
		if _, err := qtx.UpsertReceivableSnapshot(ctx, db.UpsertReceivableSnapshotParams{
			ID:          receivableID,
			YearMonth:   row.YearMonth,
			Amount:      row.Amount,
			Currency:    row.Currency,
			AsOfDate:    row.AsOfDate,
			Description: row.Description,
			CreatedBy:   &user,
			HouseholdID: hid,
		}); err != nil {
			return nil, fmt.Errorf("import: upsert %s: %w", row.YearMonth.Format("2006-01"), err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("import: commit: %w", err)
	}
	return &res, nil
}
