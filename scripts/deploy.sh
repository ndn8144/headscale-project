#!/bin/bash
# =================================================================
# deploy.sh - Main Deployment Script
# =================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"tailnet.work"}
PROJECT_NAME="headscale-infrastructure"

echo -e "${BLUE}🚀 Headscale Infrastructure Deployment${NC}"
echo -e "${BLUE}======================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        echo -e "${YELLOW}📝 Creating .env file from template...${NC}"
        cp .env.production .env
        echo -e "${RED}⚠️  IMPORTANT: Edit .env file with your configuration!${NC}"
        echo -e "${YELLOW}   - Set CF_DNS_API_TOKEN${NC}"
        echo -e "${YELLOW}   - Set POSTGRES_PASSWORD${NC}"
        echo -e "${YELLOW}   - Set OIDC configuration${NC}"
        echo -e "${YELLOW}   Then run this script again.${NC}"
        exit 1
    fi
    
    # Load environment variables
    source .env
    
    # Check critical environment variables
    if [ -z "${CF_DNS_API_TOKEN:-}" ] || [ "${CF_DNS_API_TOKEN}" = "your_cloudflare_api_token_here" ]; then
        echo -e "${RED}❌ CF_DNS_API_TOKEN not set in .env file${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Create directory structure
create_directories() {
    echo -e "${YELLOW}📁 Creating directory structure...${NC}"
    
    mkdir -p {data,config,backup}/{traefik,headscale,prometheus,grafana,loki,promtail,alertmanager}
    mkdir -p apps/{web,api}
    mkdir -p data/{users,routes,acls}
    mkdir -p scripts
    
    # Set proper permissions
    chmod 600 data/traefik/acme.json 2>/dev/null || touch data/traefik/acme.json && chmod 600 data/traefik/acme.json
    
    echo -e "${GREEN}✅ Directory structure created${NC}"
}

# Generate configurations
generate_configs() {
    echo -e "${YELLOW}⚙️  Generating configurations...${NC}"
    
    # Generate Headscale API key if not exists
    if [ -z "${HEADSCALE_API_KEY:-}" ] || [ "${HEADSCALE_API_KEY}" = "generate_with_headscale_apikeys_create" ]; then
        echo -e "${YELLOW}🔑 Headscale API key will be generated after Headscale starts${NC}"
    fi
    
    # Generate random secrets if not set
    if [ -z "${SESSION_SECRET:-}" ] || [ "${SESSION_SECRET}" = "generate_random_256_bit_secret" ]; then
        SESSION_SECRET=$(openssl rand -hex 32)
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
    fi
    
    if [ -z "${JWT_SECRET:-}" ] || [ "${JWT_SECRET}" = "generate_random_256_bit_secret" ]; then
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    fi
    
    echo -e "${GREEN}✅ Configurations generated${NC}"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}🚀 Deploying infrastructure...${NC}"
    
    # Pull latest images
    echo -e "${BLUE}📥 Pulling Docker images...${NC}"
    docker-compose pull
    
    # Start services in order
    echo -e "${BLUE}🔄 Starting services...${NC}"
    
    # Start database first
    echo -e "${YELLOW}🗄️  Starting PostgreSQL...${NC}"
    docker-compose up -d postgres
    sleep 10
    
    # Start Traefik
    echo -e "${YELLOW}🌐 Starting Traefik...${NC}"
    docker-compose up -d traefik
    sleep 5
    
    # Start Headscale
    echo -e "${YELLOW}🔐 Starting Headscale...${NC}"
    docker-compose up -d headscale
    sleep 15
    
    # Generate API key if needed
    if [ -z "${HEADSCALE_API_KEY:-}" ] || [ "${HEADSCALE_API_KEY}" = "generate_with_headscale_apikeys_create" ]; then
        echo -e "${YELLOW}🔑 Generating Headscale API key...${NC}"
        API_KEY=$(docker-compose exec -T headscale headscale apikeys create --expiration 8760h | tail -1 | awk '{print $NF}')
        if [ ! -z "$API_KEY" ]; then
            sed -i "s/HEADSCALE_API_KEY=.*/HEADSCALE_API_KEY=${API_KEY}/" .env
            echo -e "${GREEN}✅ API key generated and saved${NC}"
        else
            echo -e "${RED}❌ Failed to generate API key${NC}"
        fi
    fi
    
    # Start monitoring stack
    echo -e "${YELLOW}📊 Starting monitoring stack...${NC}"
    docker-compose up -d prometheus grafana loki promtail alertmanager cadvisor
    sleep 10
    
    # Start application services
    echo -e "${YELLOW}🖥️  Starting application services...${NC}"
    docker-compose up -d admin-ui api
    
    echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
}

