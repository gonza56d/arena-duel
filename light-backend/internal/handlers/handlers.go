// Package handlers implements the HTTP endpoints for accounts and auth.
package handlers

import (
	"errors"
	"net/http"

	"github.com/arena-duel/light-backend/internal/auth"
	"github.com/arena-duel/light-backend/internal/models"
	"github.com/arena-duel/light-backend/internal/store"
	"github.com/arena-duel/light-backend/internal/validate"
	"github.com/gin-gonic/gin"
)

// Handler carries the dependencies shared by all endpoints.
type Handler struct {
	Users  store.UserStore
	Tokens *auth.TokenIssuer
}

// New builds a Handler.
func New(users store.UserStore, tokens *auth.TokenIssuer) *Handler {
	return &Handler{Users: users, Tokens: tokens}
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Signup validates the payload, rejects duplicate emails, hashes the password
// with bcrypt and stores the user. It never echoes or logs the password/hash.
func (h *Handler) Signup(c *gin.Context) {
	var req credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	email, err := validate.Email(req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validate.Password(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not process password"})
		return
	}

	user := &models.User{Email: email, PasswordHash: hash}
	if err := h.Users.CreateUser(c.Request.Context(), user); err != nil {
		if errors.Is(err, store.ErrEmailTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	c.JSON(http.StatusCreated, user) // PasswordHash is json:"-", never serialized.
}

// Login verifies credentials and issues a bearer token. It returns the same
// 401 for unknown email and wrong password so accounts cannot be enumerated.
func (h *Handler) Login(c *gin.Context) {
	var req credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	email, err := validate.Email(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	user, err := h.Users.FindByEmail(c.Request.Context(), email)
	if err != nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.Tokens.Issue(user.ID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "token_type": "Bearer"})
}

// Me returns the authenticated user. The AuthRequired middleware has already
// resolved and stored the user in the context.
func (h *Handler) Me(c *gin.Context) {
	u, ok := UserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, u)
}
