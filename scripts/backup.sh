#!/usr/bin/env bash
#
# Backup de Boxly: dump de PostgreSQL + contenido del volumen uploads.
#
# Uso:   bash scripts/backup.sh
# Cron:  0 3 * * *  cd /ruta/al/proyecto && bash scripts/backup.sh >> backups/backup.log 2>&1
#
# Los backups quedan en ./backups/boxly-AAAAMMDD-HHMMSS/ y se conservan
# DIAS_RETENCION días (14 por defecto). backups/latest apunta al más nuevo.

set -euo pipefail
cd "$(dirname "$0")/.."

DIR_BACKUP="${BACKUP_DIR:-backups}"
DIAS_RETENCION="${DIAS_RETENCION:-14}"
FECHA="$(date +%Y%m%d-%H%M%S)"
DESTINO="$DIR_BACKUP/boxly-$FECHA"

mkdir -p "$DESTINO"

echo "[backup] PostgreSQL -> $DESTINO/db.sql.gz"
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip' \
  > "$DESTINO/db.sql.gz"

echo "[backup] uploads -> $DESTINO/uploads.tar.gz"
docker compose run --rm --no-deps -T api sh -c \
  'tar -czf - -C /app uploads' > "$DESTINO/uploads.tar.gz"

ln -sfn "boxly-$FECHA" "$DIR_BACKUP/latest"

# Rotación: borra los backups más viejos que DIAS_RETENCION días.
find "$DIR_BACKUP" -mindepth 1 -maxdepth 1 -type d -name 'boxly-*' \
  -mtime "+$DIAS_RETENCION" -exec rm -rf {} +

echo "[backup] Listo: $DESTINO"
du -sh "$DESTINO" 2>/dev/null || true
