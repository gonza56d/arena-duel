// Package store defines the persistence boundary for users. Handlers depend on
// the UserStore interface, so they can be exercised against the in-memory fake
// in tests without a live MongoDB.
package store

import (
	"context"
	"errors"

	"github.com/arena-duel/light-backend/internal/models"
)

// ErrEmailTaken is returned by CreateUser when the email already exists.
var ErrEmailTaken = errors.New("email already registered")

// ErrNotFound is returned when a lookup matches no user.
var ErrNotFound = errors.New("user not found")

// ErrEmptyUpdate is returned by UpdateProfile when no field is set.
var ErrEmptyUpdate = errors.New("no profile fields to update")

// ProfileUpdate carries the player-editable profile fields. A nil pointer means
// "leave unchanged". Values are expected to be already validated/normalized.
// Victories and GamesPlayed are deliberately absent: they are server-owned and
// only change through IncrementRecord.
type ProfileUpdate struct {
	PlayerName *string
	Color      *string
}

// IsEmpty reports whether the update would change nothing.
func (p ProfileUpdate) IsEmpty() bool {
	return p.PlayerName == nil && p.Color == nil
}

// UserStore is the persistence contract for user accounts and profiles.
type UserStore interface {
	// CreateUser inserts a new user. It must return ErrEmailTaken if a user
	// with the same email already exists.
	CreateUser(ctx context.Context, u *models.User) error
	// FindByEmail returns the user with the given email, or ErrNotFound.
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	// FindByID returns the user with the given id, or ErrNotFound.
	FindByID(ctx context.Context, id string) (*models.User, error)
	// UpdateProfile sets only the provided profile fields (and updated_at) and
	// returns the updated user. It returns ErrEmptyUpdate when upd is empty and
	// ErrNotFound when the id matches no user.
	UpdateProfile(ctx context.Context, id string, upd ProfileUpdate) (*models.User, error)
	// IncrementRecord records a finished match: games_played += 1 and, when won
	// is true, victories += 1. This is the only way the record counters change.
	IncrementRecord(ctx context.Context, id string, won bool) error
	// SetConfiguredStats replaces the player's stat build in a single write and
	// returns the updated user. The build is expected to be already validated
	// (validate.ConfiguredStats). It returns ErrNotFound when the id matches no
	// user.
	SetConfiguredStats(ctx context.Context, id string, stats map[string]int) (*models.User, error)
}
