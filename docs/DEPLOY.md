# Fuse Radio Enterprise — Guia de Produção

## Checklist obrigatório antes de subir

- [ ] **Trocar a senha do admin** (`admin@fuse.local` / seed) ou criar o admin com
      `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` no primeiro deploy.
- [ ] **Gerar segredos fortes**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
      (`openssl rand -base64 48`) e `DEVICE_API_KEY`.
- [ ] **CORS**: `CORS_ORIGINS` apenas com os domínios reais (ex.: `https://app.suaempresa.com`).
- [ ] **Banco**: PostgreSQL gerenciado (RDS/Cloud SQL/Neon) com backup automático;
      aplicar schema com `pnpm --filter @fuse/api prisma:deploy` (migrations versionadas
      em `apps/api/prisma/migrations`), **nunca** `db push` em produção.
- [ ] **TLS**: terminar no Cloudflare (proxy laranja) com origin certificate no ingress.
- [ ] **Uploads**: `UPLOAD_DIR` em volume persistente (single node) ou migrar o driver
      para S3/R2 antes de escalar a API horizontalmente.
- [ ] **Socket.IO em múltiplas réplicas**: habilitar sticky sessions no ingress
      (`nginx.ingress.kubernetes.io/affinity: cookie`) ou adicionar
      `@socket.io/redis-adapter` + Redis.
- [ ] **Observabilidade**: configurar Sentry (front e API) e scrape do Prometheus.

## Variáveis de ambiente

### API (`apps/api`)

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | PostgreSQL com `?schema=public` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Segredos independentes e fortes |
| `JWT_ACCESS_TTL` | Padrão `900s` |
| `DEVICE_API_KEY` | Chave que os players usam nos heartbeats |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |
| `UPLOAD_DIR` | Diretório de mídia (volume persistente) |
| `PORT` | Padrão `4000` |

### Web (`apps/web`)

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL pública da API (ex.: `https://api.suaempresa.com`) |
| `NEXT_PUBLIC_DEVICE_KEY` | Mesmo valor de `DEVICE_API_KEY` |

Sem `NEXT_PUBLIC_API_URL` o front sobe em modo demonstração — útil para homologação
visual, nunca para produção.

## Opção A — VPS única com Docker Compose (até ~centenas de lojas)

```bash
git clone <repo> && cd Webradio-Fuse
# criar .env de produção para api e web (ver tabelas acima)
docker compose up -d --build
docker compose exec api node prisma/seed.js   # primeiro deploy
```

Coloque o Cloudflare na frente (DNS proxied) apontando para a VPS; o compose expõe
web:3000 e api:4000 — use um reverse proxy (Caddy/Traefik/nginx) com TLS de origem.

## Opção A2 — Hospedagem com aaPanel (VPS com painel)

O aaPanel funciona bem como camada de gerenciamento (nginx, PostgreSQL, PM2, SSL).
Requisitos no App Store do painel: **Nginx**, **PostgreSQL 16** (ou use um Postgres
gerenciado externo) e **PM2 Manager** (que instala o Node.js — selecione Node 20+).

```bash
# 1. Via SSH, instalar pnpm e clonar o projeto (ex.: em /www/wwwroot)
npm install -g pnpm
cd /www/wwwroot && git clone <seu-repo> fuse-radio && cd fuse-radio
pnpm install

# 2. Banco: crie o database e o usuário no aaPanel (Databases → PostgreSQL)
#    e configure apps/api/.env com a DATABASE_URL correspondente + segredos fortes

# 3. Build e schema
pnpm --filter @fuse/shared build
pnpm --filter @fuse/api prisma:generate
pnpm --filter @fuse/api build
pnpm --filter @fuse/api prisma:deploy
pnpm --filter @fuse/api db:seed          # apenas no primeiro deploy

# 4. Web (defina NEXT_PUBLIC_API_URL no apps/web/.env antes do build)
pnpm --filter @fuse/web build
```

**Processos (PM2 Manager → Add project):**

| App | Diretório | Comando de start |
| --- | --- | --- |
| `fuse-api` | `/www/wwwroot/fuse-radio/apps/api` | `node dist/main.js` |
| `fuse-web` | `/www/wwwroot/fuse-radio/apps/web` | `pnpm start` (next start, porta 3000) |

**Sites (Website → Add site → Reverse proxy):**

- `app.seudominio.com` → proxy para `http://127.0.0.1:3000`
- `api.seudominio.com` → proxy para `http://127.0.0.1:4000`

No site da API, habilite WebSocket no proxy (o aaPanel tem o toggle "WebSocket
support"; ele adiciona os headers `Upgrade`/`Connection` necessários ao Socket.IO).
Emita os certificados SSL (Let's Encrypt) pelos dois sites no próprio painel e
aumente `client_max_body_size` para `60m` no nginx do site da API (uploads de mídia).

Atualizações: `git pull && pnpm install && pnpm build && pnpm --filter @fuse/api prisma:deploy`
e restart dos dois apps no PM2.

## Opção B — Kubernetes (milhares de lojas)

1. Build e push das imagens (`infra/docker/Dockerfile.api` e `Dockerfile.web`).
2. `kubectl create namespace fuse-radio`
3. Secret `fuse-api-env` com as variáveis da API.
4. `kubectl apply -f infra/k8s/` — API com HPA 3→20 réplicas, probes em `/v1/health`.
5. Job de migração no deploy: `node_modules/.bin/prisma migrate deploy` antes do rollout.
6. Redis + `@socket.io/redis-adapter` quando passar de 1 réplica de API.

Dimensionamento de referência: cada loja gera 1 heartbeat/30s e 1 conexão WebSocket.
10.000 lojas ≈ ~333 req/s de heartbeat + 10k sockets — confortável para 3–5 réplicas
com os requests/limits definidos em `infra/k8s/api.yaml`.

## Players nas lojas

- **Mini PC / Smart TV**: Electron kiosk (`apps/desktop`) com
  `FUSE_PLAYER_URL=https://app.suaempresa.com/player`; configurar auto-start no boot.
- **Tablet / navegador**: instalar o PWA a partir de `/player` (fullscreen automático).
- Em cada dispositivo, definir o **código da loja** no painel de configurações do
  player — é ele que vincula heartbeats, programação e comandos remotos.

## Rotina operacional

- Failover e playlist de emergência são autônomos no player; incidentes ficam em
  `Incident` e aparecem no dashboard.
- `POST /v1/fleet/sweep-offline` (papel SUPPORT+) marca lojas sem heartbeat — agende
  a cada minuto (CronJob do K8s ou scheduler externo).
- Auditoria em `AuditLog` (logins e comandos remotos); exporte para o Loki/SIEM.
