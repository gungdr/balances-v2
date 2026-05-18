package httpserver

import (
	"encoding/json"
	"net/http"
	"time"
)

type healthzResponse struct {
	OK     bool      `json:"ok"`
	DBTime time.Time `json:"db_time"`
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	var dbTime time.Time
	if err := s.pool.QueryRow(r.Context(), "SELECT now()").Scan(&dbTime); err != nil {
		http.Error(w, "db unreachable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthzResponse{OK: true, DBTime: dbTime})
}
