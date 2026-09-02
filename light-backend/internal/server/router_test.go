package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/arena-duel/light-backend/internal/auth"
	"github.com/arena-duel/light-backend/internal/server"
	"github.com/arena-duel/light-backend/internal/store"
	"github.com/gin-gonic/gin"
)

func newTestServer() http.Handler {
	gin.SetMode(gin.TestMode)
	tokens := auth.NewTokenIssuer("test-secret", time.Hour)
	return server.NewRouter(store.NewMemoryStore(), tokens)
}

func doJSON(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

type creds struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Criterion 1: a new email can sign up; a duplicate email is rejected.
func TestSignupAndDuplicate(t *testing.T) {
	h := newTestServer()

	rec := doJSON(t, h, http.MethodPost, "/auth/signup", "", creds{"player@example.com", "passw0rd"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("signup: got %d, want 201; body=%s", rec.Code, rec.Body)
	}

	// Criterion 2 (response side): password/hash must not appear in the response.
	if bytes.Contains(rec.Body.Bytes(), []byte("passw0rd")) ||
		bytes.Contains(rec.Body.Bytes(), []byte("password_hash")) ||
		bytes.Contains(rec.Body.Bytes(), []byte("$2a$")) {
		t.Errorf("signup response leaked password material: %s", rec.Body)
	}

	dup := doJSON(t, h, http.MethodPost, "/auth/signup", "", creds{"player@example.com", "passw0rd"})
	if dup.Code != http.StatusConflict {
		t.Fatalf("duplicate signup: got %d, want 409", dup.Code)
	}
}

// Criterion 4: signup rejects malformed emails and weak passwords.
func TestSignupValidation(t *testing.T) {
	h := newTestServer()
	cases := []creds{
		{"not-an-email", "passw0rd"}, // bad email
		{"a@b.com", "short1"},        // too short
		{"a@b.com", "password"},      // no digit
		{"a@b.com", "12345678"},      // no letter
	}
	for _, c := range cases {
		rec := doJSON(t, h, http.MethodPost, "/auth/signup", "", c)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("signup(%+v): got %d, want 400", c, rec.Code)
		}
	}
}

// Criterion 3: login returns a bearer token; /me succeeds with it, 401 without.
func TestLoginAndMe(t *testing.T) {
	h := newTestServer()
	doJSON(t, h, http.MethodPost, "/auth/signup", "", creds{"me@example.com", "passw0rd"})

	// Wrong password -> 401.
	bad := doJSON(t, h, http.MethodPost, "/auth/login", "", creds{"me@example.com", "wrong1pw"})
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("login wrong password: got %d, want 401", bad.Code)
	}

	login := doJSON(t, h, http.MethodPost, "/auth/login", "", creds{"me@example.com", "passw0rd"})
	if login.Code != http.StatusOK {
		t.Fatalf("login: got %d, want 200; body=%s", login.Code, login.Body)
	}
	var lr struct {
		Token     string `json:"token"`
		TokenType string `json:"token_type"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &lr); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	if lr.Token == "" || lr.TokenType != "Bearer" {
		t.Fatalf("login response missing bearer token: %+v", lr)
	}

	// /me without token -> 401.
	noAuth := doJSON(t, h, http.MethodGet, "/me", "", nil)
	if noAuth.Code != http.StatusUnauthorized {
		t.Fatalf("/me no token: got %d, want 401", noAuth.Code)
	}

	// /me with an invalid token -> 401.
	badTok := doJSON(t, h, http.MethodGet, "/me", "garbage.token.value", nil)
	if badTok.Code != http.StatusUnauthorized {
		t.Fatalf("/me bad token: got %d, want 401", badTok.Code)
	}

	// /me with the valid token -> 200 and the right user.
	me := doJSON(t, h, http.MethodGet, "/me", lr.Token, nil)
	if me.Code != http.StatusOK {
		t.Fatalf("/me: got %d, want 200; body=%s", me.Code, me.Body)
	}
	var user struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(me.Body.Bytes(), &user); err != nil {
		t.Fatalf("decode /me: %v", err)
	}
	if user.Email != "me@example.com" {
		t.Errorf("/me email = %q, want me@example.com", user.Email)
	}
}

// Criterion 2 (storage side): the stored password is a bcrypt hash, not plaintext.
func TestStoredPasswordIsHashed(t *testing.T) {
	st := store.NewMemoryStore()
	gin.SetMode(gin.TestMode)
	tokens := auth.NewTokenIssuer("test-secret", time.Hour)
	h := server.NewRouter(st, tokens)

	doJSON(t, h, http.MethodPost, "/auth/signup", "", creds{"hash@example.com", "passw0rd"})

	u, err := st.FindByEmail(context.Background(), "hash@example.com")
	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	if u.PasswordHash == "" || u.PasswordHash == "passw0rd" {
		t.Fatalf("stored password is not hashed: %q", u.PasswordHash)
	}
	if !auth.CheckPassword(u.PasswordHash, "passw0rd") {
		t.Error("stored hash does not verify against the original password")
	}
}
