"use client";

import type { FleetStoreStatus } from "@fuse/shared";

/**
 * Cliente da API Fuse Radio Enterprise (browser).
 * Quando NEXT_PUBLIC_API_URL não está definido, a aplicação
 * opera em modo demonstração (frota simulada, sem login).
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const apiConfigured = API_URL.length > 0;

const TOKEN_KEY = "fuse-auth";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export function getAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<StoredAuth> {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Falha no login (${res.status})`);
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  const auth: StoredAuth = { ...data, email };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(auth));
  return auth;
}

/** Fetch autenticado com renovação automática do access token (rotação de refresh). */
async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = getAuth();
  if (!auth) throw new Error("not-authenticated");

  const doFetch = (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${token}` },
    });

  let res = await doFetch(auth.accessToken);
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });
    if (!refreshed.ok) {
      clearAuth();
      throw new Error("not-authenticated");
    }
    const data = (await refreshed.json()) as { accessToken: string; refreshToken: string };
    const next: StoredAuth = { ...data, email: auth.email };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    res = await doFetch(next.accessToken);
  }
  return res;
}

export interface FleetStatusResponse {
  totals: {
    stores: number;
    online: number;
    offline: number;
    degraded: number;
    noAudio: number;
    highLatency: number;
    outOfSync: number;
  };
  stores: Array<FleetStoreStatus & { lastHeartbeat?: unknown }>;
}

export async function fetchFleetStatus(): Promise<FleetStatusResponse> {
  const res = await authedFetch("/v1/fleet/status");
  if (!res.ok) throw new Error(`Erro ao carregar frota (${res.status})`);
  return (await res.json()) as FleetStatusResponse;
}

export async function sendStoreCommand(
  storeId: string,
  type: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const res = await authedFetch(`/v1/stores/${storeId}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar comando (${res.status})`);
}

// ---------------------------------------------------------------------------
// CRUD de gestão (avisos, cenas, lojas, mídia, signage)
// ---------------------------------------------------------------------------

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join("; ") : body?.message;
    throw new Error(msg ?? `Erro ${res.status}`);
  }
  return (await res.json()) as T;
}

const jsonHeaders = { "content-type": "application/json" };

export interface MediaAssetDto {
  id: string;
  kind: "AUDIO" | "IMAGE" | "VIDEO";
  name: string;
  url: string;
  mime?: string;
  sizeBytes?: number;
  createdAt: string;
}

export async function uploadMedia(file: File): Promise<MediaAssetDto> {
  const form = new FormData();
  form.append("file", file);
  return json(await authedFetch("/v1/media", { method: "POST", body: form }));
}

export async function listMedia(kind?: "AUDIO" | "IMAGE" | "VIDEO"): Promise<MediaAssetDto[]> {
  return json(await authedFetch(`/v1/media${kind ? `?kind=${kind}` : ""}`));
}

export interface AnnouncementDto {
  id: string;
  label: string;
  time: string;
  daysOfWeek: number[];
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  category?: string | null;
  repeatEveryMin?: number | null;
  asset: MediaAssetDto;
}

export async function listAnnouncements(): Promise<AnnouncementDto[]> {
  return json(await authedFetch("/v1/announcements"));
}

export async function createAnnouncement(data: {
  assetId: string;
  label: string;
  time: string;
  daysOfWeek: number[];
  priority?: string;
  category?: string;
  repeatEveryMin?: number;
}): Promise<AnnouncementDto> {
  return json(
    await authedFetch("/v1/announcements", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await json(await authedFetch(`/v1/announcements/${id}`, { method: "DELETE" }));
}

export interface SceneDto {
  id: string;
  name: string;
  description?: string | null;
  actions: unknown[];
  events: EventDto[];
}

export interface EventDto {
  id: string;
  kind: string;
  label: string;
  time: string;
  daysOfWeek: number[];
  sceneId: string;
}

export async function listScenes(): Promise<SceneDto[]> {
  return json(await authedFetch("/v1/scenes"));
}

export async function createScene(data: {
  name: string;
  description?: string;
  actions: unknown[];
}): Promise<SceneDto> {
  return json(
    await authedFetch("/v1/scenes", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  );
}

export async function createEvent(data: {
  sceneId: string;
  kind: string;
  label: string;
  time: string;
  daysOfWeek: number[];
}): Promise<EventDto> {
  return json(
    await authedFetch("/v1/scenes/events", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteScene(id: string): Promise<void> {
  await json(await authedFetch(`/v1/scenes/${id}`, { method: "DELETE" }));
}

export interface StoreDto {
  id: string;
  code: string;
  name: string;
  city: string;
  state?: string | null;
  timezone: string;
  health: string;
  brand?: { name: string } | null;
  group?: { name: string } | null;
}

export async function listStores(): Promise<StoreDto[]> {
  return json(await authedFetch("/v1/stores"));
}

export async function createStore(data: {
  tenantId: string;
  code: string;
  name: string;
  city: string;
  state?: string;
  timezone?: string;
  lat?: number;
  lng?: number;
}): Promise<StoreDto> {
  return json(
    await authedFetch("/v1/stores", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  );
}

export interface SignageDto {
  id: string;
  kind: string;
  title: string;
  assetUrl?: string | null;
  body?: string | null;
  durationSec: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function listSignage(): Promise<SignageDto[]> {
  return json(await authedFetch("/v1/signage"));
}

export async function createSignage(data: {
  kind: string;
  title: string;
  assetUrl?: string;
  body?: string;
  durationSec?: number;
  startsAt?: string;
  endsAt?: string;
}): Promise<SignageDto> {
  return json(
    await authedFetch("/v1/signage", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteSignage(id: string): Promise<void> {
  await json(await authedFetch(`/v1/signage/${id}`, { method: "DELETE" }));
}

/** Resolve URLs relativas de mídia (ex.: /uploads/x.mp3) contra a API. */
export function mediaUrl(url: string): string {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/** tenantId do usuário logado (extraído do JWT, sem verificação — apenas UI). */
export function currentTenantId(): string | null {
  const auth = getAuth();
  if (!auth) return null;
  try {
    const payload = JSON.parse(atob(auth.accessToken.split(".")[1])) as { tenantId?: string };
    return payload.tenantId ?? null;
  } catch {
    return null;
  }
}