# Post-deployment configuration
post_deployment() {
    echo -e "${YELLOW}⚙️  Running post-deployment configuration...${NC}"
    
    # Create default user
    echo -e "${BLUE}👤 Creating admin user...${NC}"
    docker-compose exec -T headscale headscale users create admin || echo "User admin already exists"
    
    # Create sample pre-auth key
    echo -e "${BLUE}🔑 Creating sample pre-auth key...${NC}"
    PREAUTH_KEY=$(docker-compose exec -T headscale headscale preauthkeys create --user admin --reusable --ephemeral=false --expiration 24h | tail -1 | awk '{print $NF}')
    
    if [ ! -z "$PREAUTH_KEY" ]; then
        echo -e "${GREEN}✅ Pre-auth key created: ${PREAUTH_KEY}${NC}"
        echo "SAMPLE_PREAUTH_KEY=${PREAUTH_KEY}" >> .env
    fi
    
    echo -e "${GREEN}✅ Post-deployment configuration completed${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}🏥 Running health checks...${NC}"
    
    # Check service status
    echo -e "${BLUE}📊 Service Status:${NC}"
    docker-compose ps
    
    # Check Headscale health
    if docker-compose exec -T headscale headscale nodes list >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Headscale is healthy${NC}"
    else
        echo -e "${RED}❌ Headscale health check failed${NC}"
    fi
    
    # Check Traefik health
    if curl -sf http://localhost:8080/ping >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Traefik is healthy${NC}"
    else
        echo -e "${RED}❌ Traefik health check failed${NC}"
    fi
    
    # Check API health
    sleep 5
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ API is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  API health check failed (may need more time)${NC}"
    fi
}

# Display access information
show_access_info() {
    echo -e "${BLUE}🌐 Access Information${NC}"
    echo -e "${BLUE}====================${NC}"
    echo -e "${GREEN}🎯 Services URLs:${NC}"
    echo -e "  Admin UI:       https://admin.${DOMAIN}"
    echo -e "  Headscale API:  https://headscale.${DOMAIN}"
    echo -e "  API Gateway:    https://api.${DOMAIN}"
    echo -e "  Grafana:        https://grafana.${DOMAIN}"
    echo -e "  Prometheus:     https://monitor.${DOMAIN}"
    echo -e "  Traefik:        https://traefik.${DOMAIN}"
    echo -e "  DERP Server:    https://derp.${DOMAIN}"
    echo ""
    echo -e "${GREEN}🔑 Credentials:${NC}"
    echo -e "  Grafana:        admin / ${GRAFANA_PASSWORD:-check_env_file}"
    echo -e "  Traefik:        admin / ${TRAEFIK_AUTH:-check_env_file}"
    echo ""
    echo -e "${GREEN}📋 Client Setup:${NC}"
    echo -e "  tailscale up --login-server=https://headscale.${DOMAIN} --authkey=\$PREAUTH_KEY"
    echo ""
    echo -e "${YELLOW}⚠️  DNS Configuration Required:${NC}"
    echo -e "  Create A records in Cloudflare for:"
    echo -e "    headscale.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    admin.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    api.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    grafana.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    monitor.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    traefik.${DOMAIN} → $(curl -s ifconfig.me)"
    echo -e "    derp.${DOMAIN} → $(curl -s ifconfig.me)"
}

# Main execution
main() {
    check_prerequisites
    create_directories
    generate_configs
    deploy_infrastructure
    post_deployment
    health_check
    show_access_info
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${YELLOW}📖 Check the logs: docker-compose logs -f${NC}"
    echo -e "${YELLOW}🔧 Manage services: docker-compose [start|stop|restart] [service]${NC}"
}

# Run main function
main "$@"

# =================================================================
# backup.sh - Backup Script
# =================================================================

#!/bin/bash

set -euo pipefail

BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "🗄️  Creating backup in ${BACKUP_DIR}..."

mkdir -p "${BACKUP_DIR}"

# Database backup
echo "📊 Backing up PostgreSQL database..."
docker-compose exec -T postgres pg_dump -U headscale headscale > "${BACKUP_DIR}/database.sql"

# Configuration backup
echo "⚙️  Backing up configurations..."
tar -czf "${BACKUP_DIR}/configs.tar.gz" config/ data/

# Environment backup (excluding secrets)
echo "🔧 Backing up environment (sanitized)..."
grep -v -E "(PASSWORD|SECRET|TOKEN|KEY)" .env > "${BACKUP_DIR}/env.sanitized" || true

