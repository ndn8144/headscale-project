#!/bin/bash
set -euo pipefail

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
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
    
    # Health checks
    echo -e "${YELLOW}🏥 Health Checks:${NC}"
    
    # Check Headscale
    if docker-compose exec -T headscale headscale nodes list >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Headscale API responding${NC}"
    else
        echo -e "${RED}❌ Headscale API not responding${NC}"
    fi
    
    # Check Traefik
    if curl -sf http://localhost:8080/ping >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Traefik is healthy${NC}"
    else
        echo -e "${RED}❌ Traefik health check failed${NC}"
    fi
    
    # Check API
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ API is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  API health check failed${NC}"
    fi
    
    echo ""
}

show_logs() {
    local service="${1:-}"
    if [ -z "$service" ]; then
        echo "Available services:"
        docker-compose config --services
        echo ""
        echo "Usage: $0 logs <service_name>"
        return
    fi
    
    docker-compose logs -f "$service"
}

case "${1:-status}" in
    "status"|"")
        show_status
        ;;
    "logs")
        show_logs "${2:-}"
        ;;
    *)
        echo "Usage: $0 [status|logs] [service]"
        ;;
esac
