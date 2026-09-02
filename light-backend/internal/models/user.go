// Package models defines the persisted domain types.
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User is a registered account. PasswordHash holds a bcrypt hash and is never
// serialized to JSON (the `json:"-"` tag) so it cannot leak through an API
// response. Email is always stored lowercased so uniqueness is case-insensitive.
type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash" json:"-"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}
