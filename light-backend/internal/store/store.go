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

// UserStore is the persistence contract for user accounts.
type UserStore interface {
	// CreateUser inserts a new user. It must return ErrEmailTaken if a user
	// with the same email already exists.
	CreateUser(ctx context.Context, u *models.User) error
	// FindByEmail returns the user with the given email, or ErrNotFound.
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	// FindByID returns the user with the given id, or ErrNotFound.
	FindByID(ctx context.Context, id string) (*models.User, error)
}
