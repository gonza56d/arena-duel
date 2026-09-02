package handlers

import (
	"errors"
	"net/http"

	"github.com/arena-duel/light-backend/internal/models"
	"github.com/arena-duel/light-backend/internal/store"
	"github.com/arena-duel/light-backend/internal/validate"
	"github.com/gin-gonic/gin"
)

// profileResponse is the player-facing view of a User. Victories and
// GamesPlayed are included read-only; there is no request type that can bind
// them.
type profileResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	PlayerName  string `json:"player_name"`
	Color       string `json:"color"`
	Victories   int    `json:"victories"`
	GamesPlayed int    `json:"games_played"`
}

func toProfile(u *models.User) profileResponse {
	return profileResponse{
		ID:          u.ID.Hex(),
		Email:       u.Email,
		PlayerName:  u.PlayerName,
		Color:       u.Color,
		Victories:   u.Victories,
		GamesPlayed: u.GamesPlayed,
	}
}

// profileUpdateRequest holds the only fields a player may change. Any other
// key in the body (e.g. "victories") has nowhere to bind and is ignored.
type profileUpdateRequest struct {
	PlayerName *string `json:"player_name"`
	Color      *string `json:"color"`
}

// recordMatchRequest is the body of POST /profile/record: whether the player
// won the finished match. The count of games played always rises by one.
type recordMatchRequest struct {
	Won bool `json:"won"`
}

// GetProfile returns the authenticated player's profile.
func (h *Handler) GetProfile(c *gin.Context) {
	u, ok := UserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, toProfile(u))
}

// UpdateProfile changes the player name and/or color. Both are optional but at
// least one must be present; each is validated and normalized before storage.
func (h *Handler) UpdateProfile(c *gin.Context) {
	u, ok := UserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req profileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	var upd store.ProfileUpdate
	if req.PlayerName != nil {
		name, err := validate.PlayerName(*req.PlayerName)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		upd.PlayerName = &name
	}
	if req.Color != nil {
		color, err := validate.Color(*req.Color)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		upd.Color = &color
	}
	if upd.IsEmpty() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide player_name and/or color"})
		return
	}

	updated, err := h.Users.UpdateProfile(c.Request.Context(), u.ID.Hex(), upd)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update profile"})
		return
	}
	c.JSON(http.StatusOK, toProfile(updated))
}

// RecordMatch records a finished match for the authenticated player: it bumps
// games_played, and victories too when won is true. This is the client's only
// path to the record counters — the increment itself is server-owned, so a
// tampered client cannot inflate its own record beyond one game per call.
func (h *Handler) RecordMatch(c *gin.Context) {
	u, ok := UserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req recordMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.Users.IncrementRecord(c.Request.Context(), u.ID.Hex(), req.Won); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record match"})
		return
	}

	updated, err := h.Users.FindByID(c.Request.Context(), u.ID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})
		return
	}
	c.JSON(http.StatusOK, toProfile(updated))
}
