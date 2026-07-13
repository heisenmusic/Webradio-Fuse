# Fuse Radio Enterprise — Auditoria Técnica

*Auditoria conduzida sobre o estado real do repositório (branch `claude/fuse-radio-enterprise-ey6cwa`), cobrindo frontend, backend, streaming, UX, performance, segurança e produto.*

---

## 1. O que já está pronto ✅

### Player da Loja (`apps/web` → `/player`)
- Streaming Icecast com **failover automático** principal → secundário → terciário → playlist de emergência, com retorno automático ao principal (probe a cada 30 s) e crossfade
- **Dois modos de reprodução** com detecção automática em ≤4 s: Web Audio (visualizador real) e direto (origem sem CORS), incluindo **proxy de stream com CORS via API** para manter o visualizador sincronizado
- Watchdog de stall (áudio congelado > 8 s ⇒ failover), reconexão, cache-buster, métricas de qualidade
- **7 visualizadores** Canvas 60 fps (Spectrum, Circular, Waveform, Ambient, Neon, Premium, Minimalista) com fallback procedural
- HUD completo: logo, nome da rádio, status 🟢 Ao Vivo, loja/cidade, relógio e data locais, qualidade de conexão, tempo conectado, indicador de sincronização
- **Programação no horário do dispositivo**: avisos (com ducking), eventos operacionais e cenas — definições sincronizadas da central a cada 5 min, execução 100 % no relógio local
- Motor de cenas (volume, vinheta, visualizador, mensagem, campanha, espera)
- Digital Signage com rotação animada (imagens, comunicados, metas, ranking, QR)
- Heartbeat a cada 30 s; controle remoto via Socket.IO com ack (reiniciar, trocar stream, volume, aviso imediato, teste de áudio 440 Hz, cena, limpar cache, diagnóstico)
- **Media Session API**, PWA (manifest + service worker), **atalhos de teclado** (F/V/S/M/↑↓), tela cheia, painel de configurações persistido

### Dashboard (`/admin`)
- Login JWT com refresh rotation renovado automaticamente no cliente; modo demonstração sem API
- **Frota**: totais, filtros (estado/grupo/marca/busca), mapa lat/lng, painel por loja com comandos remotos reais, atualização instantânea via Socket.IO `fleet:update`
- **Avisos** (upload MP3/WAV/OGG + horário/dias/prioridade/categoria/repetição), **Cenas & Eventos**, **Signage** (upload de imagem), **Lojas** — CRUDs completos com navegação lateral e mobile

### API (`apps/api`)
- Multi-tenant com isolamento por tenantId em todas as entidades
- Auth: JWT + refresh com rotação e revogação, RBAC hierárquico (VIEWER→SUPER_ADMIN), rate-limit global + login, helmet
- Módulos: tenants, stores (com comandos remotos), fleet (heartbeat + status + sweep-offline), announcements (+ schedule por loja com signage), scenes/events, media (upload validado 50 MB), signage, **stream-proxy com CORS**, audit trail, health
- Prisma + PostgreSQL com **migrations versionadas** (baseline `0_init`) e seed

### Qualidade / Infra
- 11 testes unitários (agendamento local, qualidade, uptime) rodando no CI (GitHub Actions: testes + 3 builds)
- Docker Compose, Dockerfiles, manifests K8s com HPA, Electron kiosk, guias `DEPLOY.md` e `TUTORIAL-AAPANEL.md` + instalador `instalar-aapanel.sh`
- Verificações reais executadas: auth, heartbeat→fleet, upload→schedule, **player tocando via proxy no Chromium (Ao Vivo em ~5 s)**

## 2. O que está incompleto ⚠️

