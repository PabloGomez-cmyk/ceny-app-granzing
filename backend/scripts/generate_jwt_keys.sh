#!/usr/bin/env bash
# Genera par de claves RS256 para JWT.
# Ejecutar desde el directorio backend/ una sola vez antes del primer deploy.
set -e

OUT_DIR="${1:-.}"

openssl genrsa -out "$OUT_DIR/jwt_private.pem" 2048
openssl rsa -in "$OUT_DIR/jwt_private.pem" -pubout -out "$OUT_DIR/jwt_public.pem"

echo "Claves generadas en $OUT_DIR:"
echo "  jwt_private.pem  (NUNCA comitear)"
echo "  jwt_public.pem   (puede ser público)"
echo ""
echo "Para producción (Railway, sin filesystem persistente): pegar el contenido"
echo "de cada .pem tal cual (con saltos de línea reales) en las variables de"
echo "entorno JWT_PRIVATE_KEY / JWT_PUBLIC_KEY. No hace falta escapar los \\n"
echo "si la plataforma soporta variables multilínea."
