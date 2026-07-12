"use client";

import { io, type Socket } from "socket.io-client";
import type { RemoteCommand, Scene } from "@fuse/shared";
import { API_URL, apiConfigured } from "@/lib/api";
import type { FuseAudioEngine } from "./audio-engine";
import { DEMO_SCENES } from "./scene-engine";

export interface RemoteControlHandlers {
  storeCode: string;
  engine: FuseAudioEngine;
  runScene: (scene: Scene) => void;
  showMessage: (text: string, durationSec: number) => void;
}

/**
 * Conecta o player ao canal realtime da API e executa comandos remotos
 * enviados pelo suporte (sala `store:<code>`), confirmando com `command:ack`.
 * Sem API configurada, é um no-op.
 */
export function connectRemoteControl(h: RemoteControlHandlers): () => void {
  if (!apiConfigured) return () => undefined;

  const socket: Socket = io(`${API_URL}/realtime`, {
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 15_000,
  });

  socket.on("connect", () => {
    socket.emit("player:join", { storeCode: h.storeCode });
  });

  socket.on("remote-command", async (command: RemoteCommand) => {
    let ok = true;
    let detail: string | undefined;
    try {
      await execute(command, h);
    } catch (err) {
      ok = false;
      detail = err instanceof Error ? err.message : "erro desconhecido";
    }
    socket.emit("command:ack", {
      commandId: command.id,
      storeCode: h.storeCode,
      ok,
      detail,
      at: new Date().toISOString(),
    });
  });

  return () => {
    socket.disconnect();
  };
}

async function execute(command: RemoteCommand, h: RemoteControlHandlers): Promise<void> {
  const payload = (command.payload ?? {}) as Record<string, unknown>;

  switch (command.type) {
    case "restart-player":
      h.showMessage("🔄 Reinício solicitado pelo suporte", 4);
      await h.engine.restart();
      return;

    case "switch-stream": {
      const index = typeof payload.index === "number" ? payload.index : 1;
      await h.engine.switchTo(index);
      h.showMessage(`📡 Stream alterado para o endpoint ${index + 1}`, 4);
      return;
    }

    case "set-volume": {
      const volume = typeof payload.volume === "number" ? payload.volume : 0.9;
      h.engine.setVolume(Math.min(1, Math.max(0, volume)), 1);
      return;
    }

    case "announce-now": {
      const url = typeof payload.audioUrl === "string" ? payload.audioUrl : "";
      const label = typeof payload.label === "string" ? payload.label : "Aviso da central";
      h.showMessage(`📢 ${label}`, 6);
      if (url) await h.engine.playAnnouncement(url);
      return;
    }

    case "audio-test":
      h.showMessage("🔊 Teste de áudio em execução", 3);
      h.engine.audioTest();
      return;

    case "run-scene": {
      const sceneId = typeof payload.sceneId === "string" ? payload.sceneId : "";
      const scene = DEMO_SCENES.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`cena desconhecida: ${sceneId}`);
      h.runScene(scene);
      return;
    }

    case "clear-cache":
      h.showMessage("🧹 Limpando cache e recarregando…", 3);
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setTimeout(() => window.location.reload(), 1500);
      return;

    case "update-version":
      h.showMessage("⬆ Atualização solicitada — recarregando", 3);
      setTimeout(() => window.location.reload(), 1500);
      return;

    case "update-theme":
      h.showMessage("🎨 Tema atualizado pela central", 4);
      return;

    case "open-diagnostics": {
      const snap = h.engine.snapshot();
      h.showMessage(
        `🩺 ${snap.state} · stream ${snap.currentIndex + 1} · qualidade ${snap.quality} · vol ${Math.round(snap.volume * 100)}%`,
        8,
      );
      return;
    }
  }
}
