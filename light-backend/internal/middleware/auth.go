// Package middleware holds Gin middleware, notably bearer-token authentication.
package middleware

import (
	"net/http"
	"strings"

	"github.com/arena-duel/light-backend/internal/auth"
	"github.com/arena-duel/light-backend/internal/handlers"
	"github.com/arena-duel/light-backend/internal/store"
	"github.com/gin-gonic/gin"
)

// AuthRequired validates the `Authorization: Bearer <token>` header, resolves
// the user, and stores it on the context. Any failure aborts with 401 so the
// protected handler never runs.
func AuthRequired(tokens *auth.TokenIssuer, users store.UserStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := bearerToken(c.GetHeader("Authorization"))
		if !ok {
			abort(c)
			return
		}

		userID, err := tokens.Parse(token)
		if err != nil {
			abort(c)
			return
		}

		user, err := users.FindByID(c.Request.Context(), userID)
		if err != nil {
			abort(c)
			return
		}

		handlers.SetUser(c, user)
		c.Next()
	}
}

// bearerToken extracts the token from an Authorization header value, requiring
// the "Bearer " scheme (case-insensitive) and a non-empty token.
func bearerToken(header string) (string, bool) {
	const prefix = "bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}

func abort(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
}
