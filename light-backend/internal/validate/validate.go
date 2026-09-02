// Package validate holds input validation rules for signup and login.
package validate

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
)

const (
	minPasswordLen = 8
	maxPasswordLen = 128 // bcrypt only uses the first 72 bytes; cap defensively.
)

// ErrInvalidEmail is returned when an email fails format validation.
var ErrInvalidEmail = errors.New("invalid email address")

// ErrWeakPassword is returned when a password fails the strength rule.
var ErrWeakPassword = errors.New("password must be at least 8 characters and include a letter and a number")

// Email validates the address format and returns it normalized (trimmed,
// lowercased) for storage. A missing domain is rejected.
func Email(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", ErrInvalidEmail
	}
	// mail.ParseAddress accepts display names like "Bob <b@x.com>"; require the
	// input to be exactly the bare address.
	if addr.Address != trimmed {
		return "", ErrInvalidEmail
	}
	at := strings.LastIndex(addr.Address, "@")
	if at < 0 || !strings.Contains(addr.Address[at+1:], ".") {
		return "", ErrInvalidEmail
	}
	return strings.ToLower(addr.Address), nil
}

// Password enforces the basic strength rule: 8–128 chars, at least one letter
// and at least one digit.
func Password(pw string) error {
	if len(pw) < minPasswordLen || len(pw) > maxPasswordLen {
		return ErrWeakPassword
	}
	var hasLetter, hasDigit bool
	for _, r := range pw {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return ErrWeakPassword
	}
	return nil
}
