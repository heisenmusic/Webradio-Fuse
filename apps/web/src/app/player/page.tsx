"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Maximize2,
  Play,
  Radio,
  Settings,
  SlidersHorizontal,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  formatUptime,
  HEARTBEAT_INTERVAL_MS,
  VISUALIZER_LABELS,
  VISUALIZER_MODES,
  type ConnectionQuality,
  type PlayerState,
  type Scene,
  type SignageItem,
} from "@fuse/shared";
import { FuseAudioEngine, type EngineSnapshot } from "@/lib/player/audio-engine";
import { fetchStoreProgram } from "@/lib/player/program-sync";
import { connectRemoteControl } from "@/lib/player/remote-control";
import { LocalScheduler } from "@/lib/player/scheduler";
import { SceneEngine, DEMO_SCENES } from "@/lib/player/scene-engine";
import { usePlayerConfig } from "@/lib/player/player-store";
import { VisualizerCanvas } from "@/components/player/VisualizerCanvas";
import { SettingsPanel } from "@/components/player/SettingsPanel";
import { SignageLayer } from "@/components/player/SignageLayer";

const PROGRAM_SYNC_INTERVAL_MS = 5 * 60_000;

const APP_VERSION = "0.1.0";

const STATE_LABEL: Record<PlayerState, string> = {
  idle: "Aguardando",
  connecting: "Conectando…",
  playing: "Ao Vivo",
  failover: "Failover…",
  emergency: "Modo Emergência",
  stopped: "Pausado",
};

const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  excellent: "Excelente",
  good: "Boa",
  fair: "Regular",
  poor: "Fraca",
  offline: "Offline",
};

