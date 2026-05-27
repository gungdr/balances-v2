package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// MonthlyReportRepo serves the materialized monthly net-worth report (ADR-0006).
// Reads are lazy: ListReports / GetReport regenerate the household's rows when
// the inputs are newer than what's materialized, then return the cached rows.
// The compute itself lives in the pure engine (monthly_reports_engine.go); this
// type only fetches inputs, decides staleness, and upserts.
type MonthlyReportRepo struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewMonthlyReportRepo(pool *pgxpool.Pool) *MonthlyReportRepo {
	return &MonthlyReportRepo{pool: pool, q: db.New(pool)}
}

// ListReports refreshes the household's reports if stale, then returns them
// ascending by month.
func (r *MonthlyReportRepo) ListReports(ctx context.Context) ([]db.MonthlyReport, error) {
	uid, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := r.refresh(ctx, uid, hid); err != nil {
		return nil, err
	}
	rows, err := r.q.ListMonthlyReports(ctx, hid)
	if err != nil {
		return nil, fmt.Errorf("list monthly reports: %w", err)
	}
	if rows == nil {
		return []db.MonthlyReport{}, nil
	}
	return rows, nil
}

// ReportingCurrency returns the household's reporting currency, which the
// dashboard needs to format the (single-currency, slice-1) aggregates.
func (r *MonthlyReportRepo) ReportingCurrency(ctx context.Context) (string, error) {
	_, hid, err := currentUser(ctx)
	if err != nil {
		return "", err
	}
	hh, err := r.q.GetHouseholdByID(ctx, hid)
	if err != nil {
		return "", fmt.Errorf("get household: %w", err)
	}
	return hh.ReportingCurrency, nil
}

