"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  Megaphone,
  MonitorPlay,
  Store,
  Wand2,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Frota", icon: Activity },
  { href: "/admin/announcements", label: "Avisos", icon: Megaphone },
  { href: "/admin/scenes", label: "Cenas & Eventos", icon: Wand2 },
  { href: "/admin/signage", label: "Signage", icon: MonitorPlay },
  { href: "/admin/stores", label: "Lojas", icon: Store },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="flex min-h-dvh bg-fuse-bg">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-fuse-border/60 p-4 md:flex">
        <Link href="/" className="flex items-center gap-3 px-2 py-3">
          <div className="glass flex h-9 w-9 items-center justify-center rounded-xl">
            <span className="text-xs font-black text-gradient">FUSE</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Radio Enterprise</span>
        </Link>
        <nav className="mt-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-fuse-primary/15 text-white"
                    : "text-fuse-muted hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon size={16} className={active ? "text-fuse-primary-soft" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2 px-3 py-2 text-xs text-fuse-muted/70">
          <CalendarClock size={13} />
          Programação no horário local de cada loja
        </div>
      </aside>

      {/* Navegação mobile */}
      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl p-2 md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`rounded-xl p-2.5 ${
              pathname === href ? "bg-fuse-primary/20 text-white" : "text-fuse-muted"
            }`}
          >
            <Icon size={18} />
          </Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
    </div>
  );
}
