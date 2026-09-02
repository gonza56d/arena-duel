package store

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/arena-duel/light-backend/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MemoryStore is an in-memory UserStore for tests. It is safe for concurrent
// use and mirrors the semantics of MongoStore (unique email, assigned id and
// timestamps).
type MemoryStore struct {
	mu      sync.RWMutex
	byID    map[string]*models.User
	byEmail map[string]string // email -> id
}

// NewMemoryStore returns an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		byID:    make(map[string]*models.User),
		byEmail: make(map[string]string),
	}
}

func (s *MemoryStore) CreateUser(ctx context.Context, u *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	email := strings.ToLower(u.Email)
	if _, exists := s.byEmail[email]; exists {
		return ErrEmailTaken
	}

	if u.ID.IsZero() {
		u.ID = primitive.NewObjectID()
	}
	now := time.Now().UTC()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now

	cp := *u
	s.byID[u.ID.Hex()] = &cp
	s.byEmail[email] = u.ID.Hex()
	return nil
}

func (s *MemoryStore) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, ok := s.byEmail[strings.ToLower(email)]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *s.byID[id]
	return &cp, nil
}

func (s *MemoryStore) FindByID(ctx context.Context, id string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u, ok := s.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *u
	return &cp, nil
}
