package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/internal/database"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/api/option"
)

var (
	scheduler    *cron.Cron
	geminiClient *genai.Client
)

var topicPool = []string{
	"Interior Design",
	"Minimal Decor",
	"Luxury Home",
	"Small Space Living",
	"Smart Home",
	"Sustainable Design",
	"Modern Kitchen",
	"Bedroom Makeover",
	"Living Room Styling",
	"Home Office Setup",
}

var basePromptPool = []string{
	"สร้างโพสต์สั้นๆ ให้ความรู้ + ทริคใช้งานได้จริง",
	"เขียนโพสต์แบบรีวิวก่อน-หลัง พร้อม bullet point",
	"สร้างโพสต์เชิง How-to เป็นขั้นตอน 1-5",
	"ทำโพสต์แนว FAQ 3 ข้อ + คำตอบสั้นๆ",
	"ทำโพสต์แนว checklist สำหรับคนเริ่มแต่งบ้าน",
	"เขียนโพสต์แนวเล่าเรื่อง (story) สั้นๆ แล้วสรุปข้อคิด",
	"ทำโพสต์แนวเปรียบเทียบ (A vs B) พร้อมข้อดีข้อเสีย",
	"สร้างโพสต์แนวแรงบันดาลใจ พร้อมคำแนะนำเชิงปฏิบัติ",
}

func pickRandomString(list []string) string {
	if len(list) == 0 {
		return ""
	}
	return list[rand.Intn(len(list))]
}

func getWordLimit() int {
	v := os.Getenv("GEMINI_WORD_LIMIT")
	if v == "" {
		return 1000
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 1000
	}
	if n != 200 && n != 500 && n != 1000 && n != 2000 {
		return 1000
	}
	return n
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("ℹ️ ไม่พบไฟล์ .env หรือไม่สามารถโหลดได้ จะใช้ค่าจาก System Environment แทน")
	}

	// Seed random for prompt selection
	rand.Seed(time.Now().UnixNano())

	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "kpgroup_db"
	}
	database.Connect(uri, dbName)

	initAI()

	scheduler = cron.New()
	scheduler.Start()
	seedAndSyncCron()

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS Setup
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api")
	{
		api.GET("/posts", getPosts)
		api.POST("/posts", createPost)
		api.PUT("/posts/:id", updatePost)
		api.DELETE("/posts/:id", deletePost)
		api.POST("/generate-content", handleGenerateContent)
		api.POST("/generate-image", handleGenerateImage)
		api.GET("/auto-config", getAutoConfig)
		api.POST("/auto-config", saveAutoConfig)
		api.POST("/generate-now", manualTriggerAI)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Server ready on port %s", port)
	_ = r.Run(":" + port)
}

// --- AI & Scheduler Logic ---
func initAI() {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		return
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(key))
	if err != nil {
		log.Printf("❌ สร้าง Gemini Client ล้มเหลว: %v", err)
		return
	}
	geminiClient = client
	log.Println("✅ Gemini AI พร้อมใช้งานแล้ว")
}

func syncScheduler(config models.AutoConfig) {
	for _, entry := range scheduler.Entries() {
		scheduler.Remove(entry.ID)
	}

	if !config.IsEnabled {
		return
	}

	for _, t := range config.ScheduledTimes {
		var hour, min int
		fmt.Sscanf(t, "%d:%d", &hour, &min)
		cronSpec := fmt.Sprintf("%d %d * * *", min, hour)

		scheduler.AddFunc(cronSpec, func() {
			generateAIContent()
		})
		log.Printf("⏰ AI Automation set for: %s", t)
	}
}

func seedAndSyncCron() {
	coll := database.GetCollection("auto_config")
	var config models.AutoConfig

	err := coll.FindOne(context.TODO(), bson.M{}).Decode(&config)
	if err == mongo.ErrNoDocuments {
		config = models.AutoConfig{
			IsEnabled:       false,
			FrequencyPerDay: 3,
			BasePrompt:      "สร้างเนื้อหาเกี่ยวกับการออกแบบภายในที่ทันสมัย",
			Topic:           "Interior Design",
		}
		_, _ = coll.InsertOne(context.TODO(), config)
		log.Println("🌱 สร้างค่าเริ่มต้นสำหรับระบบ Automation สำเร็จ")
	}

	syncScheduler(config)
}

type aiPostJSON struct {
	Content     string `json:"content"`
	ImagePrompt string `json:"image_prompt"`
}

