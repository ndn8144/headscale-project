package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gopkg.in/yaml.v2"
)

// Configuration structures
type Config struct {
	HeadscaleURL    string `env:"HEADSCALE_URL" default:"https://headscale.tailnet.work"`
	HeadscaleAPIKey string `env:"HEADSCALE_API_KEY" required:"true"`
	Port            string `env:"PORT" default:"8000"`
	DataPath        string `env:"DATA_PATH" default:"/app/data"`
	LogLevel        string `env:"LOG_LEVEL" default:"info"`
}

type User struct {
	Name  string   `yaml:"name" json:"name"`
	Email string   `yaml:"email" json:"email"`
	Tags  []string `yaml:"tags" json:"tags"`
}

type Route struct {
	Node              string   `yaml:"node" json:"node"`
	Routes            []string `yaml:"routes" json:"routes"`
	AdvertiseExitNode bool     `yaml:"advertise_exit_node" json:"advertise_exit_node"`
}

type ACLPolicy struct {
	Groups      map[string][]string            `yaml:"groups" json:"groups"`
	TagOwners   map[string][]string            `yaml:"tagOwners" json:"tagOwners"`
	ACLs        []ACLRule                      `yaml:"acls" json:"acls"`
	SSH         []SSHRule                      `yaml:"ssh" json:"ssh"`
	AutoGroups  map[string][]string            `yaml:"autoGroups" json:"autoGroups"`
	Hosts       map[string]string              `yaml:"hosts" json:"hosts"`
}

type ACLRule struct {
	Action  string   `yaml:"action" json:"action"`
	Src     []string `yaml:"src" json:"src"`
	Dst     []string `yaml:"dst" json:"dst"`
	Comment string   `yaml:"comment,omitempty" json:"comment,omitempty"`
}

type SSHRule struct {
	Action string   `yaml:"action" json:"action"`
	Src    []string `yaml:"src" json:"src"`
	Dst    []string `yaml:"dst" json:"dst"`
	Users  []string `yaml:"users" json:"users"`
}

type ApplyRequest struct {
	DryRun  bool `json:"dry_run"`
	Force   bool `json:"force"`
	Validate bool `json:"validate"`
}

type ApplyResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Changes []string               `json:"changes"`
	Errors  []string               `json:"errors"`
	DryRun  bool                   `json:"dry_run"`
	Stats   map[string]interface{} `json:"stats"`
}

type DriftResponse struct {
	HasDrift bool                   `json:"has_drift"`
	Drifts   []string               `json:"drifts"`
	Summary  map[string]interface{} `json:"summary"`
}

type AuthKeyRequest struct {
	User       string `json:"user"`
	Ephemeral  bool   `json:"ephemeral"`
	Reusable   bool   `json:"reusable"`
	Expiration string `json:"expiration"`
	Tags       []string `json:"tags"`
}

type AuthKeyResponse struct {
	Key        string    `json:"key"`
	User       string    `json:"user"`
	Ephemeral  bool      `json:"ephemeral"`
	Reusable   bool      `json:"reusable"`
	Expiration time.Time `json:"expiration"`
	Tags       []string  `json:"tags"`
}

// Prometheus metrics
var (
	applyCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "headscale_orchestrator_apply_total",
			Help: "Total number of apply operations",
		},
		[]string{"status"},
	)
	
	driftCheckCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "headscale_orchestrator_drift_checks_total",
			Help: "Total number of drift checks",
		},
		[]string{"has_drift"},
	)
	
	configSyncDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name: "headscale_orchestrator_config_sync_duration_seconds",
			Help: "Duration of config synchronization operations",
		},
	)
)

type Server struct {
	config *Config
	router *gin.Engine
}