// GetReport refreshes if stale, then returns a single month (ErrNotFound when
// the month is outside the reportable range).
func (r *MonthlyReportRepo) GetReport(ctx context.Context, yearMonth time.Time) (*db.MonthlyReport, error) {
	uid, hid, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := r.refresh(ctx, uid, hid); err != nil {
		return nil, err
	}
	row, err := r.q.GetMonthlyReport(ctx, db.GetMonthlyReportParams{
		HouseholdID: hid,
		YearMonth:   monthFromIndex(monthIndex(yearMonth)),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get monthly report: %w", err)
	}
	return &row, nil
}

// refresh regenerates and upserts the household's reports when the materialized
// rows are stale or the month range changed.
func (r *MonthlyReportRepo) refresh(ctx context.Context, uid, hid uuid.UUID) error {
	currentMonth, err := r.currentMonth(ctx, uid)
	if err != nil {
		return err
	}
	in, err := r.loadEngineInput(ctx, hid, currentMonth)
	if err != nil {
		return err
	}
	reports := generateMonthlyReports(in)
	if len(reports) == 0 {
		return nil // no snapshot data — nothing to materialize
	}
	first := reports[0].yearMonth
	last := reports[len(reports)-1].yearMonth

	watermark, err := r.q.MaxReportInputUpdatedAt(ctx, db.MaxReportInputUpdatedAtParams{
		HouseholdID: hid,
		YearMonth:   last,
	})
	if err != nil {
		return fmt.Errorf("report staleness watermark: %w", err)
	}
	existing, err := r.q.ListMonthlyReports(ctx, hid)
	if err != nil {
		return fmt.Errorf("list monthly reports: %w", err)
	}
	if !needsRegen(reports, existing, watermark) {
		return nil
	}
	return r.writeReports(ctx, hid, first, last, reports)
}

// needsRegen is the coarse-but-correct slice-1 staleness check: regenerate the
// whole household when the materialized month set differs from the engine's or
// any materialized row predates the input watermark (ADR-0006 conservative
// rule — over-regenerates cheaply for one household, never serves stale).
func needsRegen(reports []monthlyReportData, existing []db.MonthlyReport, watermark pgtype.Timestamptz) bool {
	if len(existing) != len(reports) {
		return true
	}
	have := make(map[int]pgtype.Timestamptz, len(existing))
	for _, e := range existing {
		have[monthIndex(e.YearMonth)] = e.GeneratedAt
	}
	for _, rep := range reports {
		gen, ok := have[monthIndex(rep.yearMonth)]
		if !ok {
			return true
		}
		if !gen.Valid || gen.Time.Before(watermark.Time) {
			return true
		}
	}
	return false
}

// writeReports prunes out-of-range cache rows and upserts every generated month
// in one transaction.
func (r *MonthlyReportRepo) writeReports(ctx context.Context, hid uuid.UUID, first, last time.Time, reports []monthlyReportData) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin report write: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := r.q.WithTx(tx)

	if err := qtx.DeleteMonthlyReportsOutsideRange(ctx, db.DeleteMonthlyReportsOutsideRangeParams{
		HouseholdID: hid,
		YearMonth:   first,
		YearMonth_2: last,
	}); err != nil {
		return fmt.Errorf("prune monthly reports: %w", err)
	}
	for _, rep := range reports {
		ub, err := json.Marshal(rep.userBreakdowns)
		if err != nil {
			return fmt.Errorf("marshal user breakdowns: %w", err)
		}
		stale, err := json.Marshal(rep.stalePositions)
		if err != nil {
			return fmt.Errorf("marshal stale positions: %w", err)
		}
		if _, err := qtx.UpsertMonthlyReport(ctx, db.UpsertMonthlyReportParams{
			HouseholdID:    hid,
			YearMonth:      rep.yearMonth,
			NwTotal:        rep.nwTotal,
			NwAssets:       rep.nwAssets,
			NwLiabilities:  rep.nwLiabilities,
			NwReceivables:  rep.nwReceivables,
			NwInvestments:  rep.nwInvestments,
			UserBreakdowns: ub,
			StalePositions: stale,
		}); err != nil {
			return fmt.Errorf("upsert monthly report: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit report write: %w", err)
	}
	return nil
}

// currentMonth is the first of the month containing now() in the requesting
// user's time zone (ADR-0006). A bad/unknown zone falls back to UTC rather than
// failing the dashboard.
func (r *MonthlyReportRepo) currentMonth(ctx context.Context, uid uuid.UUID) (time.Time, error) {
	u, err := r.q.GetUserByID(ctx, uid)
	if err != nil {
		return time.Time{}, fmt.Errorf("load user for time zone: %w", err)
	}
	loc, err := time.LoadLocation(u.TimeZone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC), nil
}

// loadEngineInput fetches the household's positions, snapshots, and members and
// shapes them for the pure engine.
func (r *MonthlyReportRepo) loadEngineInput(ctx context.Context, hid uuid.UUID, currentMonth time.Time) (reportEngineInput, error) {
	in := reportEngineInput{currentMonth: currentMonth}

	assets, err := r.q.ListAssetsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list assets for report: %w", err)
	}
	for _, a := range assets {
		in.positions = append(in.positions, reportPosition{
			id: a.ID, group: groupAsset, ownershipType: a.OwnershipType,
			soleOwnerID: a.SoleOwnerUserID, terminatedAt: a.TerminatedAt,
		})
	}
	liabilities, err := r.q.ListLiabilitiesForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list liabilities for report: %w", err)
	}
	for _, l := range liabilities {
		in.positions = append(in.positions, reportPosition{
			id: l.ID, group: groupLiability, ownershipType: l.OwnershipType,
			soleOwnerID: l.SoleOwnerUserID, terminatedAt: l.TerminatedAt,
		})
	}
	receivables, err := r.q.ListReceivablesForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list receivables for report: %w", err)
	}
	for _, rc := range receivables {
		in.positions = append(in.positions, reportPosition{
			id: rc.ID, group: groupReceivable, ownershipType: rc.OwnershipType,
			soleOwnerID: rc.SoleOwnerUserID, terminatedAt: rc.TerminatedAt,
		})
	}
	investments, err := r.q.ListInvestmentsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list investments for report: %w", err)
	}
	for _, i := range investments {
		in.positions = append(in.positions, reportPosition{
			id: i.ID, group: groupInvestment, ownershipType: i.OwnershipType,
			soleOwnerID: i.SoleOwnerUserID, terminatedAt: i.TerminatedAt,
		})
	}

	asnaps, err := r.q.ListAssetSnapshotsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list asset snapshots for report: %w", err)
	}
	for _, s := range asnaps {
		in.snapshots = append(in.snapshots, reportSnapshot{positionID: s.PositionID, yearMonth: s.YearMonth, amount: s.Amount})
	}
	lsnaps, err := r.q.ListLiabilitySnapshotsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list liability snapshots for report: %w", err)
	}
	for _, s := range lsnaps {
		in.snapshots = append(in.snapshots, reportSnapshot{positionID: s.PositionID, yearMonth: s.YearMonth, amount: s.Amount})
	}
	rsnaps, err := r.q.ListReceivableSnapshotsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list receivable snapshots for report: %w", err)
	}
	for _, s := range rsnaps {
		in.snapshots = append(in.snapshots, reportSnapshot{positionID: s.PositionID, yearMonth: s.YearMonth, amount: s.Amount})
	}
	isnaps, err := r.q.ListInvestmentSnapshotsForReport(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list investment snapshots for report: %w", err)
	}
	for _, s := range isnaps {
		in.snapshots = append(in.snapshots, reportSnapshot{positionID: s.PositionID, yearMonth: s.YearMonth, amount: s.Amount})
	}

	users, err := r.q.ListUsersByHousehold(ctx, hid)
	if err != nil {
		return in, fmt.Errorf("list household members for report: %w", err)
	}
	for _, u := range users {
		in.members = append(in.members, u.ID)
	}
	return in, nil
}
