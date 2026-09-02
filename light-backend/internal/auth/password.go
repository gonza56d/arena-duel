// Package auth handles password hashing and bearer-token issuance/verification.
package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword returns a salted bcrypt hash of the plaintext password. bcrypt
// generates and embeds a random salt per call, so identical passwords yield
// different hashes.
func HashPassword(plaintext string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// CheckPassword reports whether plaintext matches the stored bcrypt hash.
func CheckPassword(hash, plaintext string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)) == nil
}
