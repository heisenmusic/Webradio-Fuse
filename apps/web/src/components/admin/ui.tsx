"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfigured, getAuth } from "@/lib/api";

/**
 * Gate das páginas de gestão: exige API configurada + sessão válida.
 * Retorna "demo" quando não há API (páginas mostram estado explicativo).
 */
export function useAdminGate(): "checking" | "demo" | "ready" {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "demo" | "ready">("checking");

  useEffect(() => {
    if (!apiConfigured) {
      setState("demo");
      return;
    }
    if (!getAuth()) {
      router.replace("/admin/login");
      return;
    }
    setState("ready");
  }, [router]);

  return state;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-fuse-muted">{subtitle}</p>
      </div>
      {actions}
    </header>
  );
}

export function DemoNotice() {
  return (
    <div className="glass mt-10 rounded-2xl p-8 text-center">
      <p className="text-fuse-muted">
        Esta área de gestão requer a API conectada
        (<code className="text-xs">NEXT_PUBLIC_API_URL</code>).
      </p>
      <p className="mt-2 text-sm text-fuse-muted/70">
        Em modo demonstração apenas a visão de Frota está disponível.
      </p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl p-5 ${className}`}>{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-fuse-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "rounded-lg border border-fuse-border bg-fuse-card px-3 py-2 text-sm outline-none transition-colors focus:border-fuse-primary w-full";

export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl bg-fuse-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-fuse-primary-soft disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-fuse-border px-3 py-1.5 text-xs text-fuse-muted transition-colors hover:border-fuse-danger hover:text-fuse-danger"
    >
      {children}
    </button>
  );
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DaysPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAY_LABELS.map((label, d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            value.includes(d)
              ? "border-fuse-primary bg-fuse-primary/15 text-white"
              : "border-fuse-border text-fuse-muted hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function formatDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Todos os dias";
  return days.map((d) => DAY_LABELS[d]).join(", ");
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-xl border border-fuse-danger/30 bg-fuse-danger/10 px-3 py-2 text-xs text-fuse-danger">
      {error}
    </p>
  );
}
