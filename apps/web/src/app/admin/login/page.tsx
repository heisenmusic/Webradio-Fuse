"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { apiConfigured, login } from "@/lib/api";

/** Autenticação do Dashboard Operacional. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-1/4 h-96 w-96 rounded-full bg-fuse-primary/15 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-fuse-accent/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass relative w-full max-w-sm rounded-3xl p-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="glass glow-primary flex h-14 w-14 items-center justify-center rounded-2xl">
            <span className="text-base font-black text-gradient">FUSE</span>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Dashboard Operacional</h1>
          <p className="mt-1 text-sm text-fuse-muted">Acesso restrito à equipe administrativa</p>
        </div>

        {!apiConfigured ? (
          <div className="mt-8 rounded-2xl border border-fuse-border bg-fuse-card p-4 text-sm leading-relaxed text-fuse-muted">
            <p>
              A API não está configurada (<code className="text-xs">NEXT_PUBLIC_API_URL</code>).
              O dashboard opera em <strong className="text-fuse-text">modo demonstração</strong>,
              sem necessidade de login.
            </p>
            <Link
              href="/admin"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-fuse-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-fuse-primary-soft"
            >
              Entrar em modo demo
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-fuse-muted">E-mail</span>
              <div className="flex items-center gap-2 rounded-xl border border-fuse-border bg-fuse-card px-3 py-2.5 focus-within:border-fuse-primary">
                <Mail size={15} className="shrink-0 text-fuse-muted" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@fuse.local"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-fuse-muted/50"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-fuse-muted">Senha</span>
              <div className="flex items-center gap-2 rounded-xl border border-fuse-border bg-fuse-card px-3 py-2.5 focus-within:border-fuse-primary">
                <Lock size={15} className="shrink-0 text-fuse-muted" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-fuse-muted/50"
                />
              </div>
            </label>

            {error && (
              <p className="rounded-xl border border-fuse-danger/30 bg-fuse-danger/10 px-3 py-2 text-xs text-fuse-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glow-primary mt-2 flex items-center justify-center gap-2 rounded-xl bg-fuse-primary px-4 py-3 font-medium text-white transition-all hover:bg-fuse-primary-soft disabled:opacity-60"
            >
              {loading ? "Autenticando…" : "Entrar"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-fuse-muted/60">
          Sessão protegida por JWT com rotação de refresh token
        </p>
      </motion.div>
    </main>
  );
}