# Headscale data backup
echo "🔐 Backing up Headscale data..."
docker-compose exec -T headscale tar -czf - /var/lib/headscale > "${BACKUP_DIR}/headscale_data.tar.gz"

# Cleanup old backups
echo "🧹 Cleaning up old backups..."
find backup/ -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

echo "✅ Backup completed: ${BACKUP_DIR}"

# =================================================================
# restore.sh - Restore Script
# =================================================================

#!/bin/bash

set -euo pipefail

BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory>"
    echo "Available backups:"
    ls -la backup/
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "🔄 Restoring from backup: $BACKUP_DIR"

# Stop services
echo "⏹️  Stopping services..."
docker-compose down

# Restore database
if [ -f "${BACKUP_DIR}/database.sql" ]; then
    echo "📊 Restoring database..."
    docker-compose up -d postgres
    sleep 10
    docker-compose exec -T postgres psql -U headscale -d headscale -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    docker-compose exec -T postgres psql -U headscale -d headscale < "${BACKUP_DIR}/database.sql"
fi

# Restore configurations
if [ -f "${BACKUP_DIR}/configs.tar.gz" ]; then
    echo "⚙️  Restoring configurations..."
    tar -xzf "${BACKUP_DIR}/configs.tar.gz"
fi

# Restore Headscale data
if [ -f "${BACKUP_DIR}/headscale_data.tar.gz" ]; then
    echo "🔐 Restoring Headscale data..."
    docker-compose up -d headscale
    sleep 5
    docker-compose exec -T headscale sh -c "cd / && tar -xzf -" < "${BACKUP_DIR}/headscale_data.tar.gz"
fi

# Start services
echo "🚀 Starting services..."
docker-compose up -d

echo "✅ Restore completed"

# =================================================================
# monitor.sh - System Monitoring Script
# =================================================================

#!/bin/bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_status() {
    echo -e "${BLUE}📊 Headscale Infrastructure Status${NC}"
    echo -e "${BLUE}=================================${NC}"
    
    # Service status
    echo -e "${YELLOW}🔧 Service Status:${NC}"
    docker-compose ps
    echo ""
    
    # Resource usage
    echo -e "${YELLOW}💻 Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo ""
    
    # SSL certificate status
    echo -e "${YELLOW}🔒 SSL Certificates:${NC}"
    if [ -f "data/traefik/acme.json" ]; then
        echo "ACME certificates file exists"
        # Check certificate expiry (simplified)
        echo "Use: openssl x509 -in cert.pem -text -noout | grep 'Not After' for detailed check"
    else
        echo -e "${RED}❌ ACME certificates file not found${NC}"
    fi
    echo ""
    
    # Network status
    echo -e "${YELLOW}🌐 Network Status:${NC}"
    if docker-compose exec -T headscale headscale nodes list >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Headscale API responding${NC}"
        NODES=$(docker-compose exec -T headscale headscale nodes list 2>/dev/null | wc -l)
        echo "Connected nodes: $((NODES - 1))"
    else
        echo -e "${RED}❌ Headscale API not responding${NC}"
    fi
    echo ""
    
    # Logs summary
    echo -e "${YELLOW}📋 Recent Errors:${NC}"
    docker-compose logs --tail 10 | grep -i error || echo "No recent errors found"
}

show_metrics() {
    echo -e "${BLUE}📈 Metrics Summary${NC}"
    echo -e "${BLUE}=================${NC}"
    
    # Prometheus targets
    if curl -sf http://localhost:9090/api/v1/targets >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Prometheus accessible${NC}"
        curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job): \(.health)"' 2>/dev/null || echo "Install jq for detailed metrics"
    else
        echo -e "${RED}❌ Prometheus not accessible${NC}"
    fi
    echo ""
    
    # Grafana status
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Grafana accessible${NC}"
    else
        echo -e "${RED}❌ Grafana not accessible${NC}"
    fi
}

tail_logs() {
    local service="${1:-}"
    if [ -z "$service" ]; then
        echo "Available services:"
        docker-compose config --services
        echo ""
        echo "Usage: $0 logs <service_name>"
        echo "       $0 logs all"
        return
    fi
    
    if [ "$service" = "all" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

restart_service() {
    local service="${1:-}"
    if [ -z "$service" ]; then
        echo "Usage: $0 restart <service_name>"
        echo "Available services:"
        docker-compose config --services
        return
    fi
    
    echo "🔄 Restarting $service..."
    docker-compose restart "$service"
    echo "✅ $service restarted"
}

case "${1:-status}" in
    "status"|"")
        show_status
        ;;
    "metrics")
        show_metrics
        ;;
    "logs")
        tail_logs "${2:-}"
        ;;
    "restart")
        restart_service "${2:-}"
        ;;
    *)
        echo "Usage: $0 [status|metrics|logs|restart] [service]"
        echo ""
        echo "Commands:"
        echo "  status  - Show system status (default)"
        echo "  metrics - Show metrics summary"
        echo "  logs    - Show service logs"
        echo "  restart - Restart a service"
        ;;
