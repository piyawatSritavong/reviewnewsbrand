package config

import (
	"os"
)

type Config struct {
	MongoURI     string
	DBName       string
	GeminiAPIKey string
	Port         string
}

func LoadConfig() *Config {
	return &Config{
		MongoURI:     getEnv("MONGODB_URI", "mongodb://db:27017"),
		DBName:       getEnv("DB_NAME", "kpgroup_db"),
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		Port:         getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}