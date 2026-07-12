"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_STREAM_ENDPOINTS,
  type StationConfig,
  type StoreIdentity,
  type VisualizerMode,
} from "@fuse/shared";

/** Configuração local do Player da Loja (persistida no dispositivo). */
interface PlayerConfigState {
  station: StationConfig;
  identity: StoreIdentity;
  visualizer: VisualizerMode;
  logoText: string;
  setStation: (station: Partial<StationConfig>) => void;
  setIdentity: (identity: Partial<StoreIdentity>) => void;
  setVisualizer: (mode: VisualizerMode) => void;
  setLogoText: (text: string) => void;
}

export const usePlayerConfig = create<PlayerConfigState>()(
  persist(
    (set) => ({
      station: {
        name: "Fuse Radio",
        endpoints: [...DEFAULT_STREAM_ENDPOINTS],
        emergencyPlaylist: [],
        primaryProbeIntervalMs: 30_000,
      },
      identity: {
        code: "LOJA-001",
        name: "Loja Matriz",
        city: "São Paulo",
        state: "SP",
        country: "BR",
      },
      visualizer: "premium",
      logoText: "FUSE",
      setStation: (station) =>
        set((s) => ({ station: { ...s.station, ...station } })),
      setIdentity: (identity) =>
        set((s) => ({ identity: { ...s.identity, ...identity } })),
      setVisualizer: (visualizer) => set({ visualizer }),
      setLogoText: (logoText) => set({ logoText }),
    }),
    { name: "fuse-player-config" },
  ),
);
