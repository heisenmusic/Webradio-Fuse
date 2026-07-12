"use client";

import type {
  OperationalEvent,
  OperationalEventKind,
  Scene,
  ScheduledAnnouncement,
  SignageItem,
} from "@fuse/shared";
import { API_URL, apiConfigured, mediaUrl } from "@/lib/api";

/**
 * Sincronização da programação da loja com a central.
 *
 * O servidor entrega DEFINIÇÕES declarativas ("toca às 08:00, seg–sex");
 * a execução acontece exclusivamente no relógio local do dispositivo,
 * via LocalScheduler. Este módulo apenas busca e normaliza os dados.
 */

export interface StoreProgram {
  announcements: ScheduledAnnouncement[];
  events: OperationalEvent[];
  scenes: Scene[];
  signage: SignageItem[];
}

const KIND_MAP: Record<string, OperationalEventKind> = {
  OPENING: "opening",
  LUNCH: "lunch",
  PROMOTION: "promotion",
  SHIFT_CHANGE: "shift-change",
  CLOSING: "closing",
  CLEANING: "cleaning",
  INVENTORY: "inventory",
  CAMPAIGN: "campaign",
  CUSTOM: "custom",
};

interface ApiSchedule {
  announcements: Array<{
    id: string;
    label: string;
    time: string;
    daysOfWeek: number[];
    priority: string;
    category?: string | null;
    repeatEveryMin?: number | null;
    asset: { url: string };
  }>;
  events: Array<{
    id: string;
    kind: string;
    label: string;
    time: string;
    daysOfWeek: number[];
    sceneId: string;
    scene: { id: string; name: string; description?: string | null; actions: unknown };
  }>;
  signage: Array<{
    id: string;
    kind: string;
    title: string;
    assetUrl?: string | null;
    body?: string | null;
    durationSec: number;
    startsAt?: string | null;
    endsAt?: string | null;
  }>;
}

export async function fetchStoreProgram(storeCode: string): Promise<StoreProgram | null> {
  if (!apiConfigured) return null;
  const res = await fetch(
    `${API_URL}/v1/announcements/schedule/${encodeURIComponent(storeCode)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as ApiSchedule;

  const announcements: ScheduledAnnouncement[] = data.announcements.map((a) => ({
    id: a.id,
    label: a.label,
    audioUrl: mediaUrl(a.asset.url),
    time: a.time,
    daysOfWeek: a.daysOfWeek ?? [],
    priority: (a.priority?.toLowerCase() ?? "normal") as ScheduledAnnouncement["priority"],
    category: a.category ?? undefined,
    repeatEveryMin: a.repeatEveryMin ?? undefined,
  }));

  const scenesById = new Map<string, Scene>();
  const events: OperationalEvent[] = data.events.map((e) => {
    scenesById.set(e.scene.id, {
      id: e.scene.id,
      name: e.scene.name,
      description: e.scene.description ?? undefined,
      actions: (Array.isArray(e.scene.actions) ? e.scene.actions : []) as Scene["actions"],
    });
    return {
      id: e.id,
      kind: KIND_MAP[e.kind] ?? "custom",
      label: e.label,
      time: e.time,
      daysOfWeek: e.daysOfWeek ?? [],
      sceneId: e.sceneId,
    };
  });

  const signage: SignageItem[] = data.signage.map((s) => ({
    id: s.id,
    kind: s.kind.toLowerCase().replace(/_/g, "-") as SignageItem["kind"],
    title: s.title,
    assetUrl: s.assetUrl ? mediaUrl(s.assetUrl) : undefined,
    body: s.body ?? undefined,
    durationSec: s.durationSec,
    startsAt: s.startsAt ?? undefined,
    endsAt: s.endsAt ?? undefined,
  }));

  return { announcements, events, scenes: [...scenesById.values()], signage };
}
