"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { VISUALIZER_LABELS, VISUALIZER_MODES, type Scene } from "@fuse/shared";
import type { FuseAudioEngine } from "@/lib/player/audio-engine";
import { DEMO_SCENES } from "@/lib/player/scene-engine";
import { usePlayerConfig } from "@/lib/player/player-store";

interface Props {
  open: boolean;
  onClose: () => void;
  engine: FuseAudioEngine | null;
  onRunScene: (scene: Scene) => void;
}

/** Painel lateral de configuração local do player (streams, identidade, cenas). */
export function SettingsPanel({ open, onClose, engine, onRunScene }: Props) {
  const { station, identity, visualizer, setStation, setIdentity, setVisualizer } =
    usePlayerConfig();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute right-0 top-0 z-50 flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto border-l border-fuse-border bg-fuse-surface p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Configurações do Player</h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-full p-2 text-fuse-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Identidade da loja */}
            <Section title="Identidade da loja">
              <Field
                label="Código"
                value={identity.code}
                onChange={(v) => setIdentity({ code: v })}
              />
              <Field label="Nome" value={identity.name} onChange={(v) => setIdentity({ name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Cidade"
                  value={identity.city}
                  onChange={(v) => setIdentity({ city: v })}
                />
                <Field
                  label="UF"
                  value={identity.state ?? ""}
                  onChange={(v) => setIdentity({ state: v })}
                />
              </div>
            </Section>

            {/* Streams com prioridade de failover */}
            <Section title="Streams (ordem de failover)">
              {station.endpoints.map((url, i) => (
                <Field
                  key={i}
                  label={i === 0 ? "Principal" : i === 1 ? "Secundário" : `Alternativo ${i}`}
                  value={url}
                  mono
                  onChange={(v) => {
                    const endpoints = [...station.endpoints];
                    endpoints[i] = v;
                    setStation({ endpoints });
                  }}
                />
              ))}
              <div className="flex gap-2">
                <button
                  onClick={() => setStation({ endpoints: [...station.endpoints, ""] })}
                  className="rounded-lg border border-fuse-border px-3 py-1.5 text-xs text-fuse-muted transition-colors hover:text-white"
                >
                  + Adicionar stream
                </button>
                {engine &&
                  station.endpoints.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => void engine.switchTo(i)}
                      className="rounded-lg border border-fuse-border px-3 py-1.5 text-xs text-fuse-muted transition-colors hover:border-fuse-primary hover:text-white"
                    >
                      Usar {i + 1}
                    </button>
                  ))}
              </div>
            </Section>

            {/* Visualizador */}
            <Section title="Visualizador">
              <div className="grid grid-cols-2 gap-2">
                {VISUALIZER_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVisualizer(mode)}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      visualizer === mode
                        ? "border-fuse-primary bg-fuse-primary/15 text-white"
                        : "border-fuse-border text-fuse-muted hover:border-fuse-primary/50 hover:text-white"
                    }`}
                  >
                    {VISUALIZER_LABELS[mode]}
                  </button>
                ))}
              </div>
            </Section>

            {/* Cenas operacionais */}
            <Section title="Cenas operacionais (teste)">
              <div className="flex flex-col gap-2">
                {DEMO_SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => {
                      onRunScene(scene);
                      onClose();
                    }}
                    className="rounded-xl border border-fuse-border px-4 py-3 text-left transition-colors hover:border-fuse-primary/60"
                  >
                    <div className="text-sm font-medium">{scene.name}</div>
                    <div className="mt-0.5 text-xs text-fuse-muted">{scene.description}</div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Diagnóstico */}
            {engine && (
              <Section title="Diagnóstico">
                <button
                  onClick={() => void engine.restart()}
                  className="rounded-xl border border-fuse-border px-4 py-2.5 text-sm text-fuse-muted transition-colors hover:border-fuse-warn hover:text-fuse-warn"
                >
                  Reiniciar player
                </button>
              </Section>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-fuse-muted">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-fuse-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-fuse-border bg-fuse-card px-3 py-2 text-sm outline-none transition-colors focus:border-fuse-primary ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </label>
  );
}
