package assets

import (
	"fmt"
	"net/http"

	"github.com/kerti/balances-v2/backend/internal/repo"
	"github.com/kerti/balances-v2/backend/internal/snapshotimport"
)

// maxImportUpload caps the uploaded spreadsheet size. A decade of monthly rows
// is a few KB; 5 MB is generous headroom against a hostile/confused upload.
const maxImportUpload = 5 << 20 // 5 MB

// handleImportTemplate streams an .xlsx snapshot-import template scoped to the
// asset (its name + native currency baked into the example + instructions).
func (h *Handlers) handleImportTemplate(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	name, currency, err := h.repo.AssetImportMeta(r.Context(), assetID)
	if err != nil {
		writeRepoError(w, "import template: asset meta", err)
		return
	}

	xlsx, err := snapshotimport.BuildTemplate(snapshotimport.TemplateMeta{
		AssetName:       name,
		DefaultCurrency: currency,
	})
	if err != nil {
		writeRepoError(w, "import template: build", err)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="snapshot-import-template.xlsx"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(xlsx)
}

type importResponse struct {
	Mode      string                    `json:"mode"`      // "preview" | "commit"
	Committed bool                      `json:"committed"` // true only when rows were written
	ToInsert  int                       `json:"to_insert"`
	ToUpdate  int                       `json:"to_update"`
	Errors    []snapshotimport.RowError `json:"errors"`
}

// handleImportSnapshots accepts a filled-in template (multipart "file"). With
// mode=preview (default) it parses + validates + classifies and writes nothing.
// With mode=commit it additionally upserts, but only if zero rows errored
// (all-or-nothing) — otherwise it returns 422 with the row errors.
func (h *Handlers) handleImportSnapshots(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseIDParam(r, "id")
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "preview"
	}
	if mode != "preview" && mode != "commit" {
		http.Error(w, "invalid mode: expected preview or commit", http.StatusBadRequest)
		return
	}

	// Ownership check + default currency for blank cells (404 if not owned).
	_, currency, err := h.repo.AssetImportMeta(r.Context(), assetID)
	if err != nil {
		writeRepoError(w, "import: asset meta", err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxImportUpload)
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing or oversized file upload (field \"file\")", http.StatusBadRequest)
		return
	}
	defer func() { _ = file.Close() }()

	parsed, rowErrs, err := snapshotimport.Parse(file, snapshotimport.Options{
		DefaultCurrency: currency,
		ValidCurrency:   func(c string) bool { return h.validate.Var(c, "iso4217") == nil },
	})
	if err != nil {
		http.Error(w, "could not read spreadsheet: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp := importResponse{Mode: mode, Errors: rowErrs}
	if resp.Errors == nil {
		resp.Errors = []snapshotimport.RowError{}
	}

	// commit refuses to write a file with any bad row — fix and re-upload.
	if mode == "commit" && len(rowErrs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, resp)
		return
	}

	rows := make([]repo.ImportSnapshotRow, len(parsed))
	for i, p := range parsed {
		rows[i] = repo.ImportSnapshotRow{
			YearMonth:   p.YearMonth,
			Amount:      p.Amount,
			Currency:    p.Currency,
			AsOfDate:    p.AsOfDate,
			Description: p.Description,
		}
	}

	dryRun := mode == "preview"
	res, err := h.repo.ImportAssetSnapshots(r.Context(), assetID, rows, dryRun)
	if err != nil {
		writeRepoError(w, fmt.Sprintf("import snapshots (%s)", mode), err)
		return
	}

	resp.ToInsert = res.ToInsert
	resp.ToUpdate = res.ToUpdate
	resp.Committed = mode == "commit"
	writeJSON(w, http.StatusOK, resp)
}