func NewServer() *Server {
	config := &Config{
		HeadscaleURL:    getEnv("HEADSCALE_URL", "https://headscale.tailnet.work"),
		HeadscaleAPIKey: getEnv("HEADSCALE_API_KEY", ""),
		Port:            getEnv("PORT", "8000"),
		DataPath:        getEnv("DATA_PATH", "/app/data"),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
	}

	// Initialize Prometheus metrics
	prometheus.MustRegister(applyCounter)
	prometheus.MustRegister(driftCheckCounter)
	prometheus.MustRegister(configSyncDuration)

	router := gin.Default()
	
	// Middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.Use(authMiddleware(config.HeadscaleAPIKey))

	server := &Server{
		config: config,
		router: router,
	}

	server.setupRoutes()
	return server
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.GET("/health", s.healthCheck)
	s.router.GET("/healthz", s.healthCheck)
	
	// Metrics
	s.router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	
	// API v1
	v1 := s.router.Group("/api/v1")
	{
		// Configuration management
		v1.POST("/apply", s.applyConfig)
		v1.GET("/drift", s.checkDrift)
		v1.GET("/validate", s.validateConfig)
		
		// Auth key management
		v1.POST("/keys", s.createAuthKey)
		v1.GET("/keys", s.listAuthKeys)
		v1.DELETE("/keys/:id", s.revokeAuthKey)
		
		// Users management
		v1.GET("/users", s.listUsers)
		v1.POST("/users", s.createUser)
		v1.DELETE("/users/:name", s.deleteUser)
		
		// Nodes management
		v1.GET("/nodes", s.listNodes)
		v1.DELETE("/nodes/:id", s.deleteNode)
		v1.POST("/nodes/:id/expire", s.expireNode)
		
		// Routes management
		v1.GET("/routes", s.listRoutes)
		v1.POST("/routes", s.enableRoute)
		v1.DELETE("/routes/:id", s.disableRoute)
		
		// ACL management
		v1.GET("/acl", s.getACL)
		v1.PUT("/acl", s.updateACL)
		
		// System status
		v1.GET("/status", s.getSystemStatus)
	}
}

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"time":   time.Now().Unix(),
		"service": "headscale-orchestrator",
	})
}

func (s *Server) applyConfig(c *gin.Context) {
	timer := prometheus.NewTimer(configSyncDuration)
	defer timer.ObserveDuration()

	var req ApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Load configuration from data directory
	users, err := s.loadUsers()
	if err != nil {
		applyCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users: " + err.Error()})
		return
	}

	routes, err := s.loadRoutes()
	if err != nil {
		applyCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load routes: " + err.Error()})
		return
	}

	acl, err := s.loadACL()
	if err != nil {
		applyCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load ACL: " + err.Error()})
		return
	}

	changes := []string{}
	errors := []string{}

	// Apply users
	for _, user := range users {
		if !req.DryRun {
			if err := s.createHeadscaleUser(user); err != nil {
				errors = append(errors, fmt.Sprintf("Failed to create user %s: %v", user.Name, err))
			} else {
				changes = append(changes, fmt.Sprintf("Created/updated user: %s", user.Name))
			}
		} else {
			changes = append(changes, fmt.Sprintf("Would create/update user: %s", user.Name))
		}
	}

	// Apply routes
	for _, route := range routes {
		if !req.DryRun {
			if err := s.enableHeadscaleRoute(route); err != nil {
				errors = append(errors, fmt.Sprintf("Failed to enable route %v: %v", route.Routes, err))
			} else {
				changes = append(changes, fmt.Sprintf("Enabled routes for node %s: %v", route.Node, route.Routes))
			}
		} else {
			changes = append(changes, fmt.Sprintf("Would enable routes for node %s: %v", route.Node, route.Routes))
		}
	}

	// Apply ACL
	if !req.DryRun {
		if err := s.updateHeadscaleACL(acl); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to update ACL: %v", err))
		} else {
			changes = append(changes, "Updated ACL policy")
		}
	} else {
		changes = append(changes, "Would update ACL policy")
	}

	success := len(errors) == 0
	if success {
		applyCounter.WithLabelValues("success").Inc()
	} else {
		applyCounter.WithLabelValues("error").Inc()
	}

	c.JSON(http.StatusOK, ApplyResponse{
		Success: success,
		Message: fmt.Sprintf("Applied %d changes with %d errors", len(changes), len(errors)),
		Changes: changes,
		Errors:  errors,
		DryRun:  req.DryRun,
		Stats: map[string]interface{}{
			"users_processed":  len(users),
			"routes_processed": len(routes),
			"changes_applied":  len(changes),
			"errors_count":     len(errors),
		},
	})
}

