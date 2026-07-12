"use client";

import {
  announcementDueKey,
  type OperationalEvent,
  type Scene,
  type ScheduledAnnouncement,
} from "@fuse/shared";

/**
 * LocalScheduler — executa avisos e eventos operacionais usando
 * EXCLUSIVAMENTE o relógio do dispositivo da loja (new Date()).
 *
 * O servidor apenas distribui as definições ("toca às 08:00");
 * cada loja dispara às 08:00 no SEU fuso: São Paulo, Manaus,
 * Lisboa e Nova York executam de forma independente.
 */

export interface SchedulerHandlers {
  onAnnouncement: (a: ScheduledAnnouncement) => void;
  onScene: (scene: Scene, event: OperationalEvent) => void;
  onTick?: (deviceNow: Date) => void;
}

export class LocalScheduler {
  private announcements: ScheduledAnnouncement[] = [];
  private events: OperationalEvent[] = [];
  private scenes = new Map<string, Scene>();
  private firedKeys = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers: SchedulerHandlers;
  public lastSyncAt: Date | null = null;

  constructor(handlers: SchedulerHandlers) {
    this.handlers = handlers;
  }

  setProgram(input: {
    announcements: ScheduledAnnouncement[];
    events: OperationalEvent[];
    scenes: Scene[];
  }) {
    this.announcements = input.announcements;
    this.events = input.events;
    this.scenes = new Map(input.scenes.map((s) => [s.id, s]));
    this.lastSyncAt = new Date();
  }

  start() {
    if (this.timer) return;
    // Checagem a cada 5s garante disparo dentro do minuto correto.
    this.timer = setInterval(() => this.tick(), 5_000);
    this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick() {
    const now = new Date(); // relógio LOCAL do dispositivo — nunca do servidor
    this.handlers.onTick?.(now);

    for (const a of this.announcements) {
      const key = announcementDueKey(a, now);
      if (key && !this.firedKeys.has(key)) {
        this.firedKeys.add(key);
        this.handlers.onAnnouncement(a);
      }
    }

    for (const e of this.events) {
      const pseudo: ScheduledAnnouncement = {
        id: `event:${e.id}`,
        label: e.label,
        audioUrl: "",
        time: e.time,
        daysOfWeek: e.daysOfWeek,
        priority: "normal",
      };
      const key = announcementDueKey(pseudo, now);
      if (key && !this.firedKeys.has(key)) {
        this.firedKeys.add(key);
        const scene = this.scenes.get(e.sceneId);
        if (scene) this.handlers.onScene(scene, e);
      }
    }

    // Evita crescimento sem limite (mantém apenas o dia corrente).
    if (this.firedKeys.size > 5_000) this.firedKeys.clear();
  }
}