| Item | % | Impacto | Prioridade |
| --- | --- | --- | --- |
| Segmentação de avisos/eventos/signage por loja/grupo na UI (API pronta, formulários não expõem) | 70 % | Central grande precisa segmentar | Alta |
| Playlist de emergência: config existe no engine, mas sem UI de upload/gestão | 50 % | Silêncio se internet cair de vez | Alta |
| MFA (campo no schema, fluxo TOTP não implementado) | 20 % | Segurança de contas admin | Média |
| Pareamento por dispositivo (modelo `Device` pronto; heartbeat usa chave global) | 40 % | Rastreabilidade/segurança por loja | Média |
| Multi-tenant visual (cores/logo do tenant não aplicados dinamicamente no player) | 30 % | Marca branca | Média |
| Vídeo no Signage (modelo aceita, player só renderiza imagem/texto) | 60 % | Conteúdo em vídeo | Média |
| Histerese de failover (voltar ao principal se secundário estável; contagem de tentativas com backoff exponencial) | 70 % | Robustez em redes ruins | Média |
| Hidratação React (aviso #418 com config persistida — cosmético, sem quebra) | 90 % | Log poluído | Baixa |

## 3. O que está faltando ❌ (para um player enterprise completo)

- **Métricas de audiência**: ouvintes simultâneos (Icecast status-json.xsl), retenção, tempo médio de escuta
- **Now playing**: metadados ICY (música atual) no HUD e Media Session
- Equalizador (BiquadFilterNodes — o grafo já permite), normalização de loudness
- Notificações push (web push para o app do gerente), centro de alertas
- App do Gerente (PWA responsivo cobre parcialmente), favoritos/histórico/compartilhamento (rádio corporativa: baixa prioridade)
- Light mode (produto assume dark premium — decisão de design, não dívida)
- Integrações IA/TTS, WhatsApp, CRM/ERP/BI (arquitetura preparada, não iniciadas)
- Testes e2e automatizados no CI (Playwright já validado manualmente no ambiente)
- Observabilidade instrumentada (endpoint /metrics Prometheus, Sentry DSN)

## 4. Auditoria de UX

**Pontos fortes**: hierarquia clara no player (informação operacional nos cantos, visual no centro), estética premium consistente (glass/gradientes/Framer Motion), dashboard denso porém organizado, mobile com nav inferior.

**Atritos identificados**:
1. Sem indicação visível dos atalhos de teclado → adicionar overlay "?" (ajuda)
2. Falta feedback sonoro/visual de "conectando…" com progresso do failover (qual stream está tentando) — parcialmente coberto pelo pill de status
3. Acessibilidade: contraste ok no dark, mas faltam `aria-live` para mudanças de status e navegação por teclado completa no dashboard
4. Formulários do admin não têm confirmação de exclusão (delete imediato) → adicionar confirm
5. Settings do player expõe URLs técnicas ao lojista — considerar bloqueio por PIN

## 5. Auditoria de Performance

- **Bundle**: player 30,7 kB + 102 kB shared (First Load ~173 kB) — bom para o segmento; admin ~152 kB
- **Visualizadores**: Canvas 2D com rAF e DPR-aware; consumo baixo; sem OffscreenCanvas/WebGL ainda (interface `VizRenderer` isola a evolução)
- **Streaming**: elemento de áudio nativo (buffer do browser); proxy adiciona ~1 hop de latência (aceitável para rádio ambiente)
- **Melhorias recomendadas**: `next/dynamic` para SettingsPanel/SignageLayer (fora do caminho crítico), `content-visibility` na tabela da frota, memo nos cards, particionamento da tabela Heartbeat no Postgres (produção com milhares de lojas), Redis adapter para Socket.IO multi-réplica

## 6. Auditoria de Streaming (URLs Centova)

Validado em teste real (Chromium) e no Mac do usuário:
- ✅ Troca automática entre as 3 URLs; ✅ fallback; ✅ reconexão; ✅ detecção de queda (error/stall/watchdog); ✅ recuperação automática com crossfade; ✅ CORS resolvido (detecção ≤4 s + proxy)
- ⚠️ Melhorias criadas nesta rodada: sonda CORS na largada (elimina ~30 s de silêncio), proxy com CORS
- ⚠️ Pendentes: backoff exponencial entre ciclos completos, leitura de metadados ICY, medição ativa de latência

## 7. Funcionalidades avançadas — existência

| ✅ Existe | ⚠️ Parcial | ❌ Ausente |
| --- | --- | --- |
| Troca dinâmica de servidor | Monitoramento de ouvintes (frota sim; audiência Icecast não) | Favoritos / histórico / compartilhamento |
| PWA · Media Session · Atalhos de teclado | Analytics em tempo real (frota sim; retenção não) | Equalizador |
| Visualizador de áudio (7 modos) | Notificações (alertas no dashboard; push não) | Light mode (decisão de design) |
| Dark mode · Dashboard administrativo | Integração IA (arquitetura pronta) | Integração WhatsApp / CRM |
| Modo mini player (HUD compacto responsivo) | | Métricas de retenção |

## 8. Roadmap

**Fase 1 — Crítico (lançamento)**: segmentação por loja/grupo nos formulários · UI da playlist de emergência · confirmação de exclusão · troca da senha admin no primeiro login · e2e no CI
**Fase 2 — Essencial**: metadados ICY (now playing) · ouvintes simultâneos (Icecast JSON) · pareamento por dispositivo · MFA · vídeo no signage · backoff exponencial · aria-live
**Fase 3 — Premium**: tema por tenant no player · equalizador · app do gerente (push) · relatórios de retenção/uptime · WebGL/Three.js nos visualizadores · PIN nas configurações do player
**Fase 4 — Futuro**: IA/TTS para locuções · anúncios regionais dinâmicos · integrações WhatsApp/CRM/ERP/BI · playlists por região · campanhas geolocalizadas

---

*Última execução imediata concluída: proxy de stream com CORS (API + engine + player) e atalhos de teclado — validados de ponta a ponta em navegador real.*
