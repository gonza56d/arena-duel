package handlers

import (
	"errors"
	"net/http"

	"github.com/arena-duel/light-backend/internal/store"
	"github.com/arena-duel/light-backend/internal/validate"
	"github.com/gin-gonic/gin"
)

// buildUpdateRequest is the body of PUT /profile/build: the complete stat
// build to store, as stat id ("skill.stat") → 1-based level. There is no
// partial update — the build is small and the client always knows all of it.
type buildUpdateRequest struct {
	ConfiguredStats map[string]int `json:"configured_stats"`
}

// SetBuild validates and stores the authenticated player's stat build. An
// invalid build is rejected as a whole — nothing is persisted — with every
// rule violation listed in `details` so the builder UI can show them all.
func (h *Handler) SetBuild(c *gin.Context) {
	u, ok := UserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req buildUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.ConfiguredStats == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide configured_stats"})
		return
	}
	if details := validate.ConfiguredStats(req.ConfiguredStats); len(details) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stat build", "details": details})
		return
	}

	updated, err := h.Users.SetConfiguredStats(c.Request.Context(), u.ID.Hex(), req.ConfiguredStats)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save stat build"})
		return
	}
	c.JSON(http.StatusOK, toProfile(updated))
}
