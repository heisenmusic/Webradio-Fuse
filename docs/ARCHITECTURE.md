# Fuse Radio Enterprise — Arquitetura

## Visão geral

```
┌────────────────────────── Cloudflare (CDN + WAF + TLS) ──────────────────────────┐
│                                                                                  │
│   apps/web (Next.js 15)                 apps/api (NestJS)                        │
│   ├── /player  → Player da Loja         ├── REST /v1 (JWT + RBAC + rate limit)   │
│   ├── /admin   → Dashboard              ├── Socket.IO /realtime                  │
│   └── PWA (sw.js + manifest)            └── Prisma → PostgreSQL                  │
│                                                                                  │
│   apps/desktop (Electron kiosk) ──── carrega /player ────┘                       │
│                                                                                  │
│   Observabilidade: Prometheus · Grafana · Loki · Sentry                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Monorepo pnpm. Contratos entre as pontas vivem em `packages/shared` — heartbeat,
comandos remotos, cenas, agendamentos e enums são tipados uma única vez.

## Player da Loja (`apps/web` → `/player`)

### Motor de áudio (`src/lib/player/audio-engine.ts`)

Grafo Web Audio: `MediaElementSource → AnalyserNode → GainNode → destination`.

**Failover inteligente** — máquina de estados:

```
connecting → playing
    │            │ erro/stall (watchdog 8s sem progresso)
    │            ▼
    └──────→ failover (endpoint 2) → failover (endpoint 3)
                     │ todos falharam
                     ▼
               emergency (playlist local em loop)
                     │ probe do principal a cada 30s (fetch no-cors)
                     ▼
               recovered → crossfade 2,5s de volta ao stream
