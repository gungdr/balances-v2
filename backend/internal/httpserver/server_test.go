package httpserver_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kerti/balances-v2/backend/internal/config"
	"github.com/kerti/balances-v2/backend/internal/httpserver"
	"github.com/kerti/balances-v2/backend/internal/testutil"
)

// TestServer_Healthz exercises New → buildRouter → Handler → handleHealthz end
// to end with a real pool. The route handlers are passed nil: buildRouter and
// each Mount only register method values (e.g. `r.Get("/", h.handleX)`), which
// is valid Go on a nil receiver and never dereferences the handler. The request
// carries no session cookie, so SessionMiddleware short-circuits before it would
// touch authH.q. /healthz is the one route that depends solely on the pool, so
// it proves the wiring without standing up the OIDC-discovering auth.New.
func TestServer_Healthz(t *testing.T) {
	tdb := testutil.NewTestDB(t)

	s := httpserver.New(tdb.Pool, &config.Config{}, nil, nil, nil, nil, nil, nil, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body.String())
	}

	var body struct {
		OK     bool   `json:"ok"`
		DBTime string `json:"db_time"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v (raw: %s)", err, rec.Body.String())
	}
	if !body.OK {
		t.Errorf("ok = false, want true")
	}
	if body.DBTime == "" {
		t.Errorf("db_time empty, want a timestamp from SELECT now()")
	}
}
