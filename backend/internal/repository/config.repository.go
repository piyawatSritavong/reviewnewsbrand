package repository

import (
	"context"
	"backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ConfigRepository struct {
	collection *mongo.Collection
}

func NewConfigRepository(db *mongo.Database) *ConfigRepository {
	return &ConfigRepository{collection: db.Collection("auto_config")}
}

func (r *ConfigRepository) Get(ctx context.Context) (models.AutoConfig, error) {
	var config models.AutoConfig
	err := r.collection.FindOne(ctx, bson.M{}).Decode(&config)
	return config, err
}

func (r *ConfigRepository) Update(ctx context.Context, config models.AutoConfig) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{}, bson.M{"$set": config}, options.Update().SetUpsert(true))
	return err
}