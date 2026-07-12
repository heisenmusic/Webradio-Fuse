"use client";

import {
  classifyQuality,
  type ConnectionQuality,
  type FailoverEvent,
  type PlayerState,
  type StationConfig,
} from "@fuse/shared";

/**
 * FuseAudioEngine — núcleo de streaming do Player da Loja.
 *
 * Responsabilidades:
 *  - Reproduzir o stream Icecast com Web Audio API (AnalyserNode + GainNode)
 *  - Failover automático: principal → secundário → terciário → emergência
 *  - Watchdog de stall (áudio congelado) e reconexão com backoff
 *  - Retorno automático ao principal com crossfade quando ele volta
 *  - Métricas de qualidade de conexão para o heartbeat
 *
 * Nota sobre CORS: streams Icecast sem `Access-Control-Allow-Origin` "mancham"
 * o MediaElementSource e o AnalyserNode passa a ler silêncio. O engine detecta
 * isso e alimenta o visualizador com dados procedurais sincronizados ao estado
 * de reprodução, mantendo a experiência visual viva.
 */

export interface EngineSnapshot {
  state: PlayerState;
  currentUrl: string | null;
  currentIndex: number;
  volume: number;
  quality: ConnectionQuality;
  stallsLast5Min: number;
  startedAt: number | null;
  lastFailover: FailoverEvent | null;
  emergencyTrack: string | null;
  analyserTainted: boolean;
}

type Listener = (snapshot: EngineSnapshot) => void;

const STALL_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 12_000;
const FFT_SIZE = 2048;

export class FuseAudioEngine {
  private audio: HTMLAudioElement | null = null;
  private emergencyAudio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private emergencyGain: GainNode | null = null;

  private config: StationConfig;
  private state: PlayerState = "idle";
  private currentIndex = 0;
  private volume = 0.9;
  private startedAt: number | null = null;
  private lastFailover: FailoverEvent | null = null;
  private emergencyTrackIndex = 0;

  private stallTimestamps: number[] = [];
  private lastProgressTime = 0;
  private lastCurrentTime = -1;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  private analyserTainted = false;
  private taintChecked = false;
  private freqData = new Uint8Array(FFT_SIZE / 2);
  private waveData = new Uint8Array(FFT_SIZE);
  private proceduralPhase = 0;

  private listeners = new Set<Listener>();

  constructor(config: StationConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): EngineSnapshot {
    return {
      state: this.state,
      currentUrl:
        this.state === "emergency"
          ? this.config.emergencyPlaylist[this.emergencyTrackIndex] ?? null
          : this.config.endpoints[this.currentIndex] ?? null,
      currentIndex: this.currentIndex,
      volume: this.volume,
      quality: this.quality(),
      stallsLast5Min: this.recentStalls(),
      startedAt: this.startedAt,
      lastFailover: this.lastFailover,
      emergencyTrack:
        this.state === "emergency"
          ? this.config.emergencyPlaylist[this.emergencyTrackIndex] ?? null
          : null,
      analyserTainted: this.analyserTainted,
    };
  }

  updateConfig(config: StationConfig) {
    this.config = config;
  }

  /** Deve ser chamado a partir de um gesto do usuário (política de autoplay). */
  async start() {
    if (typeof window === "undefined") return;
    this.ensureGraph();
    await this.ctx?.resume();
    this.startedAt = Date.now();
    this.setupMediaSession();
    this.startWatchdog();
    await this.connectTo(0, "manual");
  }

  stop() {
    this.setState("stopped");
    this.teardownTimers();
    this.audio?.pause();
    this.stopEmergency();
  }

  setVolume(v: number, rampSec = 0.4) {
    this.volume = Math.min(1, Math.max(0, v));
    const now = this.ctx?.currentTime ?? 0;
    if (this.gain && this.ctx) {
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.linearRampToValueAtTime(this.volume, now + rampSec);
    } else if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.emit();
  }

  getVolume() {
    return this.volume;
  }

  /** Troca manual de stream sem reinicializar o player. */
  async switchTo(index: number) {
    if (index < 0 || index >= this.config.endpoints.length) return;
    await this.connectTo(index, "manual");
  }

  async restart() {
    this.stop();
    await this.start();
  }

  /** Toca um aviso/vinheta com ducking do stream principal. */
  async playAnnouncement(url: string): Promise<void> {
    const previous = this.volume;
    this.setVolume(Math.min(previous, 0.15), 0.6);
    try {
      await this.playOneShot(url);
    } finally {
      this.setVolume(previous, 0.8);
    }
  }

  private playOneShot(url: string): Promise<void> {
    return new Promise((resolve) => {
      const el = new Audio(url);
      el.volume = 1;
      el.onended = () => resolve();
      el.onerror = () => resolve();
      void el.play().catch(() => resolve());
    });
  }

  // -------------------------------------------------------------------------
  // Dados para o visualizador (60 FPS)
  // -------------------------------------------------------------------------