export default function PlayerPage() {
  const { station, identity, visualizer, logoText, setVisualizer } = usePlayerConfig();

  const engineRef = useRef<FuseAudioEngine | null>(null);
  const schedulerRef = useRef<LocalScheduler | null>(null);
  const sceneEngineRef = useRef<SceneEngine | null>(null);

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [signage, setSignage] = useState<SignageItem[]>([]);

  // ---------------------------------------------------------------------
  // Engine + agendador + cenas (instanciados uma única vez no cliente)
  // ---------------------------------------------------------------------
  if (typeof window !== "undefined" && !engineRef.current) {
    engineRef.current = new FuseAudioEngine({
      ...station,
      corsProxyBase: process.env.NEXT_PUBLIC_API_URL || undefined,
    });
  }
  const engine = engineRef.current;

  useEffect(() => {
    engine?.updateConfig({
      ...station,
      corsProxyBase: process.env.NEXT_PUBLIC_API_URL || undefined,
    });
  }, [engine, station]);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(setSnapshot);
  }, [engine]);

  const showMessage = useCallback((text: string, durationSec: number) => {
    setMessage(text);
    setTimeout(() => setMessage(null), durationSec * 1000);
  }, []);

  const showCampaign = useCallback((imageUrl: string, durationSec: number) => {
    setCampaign(imageUrl);
    setTimeout(() => setCampaign(null), durationSec * 1000);
  }, []);

  const runScene = useCallback(
    (scene: Scene) => {
      if (!engine) return;
      if (!sceneEngineRef.current) {
        sceneEngineRef.current = new SceneEngine(engine, {
          setVisualizer,
          showMessage,
          showCampaign,
        });
      }
      void sceneEngineRef.current.run(scene);
    },
    [engine, setVisualizer, showMessage, showCampaign],
  );

  // Relógio LOCAL do dispositivo — pedra fundamental de toda a programação.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Uptime da sessão de reprodução.
  useEffect(() => {
    const t = setInterval(() => {
      const startedAt = engineRef.current?.snapshot().startedAt;
      setUptimeSec(startedAt ? (Date.now() - startedAt) / 1000 : 0);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Agendador local + heartbeat.
  useEffect(() => {
    if (!started || !engine) return;

    const scheduler = new LocalScheduler({
      onAnnouncement: (a) => {
        if (a.audioUrl) void engine.playAnnouncement(a.audioUrl);
        showMessage(`📢 ${a.label}`, 6);
      },
      onScene: (scene) => runScene(scene),
    });
    scheduler.setProgram({ announcements: [], events: [], scenes: DEMO_SCENES });
    scheduler.start();
    schedulerRef.current = scheduler;

    // Sincroniza a programação real da central (definições declarativas);
    // a EXECUÇÃO continua 100% no relógio local do dispositivo.
    const syncProgram = async () => {
      try {
        const program = await fetchStoreProgram(identity.code);
        if (!program) return;
        scheduler.setProgram({
          announcements: program.announcements,
          events: program.events,
          scenes: [...DEMO_SCENES, ...program.scenes],
        });
        setSignage(program.signage);
        setLastSync(new Date());
      } catch {
        /* mantém a última programação conhecida */
      }
    };
    void syncProgram();
    const programTimer = setInterval(syncProgram, PROGRAM_SYNC_INTERVAL_MS);

    const heartbeat = setInterval(() => {
      const snap = engine.snapshot();
      const payload = {
        storeCode: identity.code,
        deviceTime: new Date().toISOString(),
        appVersion: APP_VERSION,
        uptimeSec: snap.startedAt ? (Date.now() - snap.startedAt) / 1000 : 0,
        playerState: snap.state,
        streamUrl: snap.currentUrl,
        volume: snap.volume,
        quality: snap.quality,
        platform: "browser" as const,
      };
      const api = process.env.NEXT_PUBLIC_API_URL;
      if (api) {
        void fetch(`${api}/v1/fleet/heartbeats`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-device-key": process.env.NEXT_PUBLIC_DEVICE_KEY ?? "",
          },
          body: JSON.stringify(payload),
        }).catch(() => undefined);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Controle remoto: comandos da central via Socket.IO (no-op sem API).
    const disconnectRemote = connectRemoteControl({
      storeCode: identity.code,
      engine,
      runScene,
      showMessage,
    });

    return () => {
      scheduler.stop();
      clearInterval(heartbeat);
      clearInterval(programTimer);
      disconnectRemote();
    };
  }, [started, engine, identity.code, runScene, showMessage]);

  const handleStart = useCallback(async () => {
    setStarted(true);
    await engineRef.current?.start();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  // Atalhos de teclado: F tela cheia · V visualizador · S ajustes · ↑↓ volume · M mudo
  const muteMemory = useRef(0.9);
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const eng = engineRef.current;
      switch (e.key.toLowerCase()) {
        case "f":
          toggleFullscreen();
          break;
        case "v": {
          const idx = VISUALIZER_MODES.indexOf(visualizer);
          setVisualizer(VISUALIZER_MODES[(idx + 1) % VISUALIZER_MODES.length]);
          break;
        }
        case "s":
          setSettingsOpen((o) => !o);
          break;
        case "m": {
          if (!eng) break;
          const current = eng.getVolume();
          if (current > 0) {
            muteMemory.current = current;
            eng.setVolume(0, 0.2);
          } else {
            eng.setVolume(muteMemory.current || 0.9, 0.2);
          }
          break;
        }
        case "arrowup":
          e.preventDefault();
          eng?.setVolume(Math.min(1, (eng?.getVolume() ?? 0.9) + 0.05), 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          eng?.setVolume(Math.max(0, (eng?.getVolume() ?? 0.9) - 0.05), 0.1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, visualizer, setVisualizer, toggleFullscreen]);

  const state = snapshot?.state ?? "idle";
  const quality = snapshot?.quality ?? "offline";
  const isLive = state === "playing";
  const isEmergency = state === "emergency";

  const clock = useMemo(
    () =>
      now?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ??
      "--:--:--",
    [now],
  );
  const dateStr = useMemo(
    () =>
      now?.toLocaleDateString([], {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }) ?? "",
    [now],
  );

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-fuse-bg">
      {/* Visualizador em tela cheia */}
      {engine && <VisualizerCanvas engine={engine} mode={visualizer} />}

      {/* Gradiente de legibilidade */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />

      {/* ------------------------------------------------ Cabeçalho */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-between p-6 md:p-10">
        <div className="flex items-center gap-4">
          <div className="glass glow-primary flex h-14 w-14 items-center justify-center rounded-2xl">
            <span className="text-lg font-black tracking-tight text-gradient">{logoText}</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{station.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isLive
                    ? "bg-fuse-live/15 text-fuse-live"
                    : isEmergency
                      ? "bg-fuse-warn/15 text-fuse-warn"
                      : "bg-white/10 text-fuse-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isLive ? "animate-pulse-live bg-fuse-live" : isEmergency ? "bg-fuse-warn" : "bg-fuse-muted"
                  }`}
                />
                {STATE_LABEL[state]}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-light tabular-nums tracking-tight md:text-6xl">{clock}</div>
          <div className="mt-1 text-sm capitalize text-fuse-muted">{dateStr}</div>
        </div>
      </header>

      {/* ------------------------------------------------ Digital Signage */}
      {started && signage.length > 0 && <SignageLayer items={signage} />}

      {/* ------------------------------------------------ Mensagens de cena / avisos */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="glass absolute left-1/2 top-28 z-20 -translate-x-1/2 rounded-2xl px-8 py-4 text-center text-lg font-medium shadow-2xl md:text-xl"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {campaign && (
          <motion.img
            src={campaign}
            alt="Campanha"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-1/2 z-20 max-h-[60%] max-w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-3xl object-contain shadow-2xl"
          />
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ Banner de emergência */}
      <AnimatePresence>
        {isEmergency && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-full border border-fuse-warn/40 bg-fuse-warn/15 px-5 py-2 text-sm font-medium text-fuse-warn backdrop-blur-md"
          >
            ⚠ Transmissão indisponível — executando playlist local. Reconexão automática ativa.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ Rodapé */}
      <footer className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 md:p-10">
        <div>
          <div className="text-lg font-semibold md:text-xl">{identity.name}</div>
          <div className="text-sm text-fuse-muted">
            {identity.city}
            {identity.state ? `, ${identity.state}` : ""} · {identity.code}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill icon={quality === "offline" ? <WifiOff size={13} /> : <Wifi size={13} />}>
              Conexão {QUALITY_LABEL[quality]}
            </Pill>
            <Pill icon={<Activity size={13} />}>{formatUptime(uptimeSec)} conectado</Pill>
            <Pill icon={<Radio size={13} />}>
              Stream {snapshot ? snapshot.currentIndex + 1 : 1}/{station.endpoints.length}
            </Pill>
            <Pill
              icon={
                <span
                  className={`h-1.5 w-1.5 rounded-full ${lastSync ? "bg-fuse-live" : "bg-fuse-muted"}`}
                />
              }
            >
              {lastSync
                ? `Sync ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Sync pendente"}
            </Pill>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconButton label="Visualizador" onClick={() => {
            const idx = VISUALIZER_MODES.indexOf(visualizer);
            setVisualizer(VISUALIZER_MODES[(idx + 1) % VISUALIZER_MODES.length]);
          }}>
            <SlidersHorizontal size={17} />
          </IconButton>
          <IconButton label="Tela cheia" onClick={toggleFullscreen}>
            <Maximize2 size={17} />
          </IconButton>
          <IconButton label="Configurações" onClick={() => setSettingsOpen(true)}>
            <Settings size={17} />
          </IconButton>
        </div>
      </footer>

      {/* Etiqueta do modo de visualização */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-fuse-muted/70 md:block">
        {VISUALIZER_LABELS[visualizer]}
      </div>

      {/* ------------------------------------------------ Splash inicial */}
      <AnimatePresence>
        {!started && (
          <motion.div
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-fuse-bg"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center"
            >
              <div className="glass glow-primary animate-float flex h-24 w-24 items-center justify-center rounded-3xl">
                <span className="text-3xl font-black text-gradient">{logoText}</span>
              </div>
              <h1 className="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">
                {station.name}
              </h1>
              <p className="mt-2 text-fuse-muted">
                {identity.name} · {identity.city}
              </p>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className="glow-primary mt-10 flex items-center gap-3 rounded-full bg-fuse-primary px-10 py-4 text-lg font-semibold text-white transition-colors hover:bg-fuse-primary-soft"
              >
                <Play size={20} fill="currentColor" />
                Iniciar transmissão
              </motion.button>
              <p className="mt-6 max-w-xs text-center text-xs leading-relaxed text-fuse-muted/70">
                Failover automático entre {station.endpoints.length} streams · programação no
                horário local do dispositivo
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ Painel de configurações */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        engine={engine}
        onRunScene={runScene}
      />

      {/* Volume flutuante (canto) */}
      {started && engine && (
        <div className="glass absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 rounded-full px-3 py-5 md:flex">
          <Volume2 size={15} className="text-fuse-muted" />
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={Math.round((snapshot?.volume ?? 0.9) * 100)}
            onChange={(e) => engine.setVolume(Number(e.target.value) / 100)}
            className="h-28 w-1.5 cursor-pointer appearance-none rounded-full bg-white/15 accent-fuse-primary"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
            aria-label="Volume"
          />
        </div>
      )}
    </main>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-fuse-text/85">
      {icon}
      {children}
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="glass flex h-11 w-11 items-center justify-center rounded-full text-fuse-text/80 transition-all hover:scale-105 hover:text-white"
    >
      {children}
    </button>
  );
}
