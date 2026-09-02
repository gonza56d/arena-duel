package server_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

type profile struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	PlayerName  string `json:"player_name"`
	Color       string `json:"color"`
	Victories   int    `json:"victories"`
	GamesPlayed int    `json:"games_played"`
}

// signupAndLogin registers the email and returns a bearer token.
func signupAndLogin(t *testing.T, h http.Handler, email string) string {
	t.Helper()
	if rec := doJSON(t, h, http.MethodPost, "/auth/signup", "", creds{email, "passw0rd"}); rec.Code != http.StatusCreated {
		t.Fatalf("signup: got %d; body=%s", rec.Code, rec.Body)
	}
	login := doJSON(t, h, http.MethodPost, "/auth/login", "", creds{email, "passw0rd"})
	if login.Code != http.StatusOK {
		t.Fatalf("login: got %d; body=%s", login.Code, login.Body)
	}
	var lr struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &lr); err != nil || lr.Token == "" {
		t.Fatalf("login token: err=%v body=%s", err, login.Body)
	}
	return lr.Token
}

func getProfile(t *testing.T, h http.Handler, token string) profile {
	t.Helper()
	rec := doJSON(t, h, http.MethodGet, "/profile", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /profile: got %d; body=%s", rec.Code, rec.Body)
	}
	var p profile
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	return p
}

// AC1 + AC2: set name and color, change the name later, both persist across a
// fresh request and across a re-login; the profile endpoint returns all fields.
func TestProfileSetAndPersist(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "prof@example.com")

	// Fresh account: default color, empty name, zero record.
	p := getProfile(t, h, token)
	if p.Email != "prof@example.com" || p.PlayerName != "" || p.Color != "#ffffff" || p.Victories != 0 || p.GamesPlayed != 0 {
		t.Fatalf("fresh profile = %+v", p)
	}

	// Set name + color (preset name is normalized to hex).
	rec := doJSON(t, h, http.MethodPatch, "/profile", token, map[string]string{"player_name": "  Zed  ", "color": "Red"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH /profile: got %d; body=%s", rec.Code, rec.Body)
	}
	p = getProfile(t, h, token)
	if p.PlayerName != "Zed" || p.Color != "#e53935" {
		t.Fatalf("after set: name=%q color=%q", p.PlayerName, p.Color)
	}

	// Change only the name; color stays.
	rec = doJSON(t, h, http.MethodPatch, "/profile", token, map[string]string{"player_name": "Zed the Great"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH rename: got %d; body=%s", rec.Code, rec.Body)
	}
	p = getProfile(t, h, token)
	if p.PlayerName != "Zed the Great" || p.Color != "#e53935" {
		t.Fatalf("after rename: name=%q color=%q", p.PlayerName, p.Color)
	}

	// Change only the color with a hex value.
	rec = doJSON(t, h, http.MethodPatch, "/profile", token, map[string]string{"color": "#00FF00"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH color: got %d; body=%s", rec.Code, rec.Body)
	}

	// "Reload": log in again and read with a new token.
	login := doJSON(t, h, http.MethodPost, "/auth/login", "", creds{"prof@example.com", "passw0rd"})
	var lr struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(login.Body.Bytes(), &lr)
	p = getProfile(t, h, lr.Token)
	if p.PlayerName != "Zed the Great" || p.Color != "#00ff00" {
		t.Fatalf("after re-login: name=%q color=%q", p.PlayerName, p.Color)
	}

	// /me also carries the profile fields.
	me := doJSON(t, h, http.MethodGet, "/me", lr.Token, nil)
	var mp profile
	_ = json.Unmarshal(me.Body.Bytes(), &mp)
	if mp.PlayerName != "Zed the Great" || mp.Color != "#00ff00" {
		t.Fatalf("/me profile fields: %+v", mp)
	}
}

// AC3: victories / games_played cannot be edited by the client.
func TestProfileCountersReadOnly(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "cheat@example.com")

	rec := doJSON(t, h, http.MethodPatch, "/profile", token, map[string]any{
		"player_name":  "Cheater",
		"victories":    99,
		"games_played": 100,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH with counters: got %d; body=%s", rec.Code, rec.Body)
	}
	p := getProfile(t, h, token)
	if p.PlayerName != "Cheater" {
		t.Errorf("name not applied: %q", p.PlayerName)
	}
	if p.Victories != 0 || p.GamesPlayed != 0 {
		t.Fatalf("counters were client-editable: victories=%d games_played=%d", p.Victories, p.GamesPlayed)
	}

	// A body carrying only counters has nothing to apply -> 400.
	rec = doJSON(t, h, http.MethodPatch, "/profile", token, map[string]any{"victories": 5})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("PATCH counters only: got %d, want 400", rec.Code)
	}
}

func TestProfileValidationAndAuth(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "val@example.com")

	bad := []map[string]any{
		{},                                   // empty
		{"player_name": "x"},                 // too short
		{"player_name": "bad\tname"},         // control char
		{"color": "#fff"},                    // short hex
		{"color": "teal"},                    // unknown preset
		{"color": "red", "player_name": "a"}, // one valid, one invalid -> reject whole request
	}
	for _, body := range bad {
		rec := doJSON(t, h, http.MethodPatch, "/profile", token, body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("PATCH %v: got %d, want 400", body, rec.Code)
		}
	}
	// Nothing from the rejected requests leaked through.
	p := getProfile(t, h, token)
	if p.PlayerName != "" || p.Color != "#ffffff" {
		t.Errorf("rejected update was applied: %+v", p)
	}

	if rec := doJSON(t, h, http.MethodGet, "/profile", "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("GET /profile no token: got %d, want 401", rec.Code)
	}
	if rec := doJSON(t, h, http.MethodPatch, "/profile", "", map[string]string{"player_name": "Nope"}); rec.Code != http.StatusUnauthorized {
		t.Errorf("PATCH /profile no token: got %d, want 401", rec.Code)
	}
}
