package auth

import (
	"strings"
	"testing"
	"time"
)

func TestHashPassword(t *testing.T) {
	const pw = "passw0rd"
	hash, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("HashPassword error: %v", err)
	}
	if hash == "" || strings.Contains(hash, pw) {
		t.Fatalf("hash must not be empty or contain the plaintext: %q", hash)
	}
	if !CheckPassword(hash, pw) {
		t.Error("CheckPassword should accept the correct password")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Error("CheckPassword should reject a wrong password")
	}

	// Salted: hashing the same password twice yields different hashes.
	hash2, _ := HashPassword(pw)
	if hash == hash2 {
		t.Error("expected different hashes for the same password (salt missing)")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	issuer := NewTokenIssuer("test-secret", time.Hour)
	tok, err := issuer.Issue("user-123")
	if err != nil {
		t.Fatalf("Issue error: %v", err)
	}
	sub, err := issuer.Parse(tok)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if sub != "user-123" {
		t.Errorf("subject = %q, want user-123", sub)
	}
}

func TestTokenRejects(t *testing.T) {
	issuer := NewTokenIssuer("test-secret", time.Hour)
	tok, _ := issuer.Issue("user-123")

	if _, err := issuer.Parse(tok + "tamper"); err == nil {
		t.Error("tampered token should fail")
	}
	// Wrong signing secret.
	other := NewTokenIssuer("other-secret", time.Hour)
	if _, err := other.Parse(tok); err == nil {
		t.Error("token signed with a different secret should fail")
	}
	// Expired token.
	expired := NewTokenIssuer("test-secret", -time.Minute)
	exp, _ := expired.Issue("user-123")
	if _, err := issuer.Parse(exp); err == nil {
		t.Error("expired token should fail")
	}
	if _, err := issuer.Parse(""); err == nil {
		t.Error("empty token should fail")
	}
}
