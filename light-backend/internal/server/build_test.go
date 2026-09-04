package server_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// validBuild spends exactly the 16-point budget: the 10-stat level-1 floor
// costs 10 and the 6 spare points go on top.
func validBuild() map[string]int {
	return map[string]int{
		"dash.cooldownMs":   2,
		"dash.distance":     1,
		"slash.cooldownMs":  3,
		"slash.range":       1,
		"slash.areaDeg":     1,
		"slash.damage":      3,
		"shot.cooldownMs":   1,
		"shot.range":        1,
		"shot.damage":       2,
		"shield.cooldownMs": 1,
	}
}

func putBuild(t *testing.T, h http.Handler, token string, build map[string]int) *responseWithBuild {
	t.Helper()
	rec := doJSON(t, h, http.MethodPut, "/profile/build", token, map[string]any{"configured_stats": build})
	var body responseWithBuild
	body.Code = rec.Code
	body.Raw = rec.Body.String()
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return &body
}

type responseWithBuild struct {
	Code            int            `json:"-"`
	Raw             string         `json:"-"`
	ConfiguredStats map[string]int `json:"configured_stats"`
	Error           string         `json:"error"`
	Details         []string       `json:"details"`
}

func getProfileRaw(t *testing.T, h http.Handler, token string) (map[string]any, string) {
	t.Helper()
	rec := doJSON(t, h, http.MethodGet, "/profile", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /profile: got %d; body=%s", rec.Code, rec.Body)
	}
	var m map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	return m, rec.Body.String()
}

// AC4: before any build is saved, the profile has no configured_stats key at
// all — the v1 response shape is preserved for buildless users.
// AC1: a valid 16-point build saves and comes back on a subsequent read.
func TestBuildSaveAndReadBack(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "build@example.com")

	_, raw := getProfileRaw(t, h, token)
	if strings.Contains(raw, "configured_stats") {
		t.Fatalf("buildless profile leaks configured_stats: %s", raw)
	}

	res := putBuild(t, h, token, validBuild())
	if res.Code != http.StatusOK {
		t.Fatalf("PUT /profile/build: got %d; body=%s", res.Code, res.Raw)
	}
	if res.ConfiguredStats["slash.damage"] != 3 {
		t.Fatalf("PUT response build = %v", res.ConfiguredStats)
	}

	// Read back with a fresh login, as the frontend would on load.
	token2 := loginToken(t, h, "build@example.com")
	m, _ := getProfileRaw(t, h, token2)
	stats, ok := m["configured_stats"].(map[string]any)
	if !ok {
		t.Fatalf("profile has no configured_stats after save: %v", m)
	}
	for id, level := range validBuild() {
		if got, _ := stats[id].(float64); int(got) != level {
			t.Errorf("read back %s = %v, want %d", id, stats[id], level)
		}
	}

	// A re-save fully replaces the build (same budget, different spread).
	other := validBuild()
	other["slash.damage"] = 1
	other["dash.distance"] = 3
	if res := putBuild(t, h, token, other); res.Code != http.StatusOK {
		t.Fatalf("re-save: got %d; body=%s", res.Code, res.Raw)
	}
	m, _ = getProfileRaw(t, h, token)
	stats = m["configured_stats"].(map[string]any)
	if int(stats["slash.damage"].(float64)) != 1 || int(stats["dash.distance"].(float64)) != 3 {
		t.Fatalf("re-save not applied: %v", stats)
	}
}

// AC2: a build whose points sum ≠ 16 is rejected naming the budget rule, and
// nothing is persisted.
func TestBuildBudgetRejected(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "budget@example.com")

	over := validBuild()
	over["dash.distance"] = 2 // 17 points
	res := putBuild(t, h, token, over)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("over-budget: got %d, want 400; body=%s", res.Code, res.Raw)
	}
	if !hasDetail(res.Details, "spends 17 of 16 points (over by 1)") {
		t.Errorf("budget rule not named: %s", res.Raw)
	}

	// Nothing persisted.
	_, raw := getProfileRaw(t, h, token)
	if strings.Contains(raw, "configured_stats") {
		t.Fatalf("rejected build was persisted: %s", raw)
	}
}

// AC3: unknown stat names and out-of-bounds levels are rejected naming the
// offending stat; a rejected re-save leaves the previous build untouched.
func TestBuildStatAndBoundsRejected(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "bounds@example.com")

	// Save a valid build first so we can prove a rejected write changes nothing.
	if res := putBuild(t, h, token, validBuild()); res.Code != http.StatusOK {
		t.Fatalf("seed build: got %d; body=%s", res.Code, res.Raw)
	}

	cases := []struct {
		name   string
		mutate func(map[string]int)
		want   string
	}{
		{"unknown stat", func(b map[string]int) { b["bash.damage"] = 1 }, "bash.damage is not a leveled stat"},
		{"over max level", func(b map[string]int) { b["slash.damage"] = 4 }, "slash.damage level 4 exceeds its max level 3"},
		{"below level 1", func(b map[string]int) { b["shot.damage"] = 0 }, "shot.damage level 0 is below the level-1 minimum"},
		{"missing stat", func(b map[string]int) { delete(b, "shield.cooldownMs") }, "shield.cooldownMs is missing (level 1 is the minimum)"},
	}
	for _, tc := range cases {
		b := validBuild()
		tc.mutate(b)
		res := putBuild(t, h, token, b)
		if res.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400; body=%s", tc.name, res.Code, res.Raw)
			continue
		}
		if !hasDetail(res.Details, tc.want) {
			t.Errorf("%s: offending stat not named, details=%v", tc.name, res.Details)
		}
	}

	// The original valid build is still intact.
	m, _ := getProfileRaw(t, h, token)
	stats, ok := m["configured_stats"].(map[string]any)
	if !ok || int(stats["slash.damage"].(float64)) != 3 {
		t.Fatalf("rejected writes disturbed the stored build: %v", m)
	}
}

// AC5: the endpoints require auth; a missing configured_stats key is a 400.
func TestBuildAuthAndBody(t *testing.T) {
	h := newTestServer()
	token := signupAndLogin(t, h, "authb@example.com")

	if rec := doJSON(t, h, http.MethodPut, "/profile/build", "", map[string]any{"configured_stats": validBuild()}); rec.Code != http.StatusUnauthorized {
		t.Errorf("PUT no token: got %d, want 401", rec.Code)
	}
	if rec := doJSON(t, h, http.MethodPut, "/profile/build", token, map[string]any{}); rec.Code != http.StatusBadRequest {
		t.Errorf("PUT without configured_stats: got %d, want 400", rec.Code)
	}
	// Non-integer levels cannot bind into map[string]int.
	if rec := doJSON(t, h, http.MethodPut, "/profile/build", token, map[string]any{"configured_stats": map[string]any{"slash.damage": 1.5}}); rec.Code != http.StatusBadRequest {
		t.Errorf("PUT fractional level: got %d, want 400", rec.Code)
	}
}

func hasDetail(details []string, want string) bool {
	for _, d := range details {
		if strings.Contains(d, want) {
			return true
		}
	}
	return false
}

// loginToken logs an existing account in and returns a fresh bearer token.
func loginToken(t *testing.T, h http.Handler, email string) string {
	t.Helper()
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