esac

# =================================================================
# update.sh - Update Script
# =================================================================

#!/bin/bash

set -euo pipefail

echo "🔄 Updating Headscale Infrastructure..."

# Backup before update
echo "📦 Creating backup before update..."
./scripts/backup.sh

# Pull latest images
echo "📥 Pulling latest Docker images..."
docker-compose pull

# Restart services with zero downtime
echo "🔄 Performing rolling update..."

SERVICES=(postgres traefik headscale prometheus grafana loki promtail alertmanager cadvisor admin-ui api)

for service in "${SERVICES[@]}"; do
    echo "🔄 Updating $service..."
    docker-compose up -d --no-deps "$service"
    sleep 5
    
    # Basic health check
    if docker-compose ps "$service" | grep -q "Up"; then
        echo "✅ $service updated successfully"
    else
        echo "❌ $service update failed"
        docker-compose logs --tail 10 "$service"
    fi
done

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Update completed successfully"

# =================================================================
# troubleshoot.sh - Troubleshooting Script
# =================================================================

#!/bin/bash

set -euo pipefail

echo "🔍 Headscale Infrastructure Troubleshooting"
echo "==========================================="

# Check Docker daemon
echo "🐳 Checking Docker..."
if systemctl is-active --quiet docker; then
    echo "✅ Docker daemon is running"
else
    echo "❌ Docker daemon is not running"
    echo "Run: sudo systemctl start docker"
fi

# Check disk space
echo "💽 Checking disk space..."
df -h | head -n 1
df -h | grep -E '^/dev/' | awk '{print $5 " " $6}' | while read output; do
    usage=$(echo $output | awk '{print $1}' | sed 's/%//g')
    partition=$(echo $output | awk '{print $2}')
    if [ $usage -ge 80 ]; then
        echo "❌ High disk usage: $usage% on $partition"
    else
        echo "✅ Disk usage OK: $usage% on $partition"
    fi
done

# Check memory
echo "🧠 Checking memory..."
free -h

# Check ports
echo "🔌 Checking ports..."
PORTS=(80 443 8080 9090 3000)
for port in "${PORTS[@]}"; do
    if netstat -tuln | grep -q ":$port "; then
        echo "✅ Port $port is in use"
    else
        echo "❌ Port $port is not in use"
    fi
done

# Check DNS resolution
echo "🌐 Checking DNS resolution..."
DOMAINS=(headscale.tailnet.work admin.tailnet.work api.tailnet.work grafana.tailnet.work)
for domain in "${DOMAINS[@]}"; do
    if nslookup "$domain" >/dev/null 2>&1; then
        echo "✅ $domain resolves"
    else
        echo "❌ $domain does not resolve"
    fi
done

# Check SSL certificates
echo "🔒 Checking SSL certificates..."
if [ -f "data/traefik/acme.json" ]; then
    echo "✅ ACME certificates file exists"
    echo "File size: $(ls -lh data/traefik/acme.json | awk '{print $5}')"
    echo "Last modified: $(ls -l data/traefik/acme.json | awk '{print $6, $7, $8}')"
else
    echo "❌ ACME certificates file not found"
fi

# Check environment variables
echo "⚙️  Checking critical environment variables..."
source .env 2>/dev/null || echo "❌ .env file not found"

CRITICAL_VARS=(CF_DNS_API_TOKEN POSTGRES_PASSWORD HEADSCALE_API_KEY)
for var in "${CRITICAL_VARS[@]}"; do
    if [ -n "${!var:-}" ] && [ "${!var}" != "your_${var,,}_here" ]; then
        echo "✅ $var is set"
    else
        echo "❌ $var is not properly set"
    fi
done

# Show recent errors
echo "📋 Recent errors from logs..."
docker-compose logs --tail 20 | grep -i error | tail -5 || echo "No recent errors found"

echo ""
echo "🔧 Common fixes:"
echo "  - DNS issues: Check Cloudflare DNS records"
echo "  - SSL issues: Check CF_DNS_API_TOKEN and restart traefik"
echo "  - API issues: Check HEADSCALE_API_KEY and restart services"
echo "  - Performance: Check disk space and memory usage"