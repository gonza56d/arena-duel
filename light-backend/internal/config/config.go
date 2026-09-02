// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds all runtime configuration for the light backend.
type Config struct {
	Port      string
	MongoURI  string
	MongoDB   string
	JWTSecret string
	TokenTTL  time.Duration
}

// Load reads configuration from the environment, applying sensible defaults
// for local development. It returns an error only for values that have no safe
// default and must be provided explicitly (the JWT secret).
func Load() (Config, error) {
	cfg := Config{
		Port:      getEnv("PORT", "8080"),
		MongoURI:  getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:   getEnv("MONGO_DB", "arena_duel"),
		JWTSecret: os.Getenv("JWT_SECRET"),
		TokenTTL:  24 * time.Hour,
	}

	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
