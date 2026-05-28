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
//
// Snapshots come in three column shapes (per ADR-0022's value-column XOR):
//   - ShapeAmount         — a single `amount` (bank/property/vehicle/liability/
//     receivable, and time-deposit/bond via the accrued variant below).
//   - ShapeQuantityPrice  — `quantity` + `price_per_unit`; amount is derived as
//     quantity × price_per_unit (stock/mutual_fund/gold).
//   - ShapeAccruedInterest — `amount` (the total value, incl. accrued) +
//     `accrued_interest` (bond/time_deposit).
//
// Shape is the zero-value-safe ShapeAmount by default, so callers that don't
// set it (the flat amount-shape groups) need no change.
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

// Shape selects the column layout of the template (and the columns Parse
// expects). The zero value is ShapeAmount, so existing flat-amount callers are
// unaffected.
type Shape int

const (
	// ShapeAmount: year_month, as_of_date, amount, currency, description.
	ShapeAmount Shape = iota
	// ShapeQuantityPrice: year_month, as_of_date, quantity, price_per_unit,
	// currency, description. Amount is derived (quantity × price_per_unit).
	ShapeQuantityPrice
	// ShapeAccruedInterest: year_month, as_of_date, amount, accrued_interest,
	// currency, description. Amount is the total value including accrued.
	ShapeAccruedInterest
)

// headersFor returns the column order of the template for a shape, left to
// right. ym + as_of_date always lead; currency + description always trail; the
// value columns sit in between.
func headersFor(shape Shape) []string {
	switch shape {
	case ShapeQuantityPrice:
		return []string{"year_month", "as_of_date", "quantity", "price_per_unit", "currency", "description"}
	case ShapeAccruedInterest:
		return []string{"year_month", "as_of_date", "amount", "accrued_interest", "currency", "description"}
	default:
		return []string{"year_month", "as_of_date", "amount", "currency", "description"}
	}
}

// valueColumns is the count of value columns between as_of_date and currency
// (1 for ShapeAmount, 2 for the others) — used to locate the trailing
// currency/description columns.
func valueColumns(shape Shape) int {
	if shape == ShapeAmount {
		return 1
	}
	return 2
}

