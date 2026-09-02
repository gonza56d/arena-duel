// Package models defines the persisted domain types.
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User is a registered account plus its player profile. PasswordHash holds a
// bcrypt hash and is never serialized to JSON (the `json:"-"` tag) so it cannot
// leak through an API response. Email is always stored lowercased so uniqueness
// is case-insensitive.
//
// Profile fields:
//   - PlayerName and Color are player-editable at any time via PATCH /profile.
//   - Victories and GamesPlayed are server-owned counters: they are read-only to
//     the client and are only changed through UserStore.IncrementRecord at
//     match end.
//   - ConfiguredStats is reserved for v2 (the player's stat build); it is never
//     written in v1 and is omitted from JSON while empty.
type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash" json:"-"`

	PlayerName      string         `bson:"player_name" json:"player_name"`
	Color           string         `bson:"color" json:"color"` // normalized "#rrggbb"
	Victories       int            `bson:"victories" json:"victories"`
	GamesPlayed     int            `bson:"games_played" json:"games_played"`
	ConfiguredStats map[string]int `bson:"configured_stats,omitempty" json:"configured_stats,omitempty"`

	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}
