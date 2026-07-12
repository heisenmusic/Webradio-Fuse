/**
 * @fuse/shared — Contratos da plataforma Fuse Radio Enterprise.
 *
 * Estes tipos são a fonte única de verdade entre o Player da Loja (web/electron/pwa),
 * a API (NestJS) e o Dashboard operacional.
 */

// ---------------------------------------------------------------------------
// Streaming & Failover
// ---------------------------------------------------------------------------

/** Endpoints padrão da estação, em ordem de prioridade (principal → terciário). */
export const DEFAULT_STREAM_ENDPOINTS: readonly string[] = [
  "https://centova2.svdns.com.br:20028/stream",
  "https://centova2.svdns.com.br:20028/live",
  "https://centova2.svdns.com.br:20028/",
];

export type PlayerState =
  | "idle" // aguardando interação inicial
  | "connecting" // negociando stream
  | "playing" // transmissão ao vivo
  | "failover" // trocando para endpoint alternativo
  | "emergency" // executando playlist local de emergência
  | "stopped";

export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "offline";

export interface StationConfig {
  /** Nome exibido da rádio. */
  name: string;
  /** Endpoints ordenados por prioridade. */
  endpoints: string[];
  /** Playlist local usada quando todos os endpoints falham. */
  emergencyPlaylist: string[];
  /** Intervalo (ms) de re-teste do endpoint principal durante failover/emergência. */
  primaryProbeIntervalMs: number;
}

export interface FailoverEvent {
  from: string | null;
  to: string | null;
  reason: "error" | "stall" | "offline" | "manual" | "recovered";
  at: string; // ISO — horário do dispositivo
}

// ---------------------------------------------------------------------------
// Identidade da loja
// ---------------------------------------------------------------------------

export interface StoreIdentity {
  code: string;
  name: string;
  city: string;
  state?: string;
  country?: string;
  /** IANA timezone — apenas informativo; a execução usa SEMPRE o relógio do dispositivo. */
  timezone?: string;
  brand?: string;
  group?: string;
}

// ---------------------------------------------------------------------------
// Monitoramento — Heartbeat (a cada 30s)
// ---------------------------------------------------------------------------

export const HEARTBEAT_INTERVAL_MS = 30_000;

export interface HeartbeatPayload {
  storeCode: string;
  /** ISO timestamp no relógio do dispositivo. */
  deviceTime: string;
  appVersion: string;
  uptimeSec: number;
  playerState: PlayerState;
  streamUrl: string | null;
  volume: number; // 0..1
  quality: ConnectionQuality;
  cpuPct?: number;
  ramMb?: number;
  ip?: string;
  latencyMs?: number;
  /** Última sincronização de programação bem-sucedida (ISO). */
  lastSyncAt?: string;
  platform?: "browser" | "electron" | "pwa" | "smart-tv" | "mini-pc" | "tablet";
}

export type FleetHealth = "online" | "offline" | "degraded" | "no-audio" | "high-latency" | "out-of-sync";

export interface FleetStoreStatus {
  storeId: string;
  storeCode: string;
  name: string;
  city: string;
  state?: string;
  brand?: string;
  group?: string;
  tenant?: string;
  health: FleetHealth;
  lastHeartbeat?: HeartbeatPayload;
  lastSeenAt?: string;
  lat?: number;
  lng?: number;
}

// ---------------------------------------------------------------------------
// Controle remoto
// ---------------------------------------------------------------------------

export type RemoteCommandType =
  | "restart-player"
  | "switch-stream"
  | "update-version"
  | "clear-cache"
  | "update-theme"
  | "announce-now"
  | "audio-test"
  | "open-diagnostics"
  | "set-volume"
  | "run-scene";

export interface RemoteCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: RemoteCommandType;
  payload?: TPayload;
  issuedBy: string;
  issuedAt: string;
  targetStoreCodes: string[];
}

export interface RemoteCommandAck {
  commandId: string;
  storeCode: string;
  ok: boolean;
  detail?: string;
  at: string;
}

// ---------------------------------------------------------------------------
// Avisos programados — SEMPRE no horário do dispositivo
// ---------------------------------------------------------------------------

export type AnnouncementPriority = "low" | "normal" | "high" | "critical";

