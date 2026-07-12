#!/usr/bin/env bash
#
# Instalador do Fuse Radio Enterprise para servidores com aaPanel.
#
# O que ele faz por você:
#   1. Verifica o Node.js e instala o pnpm
#   2. Pergunta os dados do banco e dos domínios
#   3. Gera segredos fortes automaticamente
#   4. Cria os arquivos .env da API e do site
#   5. Compila tudo, aplica as migrations e cria o usuário admin
#
# Como usar (no Terminal do aaPanel, dentro da pasta do projeto):
#   bash scripts/instalar-aapanel.sh
#
set -euo pipefail

verde() { printf "\033[32m%s\033[0m\n" "$1"; }
erro() { printf "\033[31mERRO: %s\033[0m\n" "$1"; exit 1; }

[ -f "package.json" ] || erro "Execute este script na pasta raiz do projeto (onde está o package.json)."

# ---------------------------------------------------------------- Node & pnpm
command -v node >/dev/null 2>&1 || erro "Node.js não encontrado. Instale o 'PM2 Manager' na App Store do aaPanel escolhendo Node 20 ou superior."
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 20 ] || erro "Node $NODE_MAJOR encontrado — é necessário Node 20+. Troque a versão no PM2 Manager."
verde "✔ Node.js $(node --version)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Instalando pnpm…"
  npm install -g pnpm >/dev/null
fi
verde "✔ pnpm $(pnpm --version)"

# ---------------------------------------------------------------- Perguntas
echo
echo "── Dados do banco PostgreSQL (crie antes no aaPanel: Databases → PostgreSQL) ──"
read -rp "Nome do banco [fuse_radio]: " DB_NAME; DB_NAME=${DB_NAME:-fuse_radio}
read -rp "Usuário do banco [fuse]: " DB_USER; DB_USER=${DB_USER:-fuse}
read -rsp "Senha do banco: " DB_PASS; echo
[ -n "$DB_PASS" ] || erro "A senha do banco é obrigatória."
read -rp "Host do banco [localhost]: " DB_HOST; DB_HOST=${DB_HOST:-localhost}

echo
echo "── Domínios (sem https://, ex.: app.minhaempresa.com) ──"
read -rp "Domínio do site (player + dashboard): " DOM_APP
read -rp "Domínio da API: " DOM_API
[ -n "$DOM_APP" ] && [ -n "$DOM_API" ] || erro "Informe os dois domínios."

echo
echo "── Usuário administrador do dashboard ──"
read -rp "E-mail do admin [admin@${DOM_APP}]: " ADMIN_EMAIL; ADMIN_EMAIL=${ADMIN_EMAIL:-admin@${DOM_APP}}
read -rsp "Senha do admin (mínimo 8 caracteres): " ADMIN_PASS; echo
[ ${#ADMIN_PASS} -ge 8 ] || erro "A senha do admin precisa ter pelo menos 8 caracteres."

# ---------------------------------------------------------------- Segredos
gerar_segredo() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48; }
JWT_A=$(gerar_segredo)
JWT_R=$(gerar_segredo)
DEVICE_KEY=$(gerar_segredo)

# ---------------------------------------------------------------- .env
cat > apps/api/.env <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}?schema=public"
JWT_ACCESS_SECRET="${JWT_A}"
JWT_REFRESH_SECRET="${JWT_R}"
JWT_ACCESS_TTL="900s"
DEVICE_API_KEY="${DEVICE_KEY}"
PORT=4000
CORS_ORIGINS="https://${DOM_APP}"
UPLOAD_DIR="$(pwd)/apps/api/uploads"
EOF
verde "✔ apps/api/.env criado"

cat > apps/web/.env <<EOF
NEXT_PUBLIC_API_URL=https://${DOM_API}
NEXT_PUBLIC_DEVICE_KEY=${DEVICE_KEY}
EOF
verde "✔ apps/web/.env criado"

# ---------------------------------------------------------------- Build
echo
echo "Instalando dependências (pode levar alguns minutos)…"
pnpm install

echo "Compilando pacotes…"
pnpm --filter @fuse/shared build
pnpm --filter @fuse/api prisma:generate
pnpm --filter @fuse/api build
pnpm --filter @fuse/web build

echo "Aplicando o schema no banco…"
pnpm --filter @fuse/api prisma:deploy

echo "Criando dados iniciais e usuário admin…"
SEED_ADMIN_EMAIL="$ADMIN_EMAIL" SEED_ADMIN_PASSWORD="$ADMIN_PASS" \
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}?schema=public" \
  node apps/api/prisma/seed.js

# ---------------------------------------------------------------- Próximos passos
echo
verde "════════════════════════════════════════════════════════════"
verde " Instalação concluída! Falta só configurar o painel:"
verde "════════════════════════════════════════════════════════════"
cat <<EOF

1) PM2 Manager → Add Project (crie os DOIS):
   • Nome: fuse-api
     Pasta: $(pwd)/apps/api
     Start file: dist/main.js
   • Nome: fuse-web
     Pasta: $(pwd)/apps/web
     Comando: pnpm start   (porta 3000)

2) Website → Add site → Reverse proxy:
   • ${DOM_APP}  →  http://127.0.0.1:3000
   • ${DOM_API}  →  http://127.0.0.1:4000
     (no site da API, ATIVE o toggle "WebSocket support"
      e aumente client_max_body_size para 60m)

3) SSL: emita Let's Encrypt para os dois sites no próprio painel.

Acesso ao dashboard: https://${DOM_APP}/admin/login
   E-mail: ${ADMIN_EMAIL}
   Senha:  (a que você digitou agora)

Player das lojas: https://${DOM_APP}/player
EOF
