package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/internal/models"
	"backend/internal/repository"
	"github.com/google/generative-ai-go/genai"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AutomationService struct {
	postRepo   *repository.PostRepository
	configRepo *repository.ConfigRepository
	aiClient   *genai.Client
}

func NewAutomationService(p *repository.PostRepository, c *repository.ConfigRepository, ai *genai.Client) *AutomationService {
	return &AutomationService{postRepo: p, configRepo: c, aiClient: ai}
}

func (s *AutomationService) GenerateAndPost() {
	if s.aiClient == nil {
		log.Println("⚠️ AI Client not ready")
		return
	}

	ctx := context.Background()
	config, _ := s.configRepo.Get(ctx)
	if !config.IsEnabled {
		return
	}

	model := s.aiClient.GenerativeModel("gemini-1.5-flash")
	prompt := fmt.Sprintf("Topic: %s. Instruction: %s. Generate a premium short social media post in Thai.", config.Topic, config.BasePrompt)
	
	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		log.Println("❌ AI Generation Error:", err)
		return
	}

	content := fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])
	
	newPost := models.Post{
		ID:        primitive.NewObjectID(),
		User:      "Gemini AI Assistant",
		Content:   content,
		Image:     fmt.Sprintf("https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&topic=%s", config.Topic),
		Time:      "เมื่อสักครู่",
		CreatedAt: time.Now(),
	}

	s.postRepo.Create(ctx, newPost)
	log.Println("✨ AI Content Posted Successfully")
}

func initAI() {
    key := os.Getenv("GEMINI_API_KEY")
    if key == "" { return }

    ctx := context.Background()
    
    // ตัด option.WithEndpoint ออก เพื่อให้ SDK เลือก path ที่ถูกต้องเอง
    client, err := genai.NewClient(ctx, option.WithAPIKey(key))
    
    if err != nil {
        log.Printf("❌ สร้าง Gemini Client ล้มเหลว: %v", err)
        return
    }
    geminiClient = client
    log.Println("✅ Gemini AI พร้อมใช้งานแล้ว")
}