// Package server wires the routes, handlers and middleware into a Gin engine.
package server

import (
	"net/http"

	"github.com/arena-duel/light-backend/internal/auth"
	"github.com/arena-duel/light-backend/internal/handlers"
	"github.com/arena-duel/light-backend/internal/middleware"
	"github.com/arena-duel/light-backend/internal/store"
	"github.com/gin-gonic/gin"
)

// NewRouter builds the HTTP router with public and protected routes.
func NewRouter(users store.UserStore, tokens *auth.TokenIssuer) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	h := handlers.New(users, tokens)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/signup", h.Signup)
		authGroup.POST("/login", h.Login)
	}

	protected := r.Group("/")
	protected.Use(middleware.AuthRequired(tokens, users))
	{
		protected.GET("/me", h.Me)
		protected.GET("/profile", h.GetProfile)
		protected.PATCH("/profile", h.UpdateProfile)
		protected.POST("/profile/record", h.RecordMatch)
	}

	return r
}
