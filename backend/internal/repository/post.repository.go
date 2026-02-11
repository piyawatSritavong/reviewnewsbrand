package repository

import (
	"context"
	"backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type PostRepository struct {
	collection *mongo.Collection
}

func NewPostRepository(db *mongo.Database) *PostRepository {
	return &PostRepository{collection: db.Collection("posts")}
}

func (r *PostRepository) GetAll(ctx context.Context) ([]models.Post, error) {
	var posts []models.Post = make([]models.Post, 0)
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return posts, err
	}
	err = cursor.All(ctx, &posts)
	return posts, err
}

func (r *PostRepository) Create(ctx context.Context, post models.Post) error {
	_, err := r.collection.InsertOne(ctx, post)
	return err
}

func (r *PostRepository) Delete(ctx context.Context, id interface{}) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}