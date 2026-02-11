package models

import (
	"time"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Post โครงสร้างข้อมูลสำหรับโพสต์เนื้อหา
type Post struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	User      string             `bson:"user" json:"user"`
	Content   string             `bson:"content" json:"content"`
	Image     string             `bson:"image" json:"image"`
	Time      string             `bson:"time" json:"time"`
	Likes     string             `bson:"likes" json:"likes"`
	Comments  string             `bson:"comments" json:"comments"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

// AutoConfig โครงสร้างการตั้งค่าระบบ AI Automation
type AutoConfig struct {
    IsEnabled       bool     `json:"isEnabled" bson:"is_enabled"`
    FrequencyPerDay int      `json:"frequencyPerDay" bson:"frequency_per_day"`
    Topic           string   `json:"topic" bson:"topic"`
    BasePrompt      string   `json:"basePrompt" bson:"base_prompt"`
    Model           string   `json:"model" bson:"model"`
    ScheduledTimes  []string `json:"scheduledTimes" bson:"scheduled_times"` // เพิ่มบรรทัดนี้
}