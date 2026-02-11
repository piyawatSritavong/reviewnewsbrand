package handlers

import (
	"net/http"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type APIHandler struct {
	postRepo    *repository.PostRepository
	configRepo  *repository.ConfigRepository
	autoService *service.AutomationService
}

func NewAPIHandler(p *repository.PostRepository, c *repository.ConfigRepository, s *service.AutomationService) *APIHandler {
	return &APIHandler{postRepo: p, configRepo: c, autoService: s}
}

func (h *APIHandler) GetPosts(c *gin.Context) {
	posts, _ := h.postRepo.GetAll(c.Request.Context())
	c.JSON(http.StatusOK, posts)
}

func (h *APIHandler) GetConfig(c *gin.Context) {
	config, _ := h.configRepo.Get(c.Request.Context())
	c.JSON(http.StatusOK, config)
}

func (h *APIHandler) SaveConfig(c *gin.Context) {
	var config models.AutoConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.configRepo.Update(c.Request.Context(), config)
	c.JSON(http.StatusOK, config)
}

func (h *APIHandler) ManualTrigger(c *gin.Context) {
	go h.autoService.GenerateAndPost()
	c.JSON(http.StatusOK, gin.H{"message": "AI Task Started"})
}

func (h *APIHandler) DeletePost(c *gin.Context) {
	id, _ := primitive.ObjectIDFromHex(c.Param("id"))
	h.postRepo.Delete(c.Request.Context(), id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}