// Gemini สร้าง “content” อย่างเดียว
func generateContentOnly(topic, basePrompt string, wordLimit int) (string, error) {
	if geminiClient == nil {
		return "", fmt.Errorf("gemini client is nil")
	}

	textModelName := os.Getenv("GEMINI_MODEL")
	if textModelName == "" {
		textModelName = "gemini-2.5-flash"
	}

	// ถ้า topic ว่าง ให้ใช้ basePrompt เป็นพรอมป์หลัก
	prompt := ""
	if strings.TrimSpace(topic) != "" {
		prompt = fmt.Sprintf(
			"คุณคือผู้เชี่ยวชาญด้าน %s\n"+
				"คำสั่ง: %s\n\n"+
				"ข้อกำหนดสำคัญ:\n"+
				"- เขียนผลลัพธ์ไม่เกิน %d คำ\n"+
				"- จัดรูปแบบให้อ่านง่าย เว้นบรรทัด ใช้หัวข้อ/รายการได้\n"+
				"- ห้ามตอบเป็น JSON\n\n"+
				"เริ่มเขียนได้เลย",
			topic,
			basePrompt,
			wordLimit,
		)
	} else {
		prompt = fmt.Sprintf(
			"%s\n\nข้อกำหนดสำคัญ:\n- เขียนผลลัพธ์ไม่เกิน %d คำ\n- จัดรูปแบบให้อ่านง่าย เว้นบรรทัด ใช้หัวข้อ/รายการได้\n- ห้ามตอบเป็น JSON\n\nเริ่มเขียนได้เลย",
			basePrompt,
			wordLimit,
		)
	}

	textModel := geminiClient.GenerativeModel(textModelName)
	// ให้ตอบเป็นข้อความปกติ
	textModel.ResponseMIMEType = "text/plain"

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	resp, err := textModel.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}
	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty text candidates")
	}

	content := strings.TrimSpace(fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0]))
	if content == "" {
		return "", fmt.Errorf("empty content")
	}
	return content, nil
}

// Gemini/Imagen สร้าง “image” อย่างเดียว แล้วคืนค่าเป็น data URL (base64)
func generateImageOnly(imagePrompt string) (string, error) {
	if geminiClient == nil {
		return "", fmt.Errorf("gemini client is nil")
	}
	prompt := strings.TrimSpace(imagePrompt)
	if prompt == "" {
		return "", fmt.Errorf("image prompt is empty")
	}

	imageModelName := os.Getenv("GEMINI_IMAGE_MODEL")
	if imageModelName == "" {
		imageModelName = "imagen-3.0-generate-002"
	}

	imageModel := geminiClient.GenerativeModel(imageModelName)
	// ช่วยบังคับให้คืนเป็นรูป
	imageModel.ResponseMIMEType = "image/png"

	imgCtx, imgCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer imgCancel()

	imgResp, err := imageModel.GenerateContent(imgCtx, genai.Text(prompt))
	if err != nil {
		return "", err
	}

	var blob *genai.Blob
	if len(imgResp.Candidates) > 0 && imgResp.Candidates[0].Content != nil {
		for _, part := range imgResp.Candidates[0].Content.Parts {
			switch v := part.(type) {
			case genai.Blob:
				vv := v
				blob = &vv
			case *genai.Blob:
				blob = v
			}
			if blob != nil {
				break
			}
		}
	}

	if blob == nil || len(blob.Data) == 0 {
		return "", fmt.Errorf("no image blob returned")
	}

	mime := blob.MIMEType
	if mime == "" {
		mime = "image/png"
	}
	b64 := base64.StdEncoding.EncodeToString(blob.Data)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mime, b64)
	return dataURL, nil
}

func generateAIContent() {
	if geminiClient == nil {
		log.Println("❌ AI Error: Gemini Client ยังไม่ได้รับการติดตั้ง")
		return
	}

	collConfig := database.GetCollection("auto_config")
	var config models.AutoConfig
	_ = collConfig.FindOne(context.TODO(), bson.M{}).Decode(&config)

	// สุ่ม Topic + BasePrompt ใหม่ทุกครั้ง
	topic := pickRandomString(topicPool)
	if topic == "" {
		topic = config.Topic
	}
	basePrompt := pickRandomString(basePromptPool)
	if basePrompt == "" {
		basePrompt = config.BasePrompt
	}

	wordLimit := getWordLimit()

	log.Println("🤖 AI: กำลังสร้างเนื้อหา+รูป สำหรับหัวข้อ ", topic)

	content, err := generateContentOnly(topic, basePrompt, wordLimit)
	if err != nil {
		log.Println("❌ AI Content Generation Error: ", err)
		return
	}

	// สร้างรูปแยก channel
	imgPrompt := fmt.Sprintf("Realistic interior design photo, 16:9, high quality, suitable for social post. Topic: %s. Style: %s", topic, basePrompt)
	imageDataURL, imgErr := generateImageOnly(imgPrompt)
	if imgErr != nil {
		log.Println("⚠️ AI Image Generation Error: ", imgErr)
	}

	img := imageDataURL
	if strings.TrimSpace(img) == "" {
		img = fmt.Sprintf("https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80&topic=%s", topic)
	}

	newPost := models.Post{
		ID:        primitive.NewObjectID(),
		User:      "Gemini AI Architect",
		Content:   content,
		Image:     img,
		Time:      "เมื่อสักครู่",
		CreatedAt: time.Now(),
	}

	_, _ = database.GetCollection("posts").InsertOne(context.TODO(), newPost)
	log.Println("✅ AI บันทึกโพสต์ใหม่สำเร็จ")
}

