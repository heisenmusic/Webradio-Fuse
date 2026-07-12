"use client";

import type { Scene, SceneAction, VisualizerMode } from "@fuse/shared";
import type { FuseAudioEngine } from "./audio-engine";

/**
 * SceneEngine — motor de automação operacional.
 * Executa as ações de uma cena em sequência: vinhetas, rampas de volume,
 * troca de visualizador, mensagens e campanhas em tela.
 */

export interface SceneUiHandlers {
  setVisualizer: (mode: VisualizerMode) => void;
  showMessage: (text: string, durationSec: number) => void;
  showCampaign: (imageUrl: string, durationSec: number) => void;
}

export class SceneEngine {
  private running = false;

  constructor(
    private readonly audio: FuseAudioEngine,
    private readonly ui: SceneUiHandlers,
  ) {}

  get isRunning() {
    return this.running;
  }

  async run(scene: Scene): Promise<void> {
    if (this.running) return; // uma cena por vez
    this.running = true;
    try {
      for (const action of scene.actions) {
        await this.execute(action);
      }
    } finally {
      this.running = false;
    }
  }

  private async execute(action: SceneAction): Promise<void> {
    switch (action.type) {
      case "play-jingle":
        await this.audio.playAnnouncement(action.audioUrl);
        return;
      case "set-volume":
        this.audio.setVolume(action.to, action.rampSec ?? 1.5);
        return;
      case "set-visualizer":
        this.ui.setVisualizer(action.mode);
        return;
      case "show-message":
        this.ui.showMessage(action.text, action.durationSec);
        return;
      case "show-campaign":
        this.ui.showCampaign(action.imageUrl, action.durationSec);
        return;
      case "wait":
        await new Promise((r) => setTimeout(r, action.seconds * 1000));
        return;
    }
  }
}

/** Cenas de demonstração embarcadas no player. */
export const DEMO_SCENES: Scene[] = [
  {
    id: "scene-opening",
    name: "Abertura",
    description: "Início do dia: volume sobe e campanha do dia em tela.",
    actions: [
      { type: "set-visualizer", mode: "premium" },
      { type: "set-volume", to: 0.9, rampSec: 3 },
      { type: "show-message", text: "Bom dia! Loja aberta — boas vendas! 🌅", durationSec: 8 },
    ],
  },
  {
    id: "scene-closing",
    name: "Fechamento",
    description: "Encerramento: aviso, volume desce e mensagem final.",
    actions: [
      { type: "show-message", text: "A loja encerra em instantes. Obrigado pela visita!", durationSec: 10 },
      { type: "set-volume", to: 0.35, rampSec: 6 },
      { type: "set-visualizer", mode: "ambient" },
    ],
  },
  {
    id: "scene-promo",
    name: "Promoção",
    description: "Momento promocional com destaque visual.",
    actions: [
      { type: "set-visualizer", mode: "neon" },
      { type: "set-volume", to: 1, rampSec: 2 },
      { type: "show-message", text: "⚡ Oferta relâmpago ativa nas próximas horas!", durationSec: 12 },
    ],
  },
];