  getFrame(): { freq: Uint8Array; wave: Uint8Array; level: number; live: boolean } {
    const playing = this.state === "playing" || this.state === "emergency";

    if (this.analyser && !this.analyserTainted) {
      this.analyser.getByteFrequencyData(this.freqData);
      this.analyser.getByteTimeDomainData(this.waveData);

      // Detecção de taint CORS: tocando há >2s mas o analyser só lê zeros.
      if (!this.taintChecked && playing && this.audio && this.audio.currentTime > 2) {
        const sum = this.freqData.reduce((a, b) => a + b, 0);
        if (sum === 0) {
          this.analyserTainted = true;
          this.emit();
        }
        this.taintChecked = true;
      }
      if (!this.analyserTainted) {
        const level =
          this.freqData.reduce((a, b) => a + b, 0) / (this.freqData.length * 255);
        return { freq: this.freqData, wave: this.waveData, level, live: playing };
      }
    }

    // Fallback procedural — mantém o visual vivo quando o analyser está mudo.
    this.generateProceduralFrame(playing);
    const level = playing ? 0.35 + 0.25 * Math.abs(Math.sin(this.proceduralPhase * 0.7)) : 0;
    return { freq: this.freqData, wave: this.waveData, level, live: playing };
  }

  private generateProceduralFrame(playing: boolean) {
    this.proceduralPhase += 0.045;
    const t = this.proceduralPhase;
    const n = this.freqData.length;
    for (let i = 0; i < n; i++) {
      if (!playing) {
        this.freqData[i] = Math.max(0, this.freqData[i] - 6);
        continue;
      }
      const x = i / n;
      const bass = Math.exp(-x * 4.5) * (150 + 70 * Math.sin(t * 2.1 + x * 3));
      const mids = Math.exp(-Math.abs(x - 0.28) * 6) * 80 * (0.6 + 0.4 * Math.sin(t * 3.3 + i));
      const shimmer = 22 * Math.sin(t * 5 + i * 0.9) * Math.exp(-x * 2);
      const noise = 14 * Math.random();
      this.freqData[i] = Math.max(0, Math.min(255, bass + mids + shimmer + noise));
    }
    const w = this.waveData.length;
    for (let i = 0; i < w; i++) {
      const x = i / w;
      const v = playing
        ? 128 +
          46 * Math.sin(x * Math.PI * 6 + t * 4) * Math.sin(t * 1.3) +
          18 * Math.sin(x * Math.PI * 22 + t * 9)
        : 128;
      this.waveData[i] = Math.max(0, Math.min(255, v));
    }
  }

  // -------------------------------------------------------------------------
  // Conexão & failover
  // -------------------------------------------------------------------------

  private ensureGraph() {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "none";

    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const source = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.82;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      source.connect(this.analyser);
      this.analyser.connect(this.gain);
      this.gain.connect(this.ctx.destination);
    } catch {
      // Sem Web Audio API: reprodução direta, visualizador procedural.
      this.audio.volume = this.volume;
      this.analyserTainted = true;
    }

