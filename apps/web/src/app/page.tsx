"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, Radio } from "lucide-react";

/** Entrada da plataforma: escolha entre Player da Loja e Dashboard. */
export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* fundo ambiente */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-fuse-primary/15 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-fuse-accent/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative flex flex-col items-center text-center"
      >
        <div className="glass glow-primary flex h-20 w-20 items-center justify-center rounded-3xl">
          <span className="text-2xl font-black text-gradient">FUSE</span>
        </div>
        <h1 className="mt-8 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
          Fuse Radio <span className="text-gradient">Enterprise</span>
        </h1>
        <p className="mt-4 max-w-xl text-balance text-fuse-muted md:text-lg">
          Rádio corporativa, comunicação interna e experiência sonora para redes varejistas —
          milhares de lojas, uma central.
        </p>

        <div className="mt-12 grid w-full max-w-2xl gap-4 md:grid-cols-2">
          <EntryCard
            href="/player"
            icon={<Radio size={22} />}
            title="Player da Loja"
            description="Tela cheia, failover automático, visualizador de áudio e programação local."
          />
          <EntryCard
            href="/admin"
            icon={<LayoutDashboard size={22} />}
            title="Dashboard Operacional"
            description="Frota em tempo real, monitoramento, controle remoto e campanhas."
          />
        </div>
      </motion.div>

      <footer className="absolute bottom-6 text-xs text-fuse-muted/60">
        Fuse Radio Enterprise · plataforma SaaS multi-tenant
      </footer>
    </main>
  );
}

function EntryCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="glass group flex h-full flex-col gap-3 rounded-2xl p-6 text-left transition-colors hover:border-fuse-primary/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuse-primary/15 text-fuse-primary-soft">
            {icon}
          </div>
          <ArrowRight
            size={18}
            className="text-fuse-muted transition-transform group-hover:translate-x-1 group-hover:text-white"
          />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-fuse-muted">{description}</p>
        </div>
      </motion.div>
    </Link>
  );
}