```

- Troca de stream **sem reinicialização**: apenas `src` + `load()` no mesmo elemento;
  o grafo Web Audio permanece intacto.
- Cache-buster na URL evita reconectar em buffer morto de proxy.
- Qualidade de conexão derivada de stalls/5min (contrato `classifyQuality` no shared).
- **Nota CORS**: streams Icecast sem `Access-Control-Allow-Origin` mancham o
  `MediaElementSource` e o analyser lê silêncio. O engine detecta (tocando há >2s com
  espectro zerado) e alimenta o visualizador com dados procedurais — o áudio continua
  normal e o visual permanece vivo. Para dados reais, habilitar CORS no Icecast:
  `<http-headers><header name="Access-Control-Allow-Origin" value="*"/></http-headers>`.

### Visualizadores (`src/lib/player/visualizers.ts`)

7 renderers puros sobre Canvas 2D a 60 FPS (DPR-aware, pausa com aba oculta):
Spectrum, Circular, Waveform, Ambient, Neon, Premium (assinatura: anel espectral +
partículas orbitais + piso refletivo) e Minimalista. Upgrade futuro: OffscreenCanvas
em worker e modos WebGL/Three.js — a interface `VizRenderer` isola essa evolução.

### Horário local — decisão crítica

`LocalScheduler` roda **no dispositivo** com `new Date()`. O servidor apenas distribui
definições declarativas ("toca X às 08:00, seg–sex"). Cada loja dispara no seu fuso —
São Paulo, Manaus, Lisboa e Nova York executam a mesma programação de forma
independente, sem qualquer cálculo de timezone no backend. `announcementDueKey`
(shared) garante idempotência por minuto.

### Cenas operacionais

`SceneEngine` executa ações em sequência: `play-jingle` (com ducking do stream),
`set-volume` (rampas no GainNode), `set-visualizer`, `show-message`, `show-campaign`,
`wait`. Eventos operacionais (ABERTURA, ALMOÇO, PROMOÇÃO, TROCA DE TURNO, FECHAMENTO,
LIMPEZA, INVENTÁRIO, CAMPANHAS) apontam para cenas e são disparados pelo scheduler local.

## API (`apps/api`)

### Multi-tenant

Toda entidade referencia `tenantId`; usuários não-SUPER_ADMIN são automaticamente
escopados ao próprio tenant nos controllers. Cada tenant tem logo, domínio, cores,
tema, usuários, permissões e lojas isolados (modelo em `prisma/schema.prisma`).

### Segurança

- **JWT** de acesso (15 min) + **refresh token com rotação** (hash SHA-256 no banco,
  revogação no uso).
- **RBAC hierárquico**: VIEWER < SUPPORT < MANAGER < TENANT_ADMIN < SUPER_ADMIN
  (`@Roles()` + `RolesGuard`).
- **Rate limit** global (100 req/min) e agressivo no login (10/min).
- Senhas com bcrypt; campo `mfaSecret` pronto para TOTP.
- `AuditLog` para ações administrativas.
- Dispositivos (players) autenticam heartbeats com chave própria (`x-device-key`),
  nunca com credenciais de usuário.

### Monitoramento da frota

- `POST /v1/fleet/heartbeats` a cada 30 s (contrato `HeartbeatPayload`): CPU, RAM,
  versão, uptime, estado do player, volume, qualidade, IP, plataforma.
- Health derivado: `ONLINE`, `DEGRADED` (failover/emergência), `NO_AUDIO`,
  `HIGH_LATENCY`; `OFFLINE` após 3 heartbeats perdidos (sweep + incidente).
- `GET /v1/fleet/status` alimenta o dashboard; atualizações são propagadas em tempo
  real via Socket.IO (sala `fleet`).

### Controle remoto

`POST /v1/stores/:id/commands` → `RealtimeGateway` emite `remote-command` na sala
`store:<code>`. Comandos: reiniciar player, trocar stream, atualizar versão, limpar
cache, atualizar tema, aviso imediato, teste de áudio, diagnóstico, volume, executar
cena. O player confirma com `command:ack`, retransmitido aos dashboards.

## Dashboard (`apps/web` → `/admin`)

Totais da frota (online/offline/falha/sem áudio/latência/sem sync), filtros por
estado, cidade, grupo e marca, busca, mapa com projeção lat/lng e painel de controle
remoto por loja. Nesta versão usa frota simulada determinística
(`src/lib/admin/mock-fleet.ts`); a integração real troca uma função pelo fetch de
`/v1/fleet/status` + subscribe no Socket.IO.

## Distribuição do player

| Modo | Como |
| --- | --- |
| Navegador | `/player` direto |
| PWA | manifest fullscreen + service worker (shell offline; streams nunca cacheados) |
| Electron | `apps/desktop` — kiosk, autoplay liberado, auto-reload em crash |
| Smart TV / Mini PC / Tablet | PWA instalado ou Electron em kiosk |

## Infra

- `docker-compose.yml` para desenvolvimento (PostgreSQL + API + Web).
- `infra/docker/*` — imagens de produção multi-stage.
- `infra/k8s/*` — Deployments com HPA (API 3→20 réplicas), probes em `/v1/health`,
  Ingress atrás do Cloudflare. Socket.IO requer sticky sessions ou adapter Redis
  quando escalar horizontalmente (`@socket.io/redis-adapter`).

## Roadmap premium (arquitetura já preparada)

| Recurso | Gancho existente |
| --- | --- |
| Anúncios regionais dinâmicos | Segmentação `storeGroupIds`/`storeIds` em Announcement |
| Inserções locais automáticas | `SceneAction.play-jingle` + scheduler local |
| Playlists por região | `Station` por grupo/marca |
| Campanhas geolocalizadas | `lat`/`lng` por loja + SignageItem segmentado |
| IA (locuções TTS, vinhetas) | `MediaAsset` aceita qualquer origem de áudio — módulo TTS gera e registra |
| ERP / CRM / WhatsApp / BI | API REST tipada + eventos Socket.IO como barramento |
| App do Gerente (Android/iOS/PWA) | mesmos endpoints `fleet/status` + comandos |