    this.audio.addEventListener("playing", () => {
      if (this.state !== "emergency") this.setState("playing");
      this.clearConnectTimer();
    });
    this.audio.addEventListener("error", () => this.onStreamFailure("error"));
    this.audio.addEventListener("stalled", () => this.noteStall());
    this.audio.addEventListener("waiting", () => this.noteStall());
  }

  private async connectTo(index: number, reason: FailoverEvent["reason"]) {
    if (!this.audio) return;
    const url = this.config.endpoints[index];
    if (!url) {
      await this.enterEmergency();
      return;
    }

    const from = this.config.endpoints[this.currentIndex] ?? null;
    this.currentIndex = index;
    this.taintChecked = false;
    this.setState(index === 0 && reason === "manual" ? "connecting" : "failover");
    if (reason !== "manual") {
      this.lastFailover = { from, to: url, reason, at: new Date().toISOString() };
    }

    // Cache-buster evita reconectar num buffer morto de proxy.
    this.audio.src = `${url}${url.includes("?") ? "&" : "?"}_fuse=${Date.now()}`;
    this.audio.load();

    this.clearConnectTimer();
    this.connectTimer = setTimeout(() => this.onStreamFailure("stall"), CONNECT_TIMEOUT_MS);

    try {
      await this.audio.play();
      this.stopEmergency();
    } catch {
      this.onStreamFailure("error");
    }
    this.emit();
  }

  private onStreamFailure(reason: FailoverEvent["reason"]) {
    if (this.state === "stopped" || this.state === "idle") return;
    this.clearConnectTimer();
    const next = this.currentIndex + 1;
    if (next < this.config.endpoints.length) {
      void this.connectTo(next, reason);
    } else {
      void this.enterEmergency();
    }
  }

  // -------------------------------------------------------------------------
  // Playlist de emergência + retorno automático
  // -------------------------------------------------------------------------

  private async enterEmergency() {
    if (this.state === "emergency") return;
    this.setState("emergency");
    this.lastFailover = {
      from: this.config.endpoints[this.currentIndex] ?? null,
      to: null,
      reason: "offline",
      at: new Date().toISOString(),
    };
    this.audio?.pause();
    this.startPrimaryProbe();
    await this.playEmergencyTrack();
    this.emit();
  }

  private async playEmergencyTrack() {
    const playlist = this.config.emergencyPlaylist;
    if (playlist.length === 0) return; // silêncio monitorado — incidente já registrado

    if (!this.emergencyAudio) {
      this.emergencyAudio = new Audio();
      this.emergencyAudio.addEventListener("ended", () => {
        this.emergencyTrackIndex = (this.emergencyTrackIndex + 1) % playlist.length;
        void this.playEmergencyTrack();
      });
      if (this.ctx) {
        try {
          const src = this.ctx.createMediaElementSource(this.emergencyAudio);
          this.emergencyGain = this.ctx.createGain();
          src.connect(this.emergencyGain);
          this.emergencyGain.connect(this.ctx.destination);
        } catch {
          /* reprodução direta */
        }
      }
    }
    const track = playlist[this.emergencyTrackIndex];
    this.emergencyAudio.src = track;
    if (this.emergencyGain) this.emergencyGain.gain.value = this.volume;
    else this.emergencyAudio.volume = this.volume;
    await this.emergencyAudio.play().catch(() => undefined);
    this.emit();
  }

  private stopEmergency() {
    this.emergencyAudio?.pause();
  }

  /** Durante emergência, re-testa o endpoint principal periodicamente. */
  private startPrimaryProbe() {
    if (this.probeTimer) return;
    this.probeTimer = setInterval(async () => {
      if (this.state !== "emergency") {
        this.clearProbeTimer();
        return;
      }
      const primary = this.config.endpoints[0];
      if (!primary) return;
      const alive = await this.probeEndpoint(primary);
      if (alive) {
        this.clearProbeTimer();
        await this.recoverWithCrossfade();
      }
    }, this.config.primaryProbeIntervalMs);
  }

  private async probeEndpoint(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);
      // `no-cors` devolve resposta opaca — suficiente para saber que respondeu.
      await fetch(url, { method: "GET", mode: "no-cors", signal: controller.signal });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  /** Transmissão principal voltou: crossfade da emergência para o stream. */
  private async recoverWithCrossfade() {
    const fadeSec = 2.5;
    const now = this.ctx?.currentTime ?? 0;
    if (this.emergencyGain && this.ctx) {
      this.emergencyGain.gain.cancelScheduledValues(now);
      this.emergencyGain.gain.linearRampToValueAtTime(0, now + fadeSec);
    }
    if (this.gain && this.ctx) {
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(0, now);
      this.gain.gain.linearRampToValueAtTime(this.volume, now + fadeSec);
    }
    this.lastFailover = {
      from: null,
      to: this.config.endpoints[0] ?? null,
      reason: "recovered",
      at: new Date().toISOString(),
    };
    await this.connectTo(0, "recovered");
    setTimeout(() => this.stopEmergency(), fadeSec * 1000);
  }

  // -------------------------------------------------------------------------
  // Watchdog & qualidade
  // -------------------------------------------------------------------------

  private startWatchdog() {
    if (this.watchdogTimer) return;
    this.lastProgressTime = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (!this.audio || this.state !== "playing") return;
      const ct = this.audio.currentTime;
      if (ct !== this.lastCurrentTime) {
        this.lastCurrentTime = ct;
        this.lastProgressTime = Date.now();
      } else if (Date.now() - this.lastProgressTime > STALL_TIMEOUT_MS) {
        // Áudio congelado: registra stall e aciona failover.
        this.noteStall();
        this.lastProgressTime = Date.now();
        this.onStreamFailure("stall");
      }
    }, 2_000);
  }

  private noteStall() {
    this.stallTimestamps.push(Date.now());
    this.emit();
  }

  private recentStalls(): number {
    const cutoff = Date.now() - 5 * 60_000;
    this.stallTimestamps = this.stallTimestamps.filter((t) => t > cutoff);
    return this.stallTimestamps.length;
  }

  private quality(): ConnectionQuality {
    const online =
      this.state === "playing" || this.state === "connecting" || this.state === "failover";
    if (this.state === "emergency") return "offline";
    return classifyQuality({ stallsLast5Min: this.recentStalls(), online });
  }

  // -------------------------------------------------------------------------
  // Media Session (controles do SO / Smart TV / lockscreen)
  // -------------------------------------------------------------------------

  private setupMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.config.name,
      artist: "Fuse Radio Enterprise",
      album: "Transmissão ao vivo",
    });
    navigator.mediaSession.setActionHandler("play", () => void this.start());
    navigator.mediaSession.setActionHandler("pause", () => this.stop());
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private setState(state: PlayerState) {
    if (this.state === state) return;
    this.state = state;
    this.emit();
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  private clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearProbeTimer() {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  private teardownTimers() {
    this.clearConnectTimer();
    this.clearProbeTimer();
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}
