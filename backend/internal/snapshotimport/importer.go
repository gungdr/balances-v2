// Package snapshotimport turns a spreadsheet template into validated snapshot
// rows. It is intentionally DB-free and HTTP-free so it can be unit-tested in
// isolation: BuildTemplate emits the .xlsx a user downloads, and Parse reads a
// filled-in one back. The repo + HTTP layers own tenancy, persistence, and
// currency policy; this package owns only the file shape and per-row parsing.
//
// The format is .xlsx (an open ISO standard, not Microsoft-specific): Google
// Sheets, LibreOffice, Numbers, and Excel all round-trip it. Cells are read as
// formatted strings, so the template ships numbers/dates as plain text and the
// instructions tell users to download as .xlsx (not CSV, which would
// re-introduce locale-specific number formatting).
package snapshotimport

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
)

// SheetName is the worksheet the importer reads data rows from.
const SheetName = "Snapshots"

const instructionsSheet = "Instructions"

// headers are the column order of the template, left to right.
var headers = []string{"year_month", "as_of_date", "amount", "currency", "description"}

// ParsedRow is one validated snapshot ready to upsert. Row is the 1-based
// spreadsheet row number, surfaced in errors so a non-technical user can find
// the offending line.
type ParsedRow struct {
	Row         int
	YearMonth   time.Time
	Amount      decimal.Decimal
	Currency    string
	AsOfDate    *time.Time
	Description *string
}

// RowError reports a single rejected row. The whole import is refused if any
// RowError is present (all-or-nothing), so the user fixes and re-uploads.
type RowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// Options configures parsing. DefaultCurrency fills rows that leave the
// currency column blank (the position's native currency). ValidCurrency, when
// non-nil, gates each resolved currency (ISO-4217 in production; nil in tests
// that don't care).
type Options struct {
	DefaultCurrency string
	ValidCurrency   func(string) bool
}

// TemplateMeta scopes a generated template to one position. PositionName is the
// position's display name (asset / liability / receivable — the importer is
// position-group-agnostic, only the calling repo knows the group).
type TemplateMeta struct {
	PositionName    string
	DefaultCurrency string
}

// BuildTemplate returns the bytes of an .xlsx template scoped to one position:
// a "Snapshots" sheet (header + one example row) and an "Instructions" sheet.
func BuildTemplate(meta TemplateMeta) ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	idx, err := f.NewSheet(SheetName)
	if err != nil {
		return nil, fmt.Errorf("new sheet: %w", err)
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := f.SetCellStr(SheetName, cell, h); err != nil {
			return nil, fmt.Errorf("write header: %w", err)
		}
	}
	example := []string{"2015-01", "2015-01-31", "10000000", meta.DefaultCurrency, "Opening balance"}
	for i, v := range example {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		if err := f.SetCellStr(SheetName, cell, v); err != nil {
			return nil, fmt.Errorf("write example: %w", err)
		}
	}

	if _, err := f.NewSheet(instructionsSheet); err != nil {
		return nil, fmt.Errorf("new instructions sheet: %w", err)
	}
	for i, line := range instructions(meta) {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		if err := f.SetCellStr(instructionsSheet, cell, line); err != nil {
			return nil, fmt.Errorf("write instructions: %w", err)
		}
	}

	if err := f.DeleteSheet("Sheet1"); err != nil {
		return nil, fmt.Errorf("delete default sheet: %w", err)
	}
	f.SetActiveSheet(idx)

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("serialise xlsx: %w", err)
	}
	return buf.Bytes(), nil
}

func instructions(meta TemplateMeta) []string {
	return []string{
		fmt.Sprintf("Snapshot import — %s", meta.PositionName),
		"",
		"Fill in the \"Snapshots\" sheet, one row per monthly balance.",
		"",
		"Columns:",
		"  year_month   — the month this balance belongs to, as YYYY-MM (e.g. 2015-01).",
		"                 Optional if you fill statement date instead — the month is taken from it.",
		"  as_of_date   — the statement date, as YYYY-MM-DD (e.g. 2015-01-31). Optional.",
		"  amount       — the balance, digits only, no thousands separators (e.g. 10000000). Required.",
		fmt.Sprintf("  currency     — 3-letter code (e.g. USD). Optional; defaults to %s.", meta.DefaultCurrency),
		"  description  — a free-text note. Optional.",
		"",
		"You do NOT need a row for every month. The report carries the latest balance",
		"forward until the next one, so enter only the months you actually have a figure for.",
		"",
		"Re-importing is safe: a month you already imported is overwritten, not duplicated.",
		"",
		"Editing in Google Sheets / LibreOffice / Numbers / Excel is all fine —",
		"just use \"Download as .xlsx\" (NOT CSV) when you save to upload.",
	}
}

