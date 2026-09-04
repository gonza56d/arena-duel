package store

import (
	"context"
	"errors"
	"time"

	"github.com/arena-duel/light-backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// primitiveObjectID parses a hex string into an ObjectID.
func primitiveObjectID(id string) (primitive.ObjectID, error) {
	return primitive.ObjectIDFromHex(id)
}

// MongoStore is the MongoDB-backed UserStore.
type MongoStore struct {
	client *mongo.Client
	users  *mongo.Collection
}

// Connect dials MongoDB, verifies the connection with a ping, and ensures the
// unique index on email exists. The returned MongoStore's Close must be called
// on shutdown.
func Connect(ctx context.Context, uri, dbName string) (*MongoStore, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, err
	}

	s := &MongoStore{
		client: client,
		users:  client.Database(dbName).Collection("users"),
	}
	if err := s.ensureIndexes(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

// ensureIndexes creates a unique index on email so duplicate registrations are
// rejected at the database level, not just by an application check.
func (s *MongoStore) ensureIndexes(ctx context.Context) error {
	_, err := s.users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	return err
}

// Close disconnects the underlying client.
func (s *MongoStore) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}

// CreateUser inserts a new user, translating a duplicate-key error into
// ErrEmailTaken. The ObjectID and timestamps are assigned here when unset so
// the passed-in struct reflects what was persisted.
func (s *MongoStore) CreateUser(ctx context.Context, u *models.User) error {
	if u.ID.IsZero() {
		u.ID = primitive.NewObjectID()
	}
	now := time.Now().UTC()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now

	if _, err := s.users.InsertOne(ctx, u); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ErrEmailTaken
		}
		return err
	}
	return nil
}

// FindByEmail returns the user with the given email or ErrNotFound.
func (s *MongoStore) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{"email": email}).Decode(&u)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// FindByID returns the user with the given hex object id or ErrNotFound.
func (s *MongoStore) FindByID(ctx context.Context, id string) (*models.User, error) {
	oid, err := primitiveObjectID(id)
	if err != nil {
		return nil, ErrNotFound
	}
	var u models.User
	err = s.users.FindOne(ctx, bson.M{"_id": oid}).Decode(&u)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// UpdateProfile applies a partial $set of the player-editable fields and returns
// the document as it is after the update. Counters are never touched here.
func (s *MongoStore) UpdateProfile(ctx context.Context, id string, upd ProfileUpdate) (*models.User, error) {
	if upd.IsEmpty() {
		return nil, ErrEmptyUpdate
	}
	oid, err := primitiveObjectID(id)
	if err != nil {
		return nil, ErrNotFound
	}

	set := bson.M{"updated_at": time.Now().UTC()}
	if upd.PlayerName != nil {
		set["player_name"] = *upd.PlayerName
	}
	if upd.Color != nil {
		set["color"] = *upd.Color
	}

	var u models.User
	err = s.users.FindOneAndUpdate(ctx,
		bson.M{"_id": oid},
		bson.M{"$set": set},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&u)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// SetConfiguredStats replaces the stat build with one atomic $set and returns
// the document as it is after the update.
func (s *MongoStore) SetConfiguredStats(ctx context.Context, id string, stats map[string]int) (*models.User, error) {
	oid, err := primitiveObjectID(id)
	if err != nil {
		return nil, ErrNotFound
	}

	var u models.User
	err = s.users.FindOneAndUpdate(ctx,
		bson.M{"_id": oid},
		bson.M{"$set": bson.M{"configured_stats": stats, "updated_at": time.Now().UTC()}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&u)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// IncrementRecord atomically bumps games_played (and victories when won).
func (s *MongoStore) IncrementRecord(ctx context.Context, id string, won bool) error {
	oid, err := primitiveObjectID(id)
	if err != nil {
		return ErrNotFound
	}

	inc := bson.M{"games_played": 1}
	if won {
		inc["victories"] = 1
	}
	res, err := s.users.UpdateOne(ctx,
		bson.M{"_id": oid},
		bson.M{"$inc": inc, "$set": bson.M{"updated_at": time.Now().UTC()}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}
