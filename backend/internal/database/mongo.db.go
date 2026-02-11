package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var DB *mongo.Database

// Connect เชื่อมต่อกับ MongoDB และตั้งค่าเริ่มต้น
func Connect(uri string, dbName string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// ตั้งค่าการเชื่อมต่อ
	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatal("❌ ไม่สามารถเชื่อมต่อ MongoDB ได้: ", err)
	}

	// ตรวจสอบการเชื่อมต่อ (Ping)
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("❌ MongoDB Ping failed: ", err)
	}

	Client = client
	DB = client.Database(dbName)
	log.Printf("✅ เชื่อมต่อฐานข้อมูล %s สำเร็จ", dbName)

	// สร้าง Index เพื่อประสิทธิภาพในการค้นหา
	createIndexes()
}

func createIndexes() {
	// สร้าง Index ให้กับฟิลด์ created_at ใน collection posts เพื่อให้เรียงลำดับเวลาได้รวดเร็ว
	coll := DB.Collection("posts")
	indexModel := mongo.IndexModel{
		Keys: bson.D{{Key: "created_at", Value: -1}},
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := coll.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Println("⚠️ ไม่สามารถสร้าง Index ได้ (อาจมีอยู่แล้ว): ", err)
	}
}

// GetCollection ฟังก์ชันช่วยดึง Collection ที่ต้องการใช้งาน
func GetCollection(name string) *mongo.Collection {
	return DB.Collection(name)
}