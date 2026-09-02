package handlers

import (
	"github.com/arena-duel/light-backend/internal/models"
	"github.com/gin-gonic/gin"
)

// contextUserKey is the gin.Context key under which the authenticated user is
// stored by the AuthRequired middleware.
const contextUserKey = "authUser"

// SetUser stores the authenticated user on the request context.
func SetUser(c *gin.Context, u *models.User) {
	c.Set(contextUserKey, u)
}

// UserFromContext retrieves the authenticated user set by the middleware.
func UserFromContext(c *gin.Context) (*models.User, bool) {
	v, ok := c.Get(contextUserKey)
	if !ok {
		return nil, false
	}
	u, ok := v.(*models.User)
	return u, ok
}