// ParsedRow is one validated snapshot ready to upsert. Row is the 1-based
// spreadsheet row number, surfaced in errors so a non-technical user can find
// the offending line. Amount is always populated (derived for
// ShapeQuantityPrice); the shape-specific pointers are nil unless that shape
// set them.
type ParsedRow struct {
	Row             int
	YearMonth       time.Time
	Amount          decimal.Decimal
	Currency        string
	Quantity        *decimal.Decimal // ShapeQuantityPrice only
	PricePerUnit    *decimal.Decimal // ShapeQuantityPrice only
	AccruedInterest *decimal.Decimal // ShapeAccruedInterest only
	AsOfDate        *time.Time
	Description     *string
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
// that don't care). Shape selects the column layout (default ShapeAmount).
type Options struct {
	DefaultCurrency string
	ValidCurrency   func(string) bool
	Shape           Shape
}

// TemplateMeta scopes a generated template to one position. PositionName is the
// position's display name (asset / liability / receivable / investment — the
// importer is position-group-agnostic, only the calling repo knows the group).
// Shape selects the column layout (default ShapeAmount).
type TemplateMeta struct {
	PositionName    string
	DefaultCurrency string
	Shape           Shape
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
	headers := headersFor(meta.Shape)
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := f.SetCellStr(SheetName, cell, h); err != nil {
			return nil, fmt.Errorf("write header: %w", err)
		}
	}
	for i, v := range exampleRow(meta) {
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

// exampleRow is the single illustrative data row, in the column order of the
// shape's headers.
func exampleRow(meta TemplateMeta) []string {
	switch meta.Shape {
	case ShapeQuantityPrice:
		return []string{"2015-01", "2015-01-31", "100", "8500", meta.DefaultCurrency, "100 units @ 8,500"}
	case ShapeAccruedInterest:
		return []string{"2015-01", "2015-01-31", "50250000", "250000", meta.DefaultCurrency, "Total incl. accrued"}
	default:
		return []string{"2015-01", "2015-01-31", "10000000", meta.DefaultCurrency, "Opening balance"}
	}
}

func instructions(meta TemplateMeta) []string {
	head := []string{
		fmt.Sprintf("Snapshot import — %s", meta.PositionName),
		"",
		"Fill in the \"Snapshots\" sheet, one row per monthly value.",
		"",
		"Columns:",
		"  year_month   — the month this value belongs to, as YYYY-MM (e.g. 2015-01).",
		"                 Optional if you fill statement date instead — the month is taken from it.",
		"  as_of_date   — the statement date, as YYYY-MM-DD (e.g. 2015-01-31). Optional.",
	}

	var valueLines []string
	switch meta.Shape {
	case ShapeQuantityPrice:
		valueLines = []string{
			"  quantity       — the number of units held that month, digits only. Required.",
			"  price_per_unit — the price of one unit that month, digits only. Required.",
			"                   (The total value is quantity × price_per_unit — computed for you.)",
		}
	case ShapeAccruedInterest:
		valueLines = []string{
			"  amount           — the total value that month (including accrued interest),",
			"                     digits only, no thousands separators. Required.",
			"  accrued_interest — the accrued-interest component, digits only. Optional;",
			"                     leave blank for 0.",
		}
	default:
		valueLines = []string{
			"  amount       — the balance, digits only, no thousands separators (e.g. 10000000). Required.",
		}
	}

	tail := []string{
		fmt.Sprintf("  currency     — 3-letter code (e.g. USD). Optional; defaults to %s.", meta.DefaultCurrency),
		"  description  — a free-text note. Optional.",
		"",
		"You do NOT need a row for every month. The report carries the latest value",
		"forward until the next one, so enter only the months you actually have a figure for.",
		"",
		"Re-importing is safe: a month you already imported is overwritten, not duplicated.",
		"",
		"Editing in Google Sheets / LibreOffice / Numbers / Excel is all fine —",
		"just use \"Download as .xlsx\" (NOT CSV) when you save to upload.",
	}

	return append(append(head, valueLines...), tail...)
}

// Parse reads the "Snapshots" sheet of an .xlsx and returns the valid rows plus
// a per-row error list. A returned error (vs RowError) means the file itself is
// unreadable or has no Snapshots sheet. Blank rows are skipped silently.
// Duplicate months within the file are reported (the later row is the error).
// The column layout it reads is selected by opts.Shape (default ShapeAmount).
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

	// Column positions: ym + as_of_date lead; currency + description trail the
	// value block (whose width depends on the shape).
	curIdx := 2 + valueColumns(opts.Shape)
	descIdx := curIdx + 1
	lastIdx := descIdx

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

		// Blank-row skip: every cell up to the last column is empty.
		blank := true
		for c := 0; c <= lastIdx; c++ {
			if get(c) != "" {
				blank = false
				break
			}
		}
		if blank {
			continue
		}

		ymStr, asOfStr := get(0), get(1)
		curStr, descStr := get(curIdx), get(descIdx)

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

		row := ParsedRow{Row: rowNum, YearMonth: ym, AsOfDate: asOf}
		if rerr := parseValues(opts.Shape, get, rowNum, &row); rerr != nil {
			errs = append(errs, *rerr)
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
		row.Currency = cur

		if descStr != "" {
			d := descStr
			row.Description = &d
		}

		key := ym.Format("2006-01")
		if first, dup := seen[key]; dup {
			errs = append(errs, RowError{rowNum, "duplicate month " + key + " (already on row " + strconv.Itoa(first) + ")"})
			continue
		}
		seen[key] = rowNum

		parsed = append(parsed, row)
	}

	return parsed, errs, nil
}

// parseValues fills the value columns of row from the shape's layout, returning
// a *RowError to reject the row (nil on success). Column indices: value block
// starts at index 2 (after year_month + as_of_date).
func parseValues(shape Shape, get func(int) string, rowNum int, row *ParsedRow) *RowError {
	switch shape {
	case ShapeQuantityPrice:
		qtyStr, priceStr := get(2), get(3)
		if qtyStr == "" || priceStr == "" {
			return &RowError{rowNum, "quantity and price_per_unit are both required"}
		}
		qty, err := decimal.NewFromString(qtyStr)
		if err != nil {
			return &RowError{rowNum, "quantity must be a number with no thousands separators (got " + qtyStr + ")"}
		}
		price, err := decimal.NewFromString(priceStr)
		if err != nil {
			return &RowError{rowNum, "price_per_unit must be a number with no thousands separators (got " + priceStr + ")"}
		}
		row.Quantity = &qty
		row.PricePerUnit = &price
		row.Amount = qty.Mul(price)
		return nil

	case ShapeAccruedInterest:
		amtStr, accStr := get(2), get(3)
		if amtStr == "" {
			return &RowError{rowNum, "amount is required"}
		}
		amt, err := decimal.NewFromString(amtStr)
		if err != nil {
			return &RowError{rowNum, "amount must be a number with no thousands separators (got " + amtStr + ")"}
		}
		acc := decimal.Zero
		if accStr != "" {
			acc, err = decimal.NewFromString(accStr)
			if err != nil {
				return &RowError{rowNum, "accrued_interest must be a number with no thousands separators (got " + accStr + ")"}
			}
		}
		row.Amount = amt
		row.AccruedInterest = &acc
		return nil

	default: // ShapeAmount
		amtStr := get(2)
		if amtStr == "" {
			return &RowError{rowNum, "amount is required"}
		}
		amt, err := decimal.NewFromString(amtStr)
		if err != nil {
			return &RowError{rowNum, "amount must be a number with no thousands separators (got " + amtStr + ")"}
		}
		row.Amount = amt
		return nil
	}
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