func handleGenerateContent(c *gin.Context) {
	if geminiClient == nil {
		c.JSON(500, gin.H{"error": "AI Client is not initialized"})
		return
	}

	var req struct {
		Topic     string `json:"topic"`
		BasePrompt string `json:"basePrompt"`
		WordLimit int    `json:"wordLimit"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}

	topic := strings.TrimSpace(req.Topic)
	basePrompt := strings.TrimSpace(req.BasePrompt)
	wl := req.WordLimit
	if wl == 0 {
		wl = getWordLimit()
	}

	// ถ้าไม่ได้ส่ง topic/basePrompt มาเลย ให้รองรับโครงเดิมด้วย (fallback)
	if topic == "" && basePrompt == "" {
		c.JSON(400, gin.H{"error": "topic/basePrompt is required"})
		return
	}

	content, err := generateContentOnly(topic, basePrompt, wl)
	if err != nil {
		log.Printf("❌ Gemini Content Error: %v", err)
		c.JSON(500, gin.H{"error": "Gemini failed: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"result": content})
}

func handleGenerateImage(c *gin.Context) {
	if geminiClient == nil {
		c.JSON(500, gin.H{"error": "AI Client is not initialized"})
		return
	}

	var req struct {
		Prompt string `json:"prompt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}

	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		c.JSON(400, gin.H{"error": "prompt is required"})
		return
	}

	imageDataURL, err := generateImageOnly(prompt)
	if err != nil {
		log.Printf("❌ Gemini Image Error: %v", err)
		c.JSON(500, gin.H{"error": "Gemini image failed: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"image": imageDataURL})
}

// --- Handlers (GET, POST, PUT, DELETE) ---
func getPosts(c *gin.Context) {
	posts := make([]models.Post, 0)
	coll := database.GetCollection("posts")
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, _ := coll.Find(context.TODO(), bson.M{}, opts)
	_ = cursor.All(context.TODO(), &posts)
	c.JSON(200, posts)
}

func createPost(c *gin.Context) {
	var post models.Post
	if err := c.ShouldBindJSON(&post); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	post.ID = primitive.NewObjectID()
	post.CreatedAt = time.Now()
	_, _ = database.GetCollection("posts").InsertOne(context.TODO(), post)
	c.JSON(201, post)
}

func updatePost(c *gin.Context) {
	id, _ := primitive.ObjectIDFromHex(c.Param("id"))
	var data bson.M
	if err := c.BindJSON(&data); err != nil {
		c.JSON(400, gin.H{"error": "Invalid JSON"})
		return
	}
	_, _ = database.GetCollection("posts").UpdateOne(context.TODO(), bson.M{"_id": id}, bson.M{"$set": data})
	c.JSON(200, gin.H{"status": "updated"})
}

func deletePost(c *gin.Context) {
	id, _ := primitive.ObjectIDFromHex(c.Param("id"))
	_, _ = database.GetCollection("posts").DeleteOne(context.TODO(), bson.M{"_id": id})
	c.JSON(200, gin.H{"status": "deleted"})
}

func getAutoConfig(c *gin.Context) {
	var config models.AutoConfig
	_ = database.GetCollection("auto_config").FindOne(context.TODO(), bson.M{}).Decode(&config)
	c.JSON(200, config)
}

func saveAutoConfig(c *gin.Context) {
	var config models.AutoConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	_, _ = database.GetCollection("auto_config").UpdateOne(
		context.TODO(),
		bson.M{},
		bson.M{"$set": config},
		options.Update().SetUpsert(true),
	)
	syncScheduler(config)
	c.JSON(200, config)
}

func manualTriggerAI(c *gin.Context) {
	go generateAIContent()
	c.JSON(200, gin.H{"message": "AI Task Started"})
}