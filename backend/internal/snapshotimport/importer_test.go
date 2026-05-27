package snapshotimport

import (
	"bytes"
	"testing"

	"github.com/xuri/excelize/v2"
)

// buildXLSX writes the given rows (including the header row) to the Snapshots
// sheet of an in-memory .xlsx and returns its bytes.
func buildXLSX(t *testing.T, rows [][]string) []byte {
	t.Helper()
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	if _, err := f.NewSheet(SheetName); err != nil {
		t.Fatalf("new sheet: %v", err)
	}
	for r, row := range rows {
		for c, v := range row {
			cell, _ := excelize.CoordinatesToCellName(c+1, r+1)
			if err := f.SetCellStr(SheetName, cell, v); err != nil {
				t.Fatalf("set cell: %v", err)
			}
		}
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("serialise: %v", err)
	}
	return buf.Bytes()
}

var header = []string{"year_month", "as_of_date", "amount", "currency", "description"}

func parse(t *testing.T, rows [][]string, opts Options) ([]ParsedRow, []RowError) {
	t.Helper()
	in := append([][]string{header}, rows...)
	parsed, errs, err := Parse(bytes.NewReader(buildXLSX(t, in)), opts)
	if err != nil {
		t.Fatalf("Parse returned file error: %v", err)
	}
	return parsed, errs
}

func TestParse_HappyPath(t *testing.T) {
	parsed, errs := parse(t, [][]string{
		{"2015-01", "2015-01-31", "10000000", "IDR", "Opening"},
		{"2015-02", "", "10500000", "", ""},          // currency defaults, no as_of/desc
		{"", "2015-03-31", "11000000", "usd", "Mar"}, // month derived from as_of, currency upcased
	}, Options{DefaultCurrency: "IDR"})

	if len(errs) != 0 {
		t.Fatalf("unexpected row errors: %+v", errs)
	}
	if len(parsed) != 3 {
		t.Fatalf("want 3 parsed rows, got %d", len(parsed))
	}

	if got := parsed[0].YearMonth.Format("2006-01-02"); got != "2015-01-01" {
		t.Errorf("row1 year_month = %s, want 2015-01-01", got)
	}
	if parsed[0].AsOfDate == nil || parsed[0].AsOfDate.Format("2006-01-02") != "2015-01-31" {
		t.Errorf("row1 as_of_date not parsed: %v", parsed[0].AsOfDate)
	}
	if parsed[0].Description == nil || *parsed[0].Description != "Opening" {
		t.Errorf("row1 description = %v, want Opening", parsed[0].Description)
	}

	// Row 2: blank currency -> default; blank as_of/desc -> nil.
	if parsed[1].Currency != "IDR" {
		t.Errorf("row2 currency = %q, want IDR (default)", parsed[1].Currency)
	}
	if parsed[1].AsOfDate != nil || parsed[1].Description != nil {
		t.Errorf("row2 optional fields should be nil: as_of=%v desc=%v", parsed[1].AsOfDate, parsed[1].Description)
	}

	// Row 3: month derived from as_of_date; currency upcased.
	if got := parsed[2].YearMonth.Format("2006-01-02"); got != "2015-03-01" {
		t.Errorf("row3 derived month = %s, want 2015-03-01", got)
	}
	if parsed[2].Currency != "USD" {
		t.Errorf("row3 currency = %q, want USD", parsed[2].Currency)
	}
	if !parsed[2].Amount.Equal(parsed[2].Amount) || parsed[2].Amount.String() != "11000000" {
		t.Errorf("row3 amount = %s, want 11000000", parsed[2].Amount)
	}
}

func TestParse_RowErrors(t *testing.T) {
	parsed, errs := parse(t, [][]string{
		{"2016-01", "", "notanumber", "", ""},     // row 2: bad amount
		{"2016-02", "", "", "", ""},               // row 3: missing amount
		{"", "", "5000", "", "orphan"},            // row 4: no month, no as_of
		{"2016-13", "", "5000", "", ""},           // row 5: bad month
		{"2016-05", "", "5000", "ZZ", ""},         // row 6: bad currency (fails ISO check)
		{"2016-06", "2016-06-31", "5000", "", ""}, // row 7: impossible date
	}, Options{DefaultCurrency: "IDR", ValidCurrency: func(c string) bool { return c == "IDR" || c == "USD" }})

	if len(parsed) != 0 {
		t.Fatalf("want 0 parsed rows, got %d: %+v", len(parsed), parsed)
	}
	if len(errs) != 6 {
		t.Fatalf("want 6 row errors, got %d: %+v", len(errs), errs)
	}
	// Errors carry the right (1-based, header-offset) row numbers.
	wantRows := []int{2, 3, 4, 5, 6, 7}
	for i, e := range errs {
		if e.Row != wantRows[i] {
			t.Errorf("error %d row = %d, want %d (%s)", i, e.Row, wantRows[i], e.Message)
		}
	}
}

func TestParse_DuplicateMonth(t *testing.T) {
	parsed, errs := parse(t, [][]string{
		{"2017-01", "", "100", "", ""},       // row 2: kept
		{"", "2017-01-15", "200", "", "dup"}, // row 3: derives to 2017-01 -> duplicate
	}, Options{DefaultCurrency: "IDR"})

	if len(parsed) != 1 {
		t.Fatalf("want 1 parsed row, got %d", len(parsed))
	}
	if len(errs) != 1 || errs[0].Row != 3 {
		t.Fatalf("want 1 dup error on row 3, got %+v", errs)
	}
}

func TestParse_BlankRowsSkipped(t *testing.T) {
	parsed, errs := parse(t, [][]string{
		{"2018-01", "", "100", "", ""},
		{"", "", "", "", ""}, // fully blank -> skipped, not an error
		{"2018-02", "", "200", "", ""},
	}, Options{DefaultCurrency: "IDR"})

	if len(errs) != 0 {
		t.Fatalf("blank row should not error: %+v", errs)
	}
	if len(parsed) != 2 {
		t.Fatalf("want 2 parsed rows, got %d", len(parsed))
	}
}

// TestRoundTrip proves the generated template is itself parseable and its
// example row is valid — the format we emit is the format we accept.
func TestRoundTrip(t *testing.T) {
	tpl, err := BuildTemplate(TemplateMeta{AssetName: "BCA Tabungan", DefaultCurrency: "IDR"})
	if err != nil {
		t.Fatalf("BuildTemplate: %v", err)
	}
	parsed, errs, err := Parse(bytes.NewReader(tpl), Options{DefaultCurrency: "IDR"})
	if err != nil {
		t.Fatalf("Parse(template): %v", err)
	}
	if len(errs) != 0 {
		t.Fatalf("template example row should be valid: %+v", errs)
	}
	if len(parsed) != 1 {
		t.Fatalf("template should carry exactly 1 example row, got %d", len(parsed))
	}
	if got := parsed[0].YearMonth.Format("2006-01"); got != "2015-01" {
		t.Errorf("example month = %s, want 2015-01", got)
	}
}