export interface ScheduledAnnouncement {
  id: string;
  label: string;
  /** URL do áudio (mp3/wav/ogg). */
  audioUrl: string;
  /** Horário local "HH:mm". */
  time: string;
  /** Dias da semana (0 = domingo … 6 = sábado). Vazio ⇒ todos os dias. */
  daysOfWeek: number[];
  priority: AnnouncementPriority;
  category?: string;
  /** Datas-limite opcionais (ISO date, interpretadas no fuso do dispositivo). */
  startsOn?: string;
  endsOn?: string;
  /** Repetir a cada N minutos a partir de `time` (opcional). */
  repeatEveryMin?: number;
}

/**
 * Um agendamento "vence" quando o horário local do dispositivo cruza `time`
 * num dia habilitado. `lastFiredKey` evita disparo duplo no mesmo minuto.
 */
export function announcementDueKey(a: ScheduledAnnouncement, now: Date): string | null {
  const day = now.getDay();
  if (a.daysOfWeek.length > 0 && !a.daysOfWeek.includes(day)) return null;
  const [hh, mm] = a.time.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const base = hh * 60 + mm;

  if (a.startsOn && now < new Date(`${a.startsOn}T00:00:00`)) return null;
  if (a.endsOn && now > new Date(`${a.endsOn}T23:59:59`)) return null;

  if (minutesNow === base) return `${a.id}:${dateKey}:${base}`;
  if (a.repeatEveryMin && minutesNow > base && (minutesNow - base) % a.repeatEveryMin === 0) {
    return `${a.id}:${dateKey}:${minutesNow}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Eventos operacionais & Cenas
// ---------------------------------------------------------------------------

export type OperationalEventKind =
  | "opening"
  | "lunch"
  | "promotion"
  | "shift-change"
  | "closing"
  | "cleaning"
  | "inventory"
  | "campaign"
  | "custom";

export interface OperationalEvent {
  id: string;
  kind: OperationalEventKind;
  label: string;
  /** Horário local "HH:mm" — relógio do dispositivo. */
  time: string;
  daysOfWeek: number[];
  sceneId: string;
}

export type SceneAction =
  | { type: "play-jingle"; audioUrl: string }
  | { type: "set-volume"; to: number; rampSec?: number }
  | { type: "set-visualizer"; mode: VisualizerMode }
  | { type: "show-message"; text: string; durationSec: number }
  | { type: "show-campaign"; imageUrl: string; durationSec: number }
  | { type: "wait"; seconds: number };

export interface Scene {
  id: string;
  name: string;
  description?: string;
  actions: SceneAction[];
}

// ---------------------------------------------------------------------------
// Visualizador de áudio
// ---------------------------------------------------------------------------

export const VISUALIZER_MODES = [
  "spectrum",
  "circular",
  "waveform",
  "ambient",
  "neon",
  "premium",
  "minimal",
] as const;

export type VisualizerMode = (typeof VISUALIZER_MODES)[number];

export const VISUALIZER_LABELS: Record<VisualizerMode, string> = {
  spectrum: "Spectrum",
  circular: "Circular",
  waveform: "Waveform",
  ambient: "Ambient",
  neon: "Neon",
  premium: "Premium",
  minimal: "Minimalista",
};

// ---------------------------------------------------------------------------
// Digital Signage
// ---------------------------------------------------------------------------

export type SignageKind =
  | "image"
  | "video"
  | "banner"
  | "qr-code"
  | "campaign"
  | "notice"
  | "goal"
  | "ranking";

export interface SignageItem {
  id: string;
  kind: SignageKind;
  title: string;
  assetUrl?: string;
  body?: string;
  durationSec: number;
  startsAt?: string;
  endsAt?: string;
}

// ---------------------------------------------------------------------------
// Multi-tenant / RBAC
// ---------------------------------------------------------------------------

export type UserRole = "super-admin" | "tenant-admin" | "manager" | "support" | "viewer";

export interface TenantTheme {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  darkMode?: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Classifica a qualidade de conexão a partir de métricas do player. */
export function classifyQuality(opts: {
  stallsLast5Min: number;
  avgLatencyMs?: number;
  online: boolean;
}): ConnectionQuality {
  if (!opts.online) return "offline";
  const latency = opts.avgLatencyMs ?? 0;
  if (opts.stallsLast5Min === 0 && latency < 300) return "excellent";
  if (opts.stallsLast5Min <= 1 && latency < 800) return "good";
  if (opts.stallsLast5Min <= 3) return "fair";
  return "poor";
}

export function formatUptime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
