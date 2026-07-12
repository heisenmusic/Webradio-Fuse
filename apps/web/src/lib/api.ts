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
