import type { FleetHealth, FleetStoreStatus } from "@fuse/shared";

/**
 * Frota de demonstração para o dashboard (determinística).
 * Em produção, estes dados vêm de GET /v1/fleet/status + Socket.IO.
 */

const CITIES: Array<{ city: string; state: string; lat: number; lng: number }> = [
  { city: "São Paulo", state: "SP", lat: -23.55, lng: -46.63 },
  { city: "Campinas", state: "SP", lat: -22.9, lng: -47.06 },
  { city: "Rio de Janeiro", state: "RJ", lat: -22.9, lng: -43.2 },
  { city: "Belo Horizonte", state: "MG", lat: -19.92, lng: -43.94 },
  { city: "Curitiba", state: "PR", lat: -25.43, lng: -49.27 },
  { city: "Porto Alegre", state: "RS", lat: -30.03, lng: -51.23 },
  { city: "Salvador", state: "BA", lat: -12.97, lng: -38.5 },
  { city: "Recife", state: "PE", lat: -8.05, lng: -34.9 },
  { city: "Fortaleza", state: "CE", lat: -3.73, lng: -38.52 },
  { city: "Manaus", state: "AM", lat: -3.12, lng: -60.02 },
  { city: "Brasília", state: "DF", lat: -15.79, lng: -47.88 },
  { city: "Goiânia", state: "GO", lat: -16.68, lng: -49.25 },
];

const BRANDS = ["Fuse Store", "Fuse Express", "Fuse Prime"];
const GROUPS = ["Sudeste", "Sul", "Nordeste", "Norte", "Centro-Oeste"];

const HEALTH_DIST: FleetHealth[] = [
  ...Array<FleetHealth>(34).fill("online"),
  "offline",
  "offline",
  "degraded",
  "no-audio",
  "high-latency",
  "out-of-sync",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMockFleet(count = 48): FleetStoreStatus[] {
  const rand = mulberry32(42);
  return Array.from({ length: count }, (_, i) => {
    const loc = CITIES[Math.floor(rand() * CITIES.length)];
    const health = HEALTH_DIST[Math.floor(rand() * HEALTH_DIST.length)];
    const code = `LJ-${String(i + 1).padStart(4, "0")}`;
    return {
      storeId: `store-${i}`,
      storeCode: code,
      name: `Loja ${loc.city} ${String(i + 1).padStart(2, "0")}`,
      city: loc.city,
      state: loc.state,
      brand: BRANDS[Math.floor(rand() * BRANDS.length)],
      group: GROUPS[Math.floor(rand() * GROUPS.length)],
      tenant: "Fuse Varejo S.A.",
      health,
      lat: loc.lat + (rand() - 0.5) * 0.6,
      lng: loc.lng + (rand() - 0.5) * 0.6,
      lastSeenAt:
        health === "offline"
          ? new Date(Date.now() - (10 + rand() * 300) * 60_000).toISOString()
          : new Date(Date.now() - rand() * 30_000).toISOString(),
    };
  });
}

export const HEALTH_META: Record<
  FleetHealth,
  { label: string; color: string; dot: string }
> = {
  online: { label: "Online", color: "text-fuse-live", dot: "bg-fuse-live" },
  offline: { label: "Offline", color: "text-fuse-danger", dot: "bg-fuse-danger" },
  degraded: { label: "Com falha", color: "text-fuse-warn", dot: "bg-fuse-warn" },
  "no-audio": { label: "Sem áudio", color: "text-orange-400", dot: "bg-orange-400" },
  "high-latency": { label: "Latência alta", color: "text-yellow-300", dot: "bg-yellow-300" },
  "out-of-sync": { label: "Sem sincronização", color: "text-purple-300", dot: "bg-purple-300" },
};
