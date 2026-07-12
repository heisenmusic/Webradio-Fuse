"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SignageItem } from "@fuse/shared";

/**
 * Camada de Digital Signage do player — rotaciona o conteúdo publicado
 * pela central (imagens, banners, campanhas, metas, comunicados, QR).
 */
export function SignageLayer({ items }: { items: SignageItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  const current = items[index % Math.max(items.length, 1)];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      Math.max(3, current.durationSec) * 1000,
    );
    return () => clearTimeout(t);
  }, [current, items.length]);

  if (!current) return null;

  const isImage = !!current.assetUrl;

  return (
    <div className="pointer-events-none absolute right-6 top-28 z-10 w-72 md:w-80">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass overflow-hidden rounded-2xl"
        >
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.assetUrl}
              alt={current.title}
              className="max-h-56 w-full object-cover"
            />
          )}
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-fuse-accent">
              {labelForKind(current.kind)}
            </div>
            <div className="mt-1 font-semibold leading-snug">{current.title}</div>
            {current.body && (
              <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fuse-muted">
                {current.body}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index % items.length ? "w-4 bg-fuse-accent" : "w-1 bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function labelForKind(kind: SignageItem["kind"]): string {
  const map: Record<SignageItem["kind"], string> = {
    image: "Destaque",
    video: "Vídeo",
    banner: "Banner",
    "qr-code": "QR Code",
    campaign: "Campanha",
    notice: "Comunicado",
    goal: "Meta",
    ranking: "Ranking",
  };
  return map[kind] ?? "Conteúdo";
}
