#!/usr/bin/env bash
# =============================================================
#  Se ejecuta solo cada vez que el Codespace arranca.
#  1) Crea/actualiza el .env con las direcciones públicas del Codespace
#  2) Levanta todo con docker compose
#  3) Intenta poner públicos los puertos 8080 (API) y 5678 (n8n)
# =============================================================
set -e
cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env

setvar() {  # setvar CLAVE VALOR  -> escribe o reemplaza en .env
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    sed -i "s|^${k}=.*|${k}=${v}|" .env
  else
    echo "${k}=${v}" >> .env
  fi
}

DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
API_URL="https://${CODESPACE_NAME}-8080.${DOMAIN}"
N8N_URL="https://${CODESPACE_NAME}-5678.${DOMAIN}/"

# Telegram necesita la dirección pública de n8n
setvar N8N_PUBLIC_URL "$N8N_URL"

# Secreto JWT único la primera vez (el de ejemplo es público)
if grep -q "^JWT_SECRET=cambia-esto" .env; then
  setvar JWT_SECRET "$(openssl rand -hex 32)"
fi

# Llave de Groq desde los "secrets" de Codespaces (Settings -> Codespaces -> Secrets)
[ -n "${GROQ_API_KEY:-}" ] && setvar GROQ_API_KEY "$GROQ_API_KEY"
[ -n "${GROQ_MODEL:-}" ] && setvar GROQ_MODEL "$GROQ_MODEL"

# Esperar a que Docker esté listo
for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done

echo "▶ Levantando MediClick AI (la primera vez tarda varios minutos)..."
docker compose up -d --build

# Hacer públicos los puertos (si no se puede, se hace a mano en la pestaña PORTS)
gh codespace ports visibility 8080:public 5678:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
  || echo "⚠ Pon PUBLIC los puertos 8080 y 5678 en la pestaña PORTS (clic derecho → Port Visibility → Public)"

cat <<EOF

==================================================================
 ✅ MediClick AI está corriendo en la nube (GitHub Codespaces)

 API / app ......... ${API_URL}
 Panel admin ....... ${API_URL}/admin
 Prueba ............ ${API_URL}/health
 n8n (Telegram) .... ${N8N_URL}

 En tu laptop, mobile/.env:
   EXPO_PUBLIC_API_URL=${API_URL}
==================================================================
EOF
