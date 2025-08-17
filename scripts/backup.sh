#!/bin/bash
set -euo pipefail

BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

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

# Cleanup old backups
echo "🧹 Cleaning up old backups..."
find backup/ -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

echo "✅ Backup completed: ${BACKUP_DIR}"
