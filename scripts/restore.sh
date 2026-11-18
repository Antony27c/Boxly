#!/usr/bin/env bash
#
# Restaura un backup generado por scripts/backup.sh.
# OJO: reemplaza la base de datos y el contenido de uploads actuales.
#
# Uso:   bash scripts/restore.sh backups/boxly-AAAAMMDD-HHMMSS
#        bash scripts/restore.sh backups/boxly-AAAAMMDD-HHMMSS --yes   (sin confirmar)

set -euo pipefail
cd "$(dirname "$0")/.."

ORIGEN="${1:-}"
if [ -z "$ORIGEN" ]; then
  echo "Uso: $0 <carpeta-del-backup> [--yes]"
  exit 1
fi
SIN_CONFIRMAR="${2:-}"

[ -f "$ORIGEN/db.sql.gz" ] || { echo "No existe $ORIGEN/db.sql.gz"; exit 1; }
[ -f "$ORIGEN/uploads.tar.gz" ] || { echo "No existe $ORIGEN/uploads.tar.gz"; exit 1; }

cat <<EOF
Se va a restaurar:
  base de datos <- $ORIGEN/db.sql.gz      (SE REEMPLAZA la actual)
  uploads       <- $ORIGEN/uploads.tar.gz (SE REEMPLAZA el contenido actual)

EOF

if [ "$SIN_CONFIRMAR" != "--yes" ]; then
  read -r -p "Escribí 'si' para confirmar: " RESPUESTA
  [ "$RESPUESTA" = "si" ] || { echo "Cancelado."; exit 1; }
fi

echo "[restore] Recreando la base de datos…"
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
   -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE);" \
   -c "CREATE DATABASE \"$POSTGRES_DB\";"'

echo "[restore] Cargando el dump…"
gunzip -c "$ORIGEN/db.sql.gz" | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q'

echo "[restore] Restaurando uploads…"
# /app/uploads es un volumen montado: no se puede borrar el punto de montaje,
# solo su contenido. El tar trae la carpeta uploads/ y se descomprime en /app.
docker compose run --rm --no-deps -T api sh -c \
  'find /app/uploads -mindepth 1 -delete && tar -xzf - -C /app' \
  < "$ORIGEN/uploads.tar.gz"

echo "[restore] Reiniciando la API…"
docker compose restart api

echo "[restore] Listo."
