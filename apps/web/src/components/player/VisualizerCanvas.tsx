"use client";

import { useEffect, useRef } from "react";
import type { VisualizerMode } from "@fuse/shared";
import type { FuseAudioEngine } from "@/lib/player/audio-engine";
import { RENDERERS, type VizFrame } from "@/lib/player/visualizers";

interface Props {
  engine: FuseAudioEngine;
  mode: VisualizerMode;
  primary?: string;
  accent?: string;
}

/**
 * Superfície de renderização do visualizador — tela cheia, 60 FPS,
 * DPR-aware, com pausa automática quando a aba fica oculta.
 */
export function VisualizerCanvas({ engine, mode, primary = "#6d5efc", accent = "#22d3ee" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const loop = (ts: number) => {
      if (!running) return;
      const { freq, wave, level, live } = engine.getFrame();
      const frame: VizFrame = {
        freq,
        wave,
        level,
        t: ts / 1000,
        w: canvas.clientWidth,
        h: canvas.clientHeight,
        live,
        primary,
        accent,
      };
      RENDERERS[modeRef.current](ctx, frame);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [engine, primary, accent]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