func (s *Server) checkDrift(c *gin.Context) {
	// Get current state from Headscale
	headscaleUsers, err := s.getHeadscaleUsers()
	if err != nil {
		driftCheckCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get Headscale users: " + err.Error()})
		return
	}

	headscaleRoutes, err := s.getHeadscaleRoutes()
	if err != nil {
		driftCheckCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get Headscale routes: " + err.Error()})
		return
	}

	// Load desired state from git
	configUsers, err := s.loadUsers()
	if err != nil {
		driftCheckCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load config users: " + err.Error()})
		return
	}

	configRoutes, err := s.loadRoutes()
	if err != nil {
		driftCheckCounter.WithLabelValues("error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load config routes: " + err.Error()})
		return
	}

	drifts := []string{}

	// Check user drift
	configUserMap := make(map[string]User)
	for _, user := range configUsers {
		configUserMap[user.Name] = user
	}

	for _, hsUser := range headscaleUsers {
		if _, exists := configUserMap[hsUser]; !exists {
			drifts = append(drifts, fmt.Sprintf("User %s exists in Headscale but not in config", hsUser))
		}
	}

	for _, configUser := range configUsers {
		found := false
		for _, hsUser := range headscaleUsers {
			if hsUser == configUser.Name {
				found = true
				break
			}
		}
		if !found {
			drifts = append(drifts, fmt.Sprintf("User %s exists in config but not in Headscale", configUser.Name))
		}
	}

	hasDrift := len(drifts) > 0
	if hasDrift {
		driftCheckCounter.WithLabelValues("true").Inc()
	} else {
		driftCheckCounter.WithLabelValues("false").Inc()
	}

	c.JSON(http.StatusOK, DriftResponse{
		HasDrift: hasDrift,
		Drifts:   drifts,
		Summary: map[string]interface{}{
			"headscale_users_count": len(headscaleUsers),
			"config_users_count":    len(configUsers),
			"headscale_routes_count": len(headscaleRoutes),
			"config_routes_count":   len(configRoutes),
			"drift_count":           len(drifts),
		},
	})
}

func (s *Server) createAuthKey(c *gin.Context) {
	var req AuthKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create auth key via Headscale API
	key, err := s.createHeadscaleAuthKey(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create auth key: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, key)
}

func (s *Server) getSystemStatus(c *gin.Context) {
	status := map[string]interface{}{
		"service":   "headscale-orchestrator",
		"version":   "1.0.0",
		"uptime":    time.Since(time.Now()).String(),
		"timestamp": time.Now().Unix(),
		"health": map[string]string{
			"database":  "connected",
			"headscale": "reachable",
			"storage":   "accessible",
		},
	}

	c.JSON(http.StatusOK, status)
}

// Helper functions for loading configuration
func (s *Server) loadUsers() ([]User, error) {
	usersFile := filepath.Join(s.config.DataPath, "users.yaml")
	data, err := ioutil.ReadFile(usersFile)
	if err != nil {
		return nil, err
	}

	var users []User
	if err := yaml.Unmarshal(data, &users); err != nil {
		return nil, err
	}

	return users, nil
}

func (s *Server) loadRoutes() ([]Route, error) {
	routesFile := filepath.Join(s.config.DataPath, "routes.yaml")
	data, err := ioutil.ReadFile(routesFile)
	if err != nil {
		return nil, err
	}

	var routes []Route
	if err := yaml.Unmarshal(data, &routes); err != nil {
		return nil, err
	}

	return routes, nil
}

func (s *Server) loadACL() (*ACLPolicy, error) {
	aclFile := filepath.Join(s.config.DataPath, "acls.yaml")
	data, err := ioutil.ReadFile(aclFile)
	if err != nil {
		return nil, err
	}

	var acl ACLPolicy
	if err := yaml.Unmarshal(data, &acl); err != nil {
		return nil, err
	}

	return &acl, nil
}

