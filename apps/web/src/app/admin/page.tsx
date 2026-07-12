"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  LogOut,
  MapPin,
  MonitorSpeaker,
  Power,
  RefreshCcw,
  Search,
  Volume2,
} from "lucide-react";
import type { FleetHealth, FleetStoreStatus } from "@fuse/shared";
import { buildMockFleet, HEALTH_META } from "@/lib/admin/mock-fleet";
import { apiConfigured, clearAuth, fetchFleetStatus, getAuth } from "@/lib/api";

/**
 * Dashboard Operacional — visão em tempo real da frota de lojas.
 * Com NEXT_PUBLIC_API_URL definido consome GET /v1/fleet/status (com login);
 * sem API configurada opera em modo demonstração com frota simulada.
 */
export default function AdminPage() {
  const router = useRouter();
  const [fleet, setFleet] = useState<FleetStoreStatus[]>([]);
  const [mode, setMode] = useState<"loading" | "demo" | "live">("loading");

  useEffect(() => {
    if (!apiConfigured) {
      setFleet(buildMockFleet());
      setMode("demo");
      return;
    }
    if (!getAuth()) {
      router.replace("/admin/login");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const status = await fetchFleetStatus();
        if (cancelled) return;
        setFleet(status.stores);
        setMode("live");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "not-authenticated") {
          router.replace("/admin/login");
        }
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);
  const [healthFilter, setHealthFilter] = useState<FleetHealth | "all">("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FleetStoreStatus | null>(null);

  const states = useMemo(() => [...new Set(fleet.map((s) => s.state ?? ""))].sort(), [fleet]);
  const groups = useMemo(() => [...new Set(fleet.map((s) => s.group ?? ""))].sort(), [fleet]);
  const brands = useMemo(() => [...new Set(fleet.map((s) => s.brand ?? ""))].sort(), [fleet]);

  const filtered = useMemo(
    () =>
      fleet.filter(
        (s) =>
          (healthFilter === "all" || s.health === healthFilter) &&
          (stateFilter === "all" || s.state === stateFilter) &&
          (groupFilter === "all" || s.group === groupFilter) &&
          (brandFilter === "all" || s.brand === brandFilter) &&
          (query === "" ||
            `${s.name} ${s.city} ${s.storeCode}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [fleet, healthFilter, stateFilter, groupFilter, brandFilter, query],
  );

  const counts = useMemo(() => {
    const c = { total: fleet.length } as Record<string, number>;
    for (const h of Object.keys(HEALTH_META) as FleetHealth[]) {
      c[h] = fleet.filter((s) => s.health === h).length;
    }
    return c;
  }, [fleet]);

  return (
    <main className="min-h-dvh bg-fuse-bg px-4 py-6 md:px-8">
      {/* Cabeçalho */}
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="glass flex h-10 w-10 items-center justify-center rounded-full text-fuse-muted hover:text-white"
            aria-label="Voltar"
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Dashboard Operacional
            </h1>
            <p className="text-sm text-fuse-muted">Fuse Varejo S.A. · frota em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm text-fuse-muted md:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                mode === "live" ? "animate-pulse-live bg-fuse-live" : "bg-fuse-warn"
              }`}
            />
            {mode === "live" ? "Conectado à API" : "Modo demonstração"}
          </span>
          {mode === "live" && (
            <button
              onClick={() => {
                clearAuth();
                router.replace("/admin/login");
              }}
              aria-label="Sair"
              title="Sair"
              className="glass flex h-10 w-10 items-center justify-center rounded-full text-fuse-muted hover:text-white"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Cards de status */}
      <section className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard
          label="Total de lojas"
          value={counts.total}
          active={healthFilter === "all"}
          onClick={() => setHealthFilter("all")}
        />
        {(Object.keys(HEALTH_META) as FleetHealth[]).map((h) => (
          <StatCard
            key={h}
            label={HEALTH_META[h].label}
            value={counts[h] ?? 0}
            colorClass={HEALTH_META[h].color}
            active={healthFilter === h}
            onClick={() => setHealthFilter(healthFilter === h ? "all" : h)}
          />
        ))}
      </section>

      <div className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* Filtros */}
          <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <div className="flex min-w-52 flex-1 items-center gap-2 rounded-xl bg-fuse-card px-3 py-2">
              <Search size={15} className="text-fuse-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar loja, cidade ou código…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-fuse-muted/60"
              />
            </div>
            <FilterSelect
              value={stateFilter}
              onChange={setStateFilter}
              options={states}
              placeholder="Estado"
            />
            <FilterSelect
              value={groupFilter}
              onChange={setGroupFilter}
              options={groups}
              placeholder="Grupo"
            />
            <FilterSelect
              value={brandFilter}
              onChange={setBrandFilter}
              options={brands}
              placeholder="Marca"
            />
          </div>

          {/* Tabela de lojas */}
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fuse-border text-left text-xs uppercase tracking-wider text-fuse-muted">
                  <th className="px-4 py-3 font-medium">Loja</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Cidade</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Marca · Grupo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Último sinal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.storeId}
                    onClick={() => setSelected(s)}
                    className={`cursor-pointer border-b border-fuse-border/40 transition-colors hover:bg-white/[0.03] ${
                      selected?.storeId === s.storeId ? "bg-fuse-primary/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-fuse-muted">{s.storeCode}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-fuse-muted md:table-cell">
                      {s.city}, {s.state}
                    </td>
                    <td className="hidden px-4 py-3 text-fuse-muted lg:table-cell">
                      {s.brand} · {s.group}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 ${HEALTH_META[s.health].color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_META[s.health].dot}`} />
                        {HEALTH_META[s.health].label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-fuse-muted sm:table-cell">
                      {timeAgo(s.lastSeenAt)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-fuse-muted">
                      Nenhuma loja encontrada com estes filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna direita: mapa + detalhe */}
        <div className="flex flex-col gap-4">
          <FleetMap fleet={filtered} selected={selected} onSelect={setSelected} />
          {selected && <StoreDetail store={selected} live={mode === "live"} />}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  colorClass,
  active,
  onClick,
}: {
  label: string;
  value: number;
  colorClass?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`glass rounded-2xl p-4 text-left transition-colors ${
        active ? "border-fuse-primary/60" : ""
      }`}
    >
      <div className={`text-2xl font-semibold tabular-nums ${colorClass ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs text-fuse-muted">{label}</div>
    </motion.button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-fuse-border bg-fuse-card px-3 py-2 text-sm text-fuse-text outline-none focus:border-fuse-primary"
    >
      <option value="all">{placeholder}: todos</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Mapa da frota — projeção simples lat/lng do território brasileiro. */
function FleetMap({
  fleet,
  selected,
  onSelect,
}: {
  fleet: FleetStoreStatus[];
  selected: FleetStoreStatus | null;
  onSelect: (s: FleetStoreStatus) => void;
}) {
  // Bounding box aproximado do Brasil
  const LAT = { min: -34, max: 5.5 };
  const LNG = { min: -74, max: -34 };
  const px = (lng: number) => ((lng - LNG.min) / (LNG.max - LNG.min)) * 100;
  const py = (lat: number) => (1 - (lat - LAT.min) / (LAT.max - LAT.min)) * 100;

  return (
    <div className="glass relative aspect-square overflow-hidden rounded-2xl">
      <div className="absolute left-4 top-4 flex items-center gap-2 text-xs text-fuse-muted">
        <MapPin size={13} />
        Mapa da frota
      </div>
      {fleet.map(
        (s) =>
          s.lat != null &&
          s.lng != null && (
            <button
              key={s.storeId}
              onClick={() => onSelect(s)}
              title={`${s.name} — ${HEALTH_META[s.health].label}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
                HEALTH_META[s.health].dot
              } ${
                selected?.storeId === s.storeId
                  ? "h-4 w-4 ring-4 ring-white/30"
                  : "h-2.5 w-2.5 hover:scale-150"
              } ${s.health === "online" ? "opacity-80" : "animate-pulse"}`}
              style={{ left: `${px(s.lng)}%`, top: `${py(s.lat)}%` }}
            />
          ),
      )}
    </div>
  );
}

function StoreDetail({ store, live }: { store: FleetStoreStatus; live: boolean }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const dispatch = async (type: string, label: string) => {
    if (!live) {
      setFeedback("Modo demonstração — comandos exigem a API conectada.");
      return;
    }
    try {
      const { sendStoreCommand } = await import("@/lib/api");
      await sendStoreCommand(store.storeId, type);
      setFeedback(`✓ ${label} enviado para ${store.storeCode}`);
    } catch {
      setFeedback(`Falha ao enviar "${label}".`);
    }
  };

  return (
    <motion.div
      key={store.storeId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{store.name}</h3>
          <p className="text-sm text-fuse-muted">
            {store.city}, {store.state} · {store.storeCode}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm ${HEALTH_META[store.health].color}`}>
          <span className={`h-2 w-2 rounded-full ${HEALTH_META[store.health].dot}`} />
          {HEALTH_META[store.health].label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Info label="Marca" value={store.brand ?? "—"} />
        <Info label="Grupo" value={store.group ?? "—"} />
        <Info label="Último sinal" value={timeAgo(store.lastSeenAt)} />
        <Info label="Tenant" value={store.tenant ?? "—"} />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fuse-muted">
          Controle remoto
        </div>
        <div className="grid grid-cols-2 gap-2">
          <RemoteAction
            icon={<Power size={14} />}
            label="Reiniciar player"
            onClick={() => void dispatch("restart-player", "Reiniciar player")}
          />
          <RemoteAction
            icon={<RefreshCcw size={14} />}
            label="Trocar stream"
            onClick={() => void dispatch("switch-stream", "Trocar stream")}
          />
          <RemoteAction
            icon={<Volume2 size={14} />}
            label="Teste de áudio"
            onClick={() => void dispatch("audio-test", "Teste de áudio")}
          />
          <RemoteAction
            icon={<MonitorSpeaker size={14} />}
            label="Diagnóstico"
            onClick={() => void dispatch("open-diagnostics", "Diagnóstico")}
          />
        </div>
        {feedback && <p className="mt-3 text-xs text-fuse-muted">{feedback}</p>}
        <p className="mt-3 text-xs leading-relaxed text-fuse-muted/70">
          Os comandos são entregues via Socket.IO (sala <code>store:{store.storeCode}</code>) pela
          rota <code>POST /v1/stores/:id/commands</code>.
        </p>
      </div>
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fuse-card px-3 py-2">
      <div className="text-xs text-fuse-muted">{label}</div>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}

function RemoteAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-fuse-border px-3 py-2.5 text-xs text-fuse-muted transition-colors hover:border-fuse-primary/60 hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return "nunca";
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${Math.round(sec)}s atrás`;
  if (sec < 3600) return `${Math.round(sec / 60)}min atrás`;
  return `${Math.round(sec / 3600)}h atrás`;
}
