// Command server is the entrypoint for the Arena Duel light backend, which
// serves low-intensity requests: account signup, login and profile.
package main

import (
	"context"
	"log"
	"time"

	"github.com/arena-duel/light-backend/internal/auth"
	"github.com/arena-duel/light-backend/internal/config"
	"github.com/arena-duel/light-backend/internal/server"
	"github.com/arena-duel/light-backend/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := store.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("mongo: %v", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = db.Close(shutdownCtx)
	}()

	tokens := auth.NewTokenIssuer(cfg.JWTSecret, cfg.TokenTTL)
	r := server.NewRouter(db, tokens)

	log.Printf("light backend listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