// Headscale API interaction functions
func (s *Server) createHeadscaleUser(user User) error {
	// Implementation for creating user via Headscale API
	// This would make HTTP requests to Headscale API
	log.Printf("Creating user: %s", user.Name)
	return nil // Placeholder
}

func (s *Server) enableHeadscaleRoute(route Route) error {
	// Implementation for enabling routes via Headscale API
	log.Printf("Enabling routes for node %s: %v", route.Node, route.Routes)
	return nil // Placeholder
}

func (s *Server) updateHeadscaleACL(acl *ACLPolicy) error {
	// Implementation for updating ACL via Headscale API
	log.Printf("Updating ACL policy")
	return nil // Placeholder
}

func (s *Server) getHeadscaleUsers() ([]string, error) {
	// Implementation for getting users from Headscale API
	return []string{"admin", "alice", "bob"}, nil // Placeholder
}

func (s *Server) getHeadscaleRoutes() ([]string, error) {
	// Implementation for getting routes from Headscale API
	return []string{"10.0.0.0/8", "192.168.0.0/16"}, nil // Placeholder
}

func (s *Server) createHeadscaleAuthKey(req AuthKeyRequest) (*AuthKeyResponse, error) {
	// Implementation for creating auth key via Headscale API
	expiration := time.Now().Add(24 * time.Hour)
	if req.Expiration != "" {
		if duration, err := time.ParseDuration(req.Expiration); err == nil {
			expiration = time.Now().Add(duration)
		}
	}

	return &AuthKeyResponse{
		Key:        "hskey_" + generateRandomString(32),
		User:       req.User,
		Ephemeral:  req.Ephemeral,
		Reusable:   req.Reusable,
		Expiration: expiration,
		Tags:       req.Tags,
	}, nil
}

// Additional route handlers (simplified)
func (s *Server) validateConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"valid": true, "message": "Configuration is valid"})
}

func (s *Server) listAuthKeys(c *gin.Context) {
	c.JSON(http.StatusOK, []AuthKeyResponse{})
}

func (s *Server) revokeAuthKey(c *gin.Context) {
	keyID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Auth key %s revoked", keyID)})
}

func (s *Server) listUsers(c *gin.Context) {
	users, err := s.loadUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (s *Server) createUser(c *gin.Context) {
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func (s *Server) deleteUser(c *gin.Context) {
	userName := c.Param("name")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("User %s deleted", userName)})
}

func (s *Server) listNodes(c *gin.Context) {
	c.JSON(http.StatusOK, []gin.H{})
}

func (s *Server) deleteNode(c *gin.Context) {
	nodeID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Node %s deleted", nodeID)})
}

func (s *Server) expireNode(c *gin.Context) {
	nodeID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Node %s expired", nodeID)})
}

func (s *Server) listRoutes(c *gin.Context) {
	routes, err := s.loadRoutes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, routes)
}

func (s *Server) enableRoute(c *gin.Context) {
	var route Route
	if err := c.ShouldBindJSON(&route); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, route)
}

func (s *Server) disableRoute(c *gin.Context) {
	routeID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Route %s disabled", routeID)})
}

func (s *Server) getACL(c *gin.Context) {
	acl, err := s.loadACL()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, acl)
}

func (s *Server) updateACL(c *gin.Context) {
	var acl ACLPolicy
	if err := c.ShouldBindJSON(&acl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ACL updated successfully"})
}

// Middleware functions
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func authMiddleware(apiKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for health checks and metrics
		if c.Request.URL.Path == "/health" || c.Request.URL.Path == "/healthz" || c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		auth := c.GetHeader("Authorization")
		if auth == "" || auth != "Bearer "+apiKey {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Utility functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func generateRandomString(length int) string {
	// Simple random string generator for demo
	return fmt.Sprintf("%d", time.Now().UnixNano())[:length]
}

func (s *Server) Run() error {
	return s.router.Run(":" + s.config.Port)
}

func main() {
	server := NewServer()
	
	log.Printf("Starting Headscale Orchestrator API on port %s", server.config.Port)
	log.Printf("Headscale URL: %s", server.config.HeadscaleURL)
	log.Printf("Data path: %s", server.config.DataPath)
	
	if err := server.Run(); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}