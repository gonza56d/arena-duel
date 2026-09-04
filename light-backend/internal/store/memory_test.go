package store

import (
	"context"
	"errors"
	"testing"

	"github.com/arena-duel/light-backend/internal/models"
)

func seed(t *testing.T, s *MemoryStore) *models.User {
	t.Helper()
	u := &models.User{Email: "p@example.com", PasswordHash: "x", Color: "#ffffff"}
	if err := s.CreateUser(context.Background(), u); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return u
}

func strp(s string) *string { return &s }

func TestUpdateProfilePartial(t *testing.T) {
	s := NewMemoryStore()
	u := seed(t, s)
	ctx := context.Background()

	got, err := s.UpdateProfile(ctx, u.ID.Hex(), ProfileUpdate{PlayerName: strp("Zed")})
	if err != nil {
		t.Fatalf("update name: %v", err)
	}
	if got.PlayerName != "Zed" || got.Color != "#ffffff" {
		t.Fatalf("after name update: name=%q color=%q", got.PlayerName, got.Color)
	}

	got, err = s.UpdateProfile(ctx, u.ID.Hex(), ProfileUpdate{Color: strp("#e53935")})
	if err != nil {
		t.Fatalf("update color: %v", err)
	}
	if got.PlayerName != "Zed" || got.Color != "#e53935" {
		t.Fatalf("after color update: name=%q color=%q", got.PlayerName, got.Color)
	}

	// Persisted, not just returned.
	again, _ := s.FindByID(ctx, u.ID.Hex())
	if again.PlayerName != "Zed" || again.Color != "#e53935" {
		t.Fatalf("not persisted: %+v", again)
	}

	if _, err := s.UpdateProfile(ctx, u.ID.Hex(), ProfileUpdate{}); !errors.Is(err, ErrEmptyUpdate) {
		t.Errorf("empty update: got %v, want ErrEmptyUpdate", err)
	}
	if _, err := s.UpdateProfile(ctx, "missing", ProfileUpdate{PlayerName: strp("x")}); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing user: got %v, want ErrNotFound", err)
	}
}

func TestSetConfiguredStats(t *testing.T) {
	s := NewMemoryStore()
	u := seed(t, s)
	ctx := context.Background()

	// A fresh user has no build.
	if fresh, _ := s.FindByID(ctx, u.ID.Hex()); len(fresh.ConfiguredStats) != 0 {
		t.Fatalf("fresh user has a build: %v", fresh.ConfiguredStats)
	}

	build := map[string]int{"dash.cooldownMs": 2, "slash.damage": 3}
	got, err := s.SetConfiguredStats(ctx, u.ID.Hex(), build)
	if err != nil {
		t.Fatalf("set build: %v", err)
	}
	if got.ConfiguredStats["slash.damage"] != 3 {
		t.Fatalf("returned build = %v", got.ConfiguredStats)
	}

	// Persisted, and detached from the caller's map.
	build["slash.damage"] = 99
	again, _ := s.FindByID(ctx, u.ID.Hex())
	if again.ConfiguredStats["slash.damage"] != 3 || again.ConfiguredStats["dash.cooldownMs"] != 2 {
		t.Fatalf("not persisted (or shares caller's map): %v", again.ConfiguredStats)
	}

	// A later set replaces the whole build.
	if _, err := s.SetConfiguredStats(ctx, u.ID.Hex(), map[string]int{"shot.damage": 1}); err != nil {
		t.Fatal(err)
	}
	again, _ = s.FindByID(ctx, u.ID.Hex())
	if len(again.ConfiguredStats) != 1 || again.ConfiguredStats["shot.damage"] != 1 {
		t.Fatalf("set did not replace: %v", again.ConfiguredStats)
	}

	if _, err := s.SetConfiguredStats(ctx, "missing", build); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing user: got %v, want ErrNotFound", err)
	}
}

func TestIncrementRecord(t *testing.T) {
	s := NewMemoryStore()
	u := seed(t, s)
	ctx := context.Background()

	if err := s.IncrementRecord(ctx, u.ID.Hex(), true); err != nil {
		t.Fatal(err)
	}
	if err := s.IncrementRecord(ctx, u.ID.Hex(), false); err != nil {
		t.Fatal(err)
	}
	got, _ := s.FindByID(ctx, u.ID.Hex())
	if got.GamesPlayed != 2 || got.Victories != 1 {
		t.Fatalf("record = %d played / %d won, want 2 / 1", got.GamesPlayed, got.Victories)
	}
	if err := s.IncrementRecord(ctx, "missing", true); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing user: got %v, want ErrNotFound", err)
	}
}