// Parse reads the "Snapshots" sheet of an .xlsx and returns the valid rows plus
// a per-row error list. A returned error (vs RowError) means the file itself is
// unreadable or has no Snapshots sheet. Blank rows are skipped silently.
// Duplicate months within the file are reported (the later row is the error).
func Parse(r io.Reader, opts Options) ([]ParsedRow, []RowError, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, nil, fmt.Errorf("not a readable .xlsx file: %w", err)
	}
	defer func() { _ = f.Close() }()

	rows, err := f.GetRows(SheetName)
	if err != nil {
		return nil, nil, fmt.Errorf("read sheet %q: %w", SheetName, err)
	}
	if len(rows) == 0 {
		return nil, nil, errors.New("sheet \"Snapshots\" has no header row")
	}

	var (
		parsed []ParsedRow
		errs   []RowError
		seen   = map[string]int{} // year_month "2006-01" -> first row number
	)

	for i := 1; i < len(rows); i++ {
		rowNum := i + 1 // 1-based, header is row 1
		cols := rows[i]
		get := func(idx int) string {
			if idx < len(cols) {
				return strings.TrimSpace(cols[idx])
			}
			return ""
		}
		ymStr, asOfStr, amtStr, curStr, descStr := get(0), get(1), get(2), get(3), get(4)

		if ymStr == "" && asOfStr == "" && amtStr == "" && curStr == "" && descStr == "" {
			continue
		}

		var asOf *time.Time
		if asOfStr != "" {
			t, err := parseDate(asOfStr)
			if err != nil {
				errs = append(errs, RowError{rowNum, "statement date must be YYYY-MM-DD (got " + asOfStr + ")"})
				continue
			}
			asOf = &t
		}

		var ym time.Time
		switch {
		case ymStr != "":
			t, err := parseYearMonth(ymStr)
			if err != nil {
				errs = append(errs, RowError{rowNum, "month must be YYYY-MM (got " + ymStr + ")"})
				continue
			}
			ym = t
		case asOf != nil:
			ym = firstOfMonth(*asOf)
		default:
			errs = append(errs, RowError{rowNum, "provide a month (year_month) or a statement date"})
			continue
		}

		if amtStr == "" {
			errs = append(errs, RowError{rowNum, "amount is required"})
			continue
		}
		amt, err := decimal.NewFromString(amtStr)
		if err != nil {
			errs = append(errs, RowError{rowNum, "amount must be a number with no thousands separators (got " + amtStr + ")"})
			continue
		}

		cur := strings.ToUpper(curStr)
		if cur == "" {
			cur = strings.ToUpper(opts.DefaultCurrency)
		}
		if opts.ValidCurrency != nil && !opts.ValidCurrency(cur) {
			errs = append(errs, RowError{rowNum, "currency must be a 3-letter ISO code (got " + cur + ")"})
			continue
		}

		var desc *string
		if descStr != "" {
			d := descStr
			desc = &d
		}

		key := ym.Format("2006-01")
		if first, dup := seen[key]; dup {
			errs = append(errs, RowError{rowNum, "duplicate month " + key + " (already on row " + strconv.Itoa(first) + ")"})
			continue
		}
		seen[key] = rowNum

		parsed = append(parsed, ParsedRow{
			Row:         rowNum,
			YearMonth:   ym,
			Amount:      amt,
			Currency:    cur,
			AsOfDate:    asOf,
			Description: desc,
		})
	}

	return parsed, errs, nil
}

// parseYearMonth accepts "YYYY-MM" or a full date, normalising to first-of-month
// (mirrors the backend handler's parseYearMonth so the importer and the
// single-row create path agree on the month convention).
func parseYearMonth(s string) (time.Time, error) {
	if t, err := time.Parse("2006-01", s); err == nil {
		return t, nil
	}
	t, err := parseDate(s)
	if err != nil {
		return time.Time{}, err
	}
	return firstOfMonth(t), nil
}

// parseDate accepts ISO-ish dates only. MM/DD vs DD/MM is deliberately not
// guessed — the template asks for YYYY-MM-DD, and an ambiguous format errors
// loudly rather than silently picking the wrong day.
func parseDate(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02", "2006/01/02", "2006-1-2"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognised date %q (use YYYY-MM-DD)", s)
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}
