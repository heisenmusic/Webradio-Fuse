# Fuse Radio Enterprise

**Rádio corporativa, comunicação interna e gestão de experiência sonora para redes varejistas.**

Uma central gerencia milhares de lojas, múltiplas marcas e redes, em diferentes fusos horários — através de uma plataforma moderna, elegante e extremamente simples.

> Não é um player web. É um produto SaaS premium: visual sofisticado, animações suaves, design system profissional. Referências: Spotify, Tesla, Stripe, Linear, Notion, Sonos, Apple Music.

---

## Monorepo

```
fuse-radio-enterprise/
├── apps/
│   ├── web/        → Next.js 15 + React 19 — Player da Loja (/player) e Dashboard (/admin)
│   ├── api/        → NestJS + Prisma + PostgreSQL — API multi-tenant, realtime, monitoramento
│   └── desktop/    → Electron — modo kiosk para Smart TV / Mini PC / Tablet
├── packages/
│   └── shared/     → Contratos TypeScript compartilhados (heartbeat, comandos remotos, cenas…)
├── infra/          → Dockerfiles, Kubernetes, observabilidade
└── docs/           → Arquitetura, protocolos e roadmap
```

## Módulos principais

| Módulo | Descrição |
| --- | --- |
| **Player da Loja** | Tela cheia, Smart TV, Mini PC, Tablet, Navegador, Electron e PWA |
| **Visualizador de áudio** | 7 modos (Spectrum, Circular, Waveform, Ambient, Neon, Premium, Minimalista) — Web Audio API + Canvas, 60 FPS |
| **Failover inteligente** | Principal → secundário → terciário → playlist de emergência, com retorno automático e crossfade |
| **Avisos programados** | MP3/WAV/OGG com horário, repetição, prioridade, grupos e categorias — sempre no **horário do dispositivo** |
| **Cenas operacionais** | Motor de automação: Abertura, Almoço, Promoção, Troca de Turno, Fechamento, Limpeza, Inventário, Campanhas |
| **Digital Signage** | Imagens, vídeos, banners, QR Codes, campanhas, metas, ranking de vendas |
| **Dashboard operacional** | Lojas online/offline/falha/sem áudio/latência alta, mapa em tempo real, filtros por estado, cidade, grupo, cliente e marca |
| **Monitoramento** | Heartbeat a cada 30 s: CPU, RAM, versão, uptime, status de streaming, volume, qualidade, IP |
| **Controle remoto** | Reiniciar player, trocar stream, atualizar versão, limpar cache, tema, aviso imediato, teste de áudio, diagnóstico |
| **Multi-tenant** | Logo, domínio, cores, temas, usuários, permissões e lojas — totalmente isolados por cliente |
| **Segurança** | JWT + Refresh rotation, RBAC, MFA-ready, rate limit, criptografia, logs auditáveis |

## Início rápido

```bash
pnpm install

# Banco de dados (PostgreSQL via Docker)
docker compose up -d postgres

# API
cp apps/api/.env.example apps/api/.env
pnpm prisma:generate
pnpm --filter @fuse/api prisma:push   # cria o schema no banco
pnpm dev:api                          # http://localhost:4000

# Web (Player + Admin)
pnpm dev:web                          # http://localhost:3000
```

- **Player da loja** → `http://localhost:3000/player`
- **Dashboard operacional** → `http://localhost:3000/admin`

O player já vem configurado com os streams padrão e failover automático:

```json
[
  "https://centova2.svdns.com.br:20028/stream",
  "https://centova2.svdns.com.br:20028/live",
  "https://centova2.svdns.com.br:20028/"
]
```

## Princípio crítico: horário local

Toda a programação (avisos, eventos, cenas) é executada com o **relógio do dispositivo da loja**, nunca com o horário do servidor. Uma campanha às `08:00` toca às 08:00 em São Paulo, Manaus, Lisboa e Nova York — cada loja no seu próprio fuso.

## Stack

**Frontend** Next.js 15 · React 19 · TypeScript · Tailwind 4 · Framer Motion · Zustand
**Player** Web Audio API · Canvas · Media Session API
**Backend** NestJS · PostgreSQL · Prisma · Socket.IO
**Infra** Docker · Kubernetes · AWS · Cloudflare
**Observabilidade** Prometheus · Grafana · Loki · Sentry

Documentação completa em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
