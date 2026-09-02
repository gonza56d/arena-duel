package server_test

import (
	"net/http"
	"testing"
)

// AC4: finishing a match bumps games_played, and victories only on a win. The
// counters are server-owned; the client just reports the result.
func TestRecordMatch(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "record@example.com")

	// A win: both counters rise by one.
	rec := doJSON(t, h, http.MethodPost, "/profile/record", token, map[string]any{"won": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("record win: got %d; body=%s", rec.Code, rec.Body)
	}
	if p := getProfile(t, h, token); p.Victories != 1 || p.GamesPlayed != 1 {
		t.Fatalf("after win: victories=%d games_played=%d, want 1/1", p.Victories, p.GamesPlayed)
	}

	// A loss: only games_played rises.
	rec = doJSON(t, h, http.MethodPost, "/profile/record", token, map[string]any{"won": false})
	if rec.Code != http.StatusOK {
		t.Fatalf("record loss: got %d; body=%s", rec.Code, rec.Body)
	}
	if p := getProfile(t, h, token); p.Victories != 1 || p.GamesPlayed != 2 {
		t.Fatalf("after loss: victories=%d games_played=%d, want 1/2", p.Victories, p.GamesPlayed)
	}

	// Each call is exactly one game: a tampered client cannot inflate its record.
	for i := 0; i < 3; i++ {
		doJSON(t, h, http.MethodPost, "/profile/record", token, map[string]any{"won": true})
	}
	if p := getProfile(t, h, token); p.Victories != 4 || p.GamesPlayed != 5 {
		t.Fatalf("after three wins: victories=%d games_played=%d, want 4/5", p.Victories, p.GamesPlayed)
	}
}

func TestRecordMatchRequiresAuth(t *testing.T) {
	h := newTestServer()
	if rec := doJSON(t, h, http.MethodPost, "/profile/record", "", map[string]any{"won": true}); rec.Code != http.StatusUnauthorized {
		t.Errorf("record with no token: got %d, want 401", rec.Code)
	}
}
