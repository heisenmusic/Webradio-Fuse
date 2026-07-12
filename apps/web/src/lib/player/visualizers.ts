"use client";

import type { VisualizerMode } from "@fuse/shared";

/**
 * Visualizadores de áudio — 7 modos, Canvas 2D, 60 FPS.
 * Cada renderer é uma função pura sobre o frame atual do AnalyserNode.
 */

export interface VizFrame {
  freq: Uint8Array;
  wave: Uint8Array;
  /** Energia média 0..1 */
  level: number;
  /** Timestamp em segundos */
  t: number;
  w: number;
  h: number;
  live: boolean;
  primary: string;
  accent: string;
}

export type VizRenderer = (ctx: CanvasRenderingContext2D, f: VizFrame) => void;

const TAU = Math.PI * 2;

function fade(ctx: CanvasRenderingContext2D, f: VizFrame, alpha: number) {
  ctx.fillStyle = `rgba(7, 7, 11, ${alpha})`;
  ctx.fillRect(0, 0, f.w, f.h);
}

function sample(data: Uint8Array, i: number, count: number): number {
  const idx = Math.min(data.length - 1, Math.floor((i / count) * data.length * 0.72));
  return data[idx] / 255;
}

// ---------------------------------------------------------------------------
// Spectrum — barras espelhadas com gradiente e brilho
// ---------------------------------------------------------------------------
const spectrum: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.32);
  const bars = 72;
  const gap = 3;
  const bw = (f.w - gap * (bars + 1)) / bars;
  const mid = f.h * 0.62;

  for (let i = 0; i < bars; i++) {
    const v = sample(f.freq, i, bars);
    const bh = Math.max(3, v * f.h * 0.42);
    const x = gap + i * (bw + gap);
    const grad = ctx.createLinearGradient(0, mid - bh, 0, mid + bh * 0.5);
    grad.addColorStop(0, f.accent);
    grad.addColorStop(1, f.primary);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, mid - bh, bw, bh, bw / 2);
    ctx.fill();
    // reflexo
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.roundRect(x, mid + 6, bw, bh * 0.45, bw / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

// ---------------------------------------------------------------------------
// Circular — anel radial pulsante
// ---------------------------------------------------------------------------
const circular: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.3);
  const cx = f.w / 2;
  const cy = f.h / 2;
  const base = Math.min(f.w, f.h) * 0.2 * (1 + f.level * 0.18);
  const spokes = 128;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(f.t * 0.12);
  for (let i = 0; i < spokes; i++) {
    const v = sample(f.freq, i, spokes);
    const a = (i / spokes) * TAU;
    const len = base * 0.28 + v * base * 0.9;
    const x1 = Math.cos(a) * base;
    const y1 = Math.sin(a) * base;
    const x2 = Math.cos(a) * (base + len);
    const y2 = Math.sin(a) * (base + len);
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, f.primary);
    grad.addColorStop(1, f.accent);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // núcleo
  ctx.rotate(-f.t * 0.12);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, base * 0.85);
  core.addColorStop(0, `${f.primary}55`);
  core.addColorStop(1, "transparent");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, base * 0.85, 0, TAU);
  ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Waveform — osciloscópio em camadas com glow
// ---------------------------------------------------------------------------
const waveform: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.28);
  const mid = f.h / 2;
  const layers = [
    { color: f.accent, amp: 1, width: 2.5, glow: 18 },
    { color: f.primary, amp: 0.6, width: 1.6, glow: 10 },
  ];

  for (const layer of layers) {
    ctx.beginPath();
    for (let x = 0; x < f.w; x += 3) {
      const v = (f.wave[Math.floor((x / f.w) * f.wave.length)] - 128) / 128;
      const y = mid + v * f.h * 0.28 * layer.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.width;
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
};

// ---------------------------------------------------------------------------
// Ambient — nebulosas suaves que respiram com a música
// ---------------------------------------------------------------------------
const ambient: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.06);
  const blobs = 5;
  for (let i = 0; i < blobs; i++) {
    const phase = f.t * 0.22 + (i * TAU) / blobs;
    const x = f.w / 2 + Math.cos(phase) * f.w * 0.24;
    const y = f.h / 2 + Math.sin(phase * 1.4) * f.h * 0.22;
    const band = sample(f.freq, i * 12 + 4, 64);
    const r = Math.min(f.w, f.h) * (0.14 + band * 0.22 + f.level * 0.1);
    const color = i % 2 === 0 ? f.primary : f.accent;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `${color}2e`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
};

// ---------------------------------------------------------------------------
// Neon — malha simétrica com brilho intenso
// ---------------------------------------------------------------------------
const neon: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.4);
  const bars = 48;
  const cx = f.w / 2;
  const bottom = f.h * 0.78;
  const maxH = f.h * 0.5;
  const bw = (f.w * 0.9) / (bars * 2);

  ctx.shadowBlur = 22;
  for (let i = 0; i < bars; i++) {
    const v = sample(f.freq, i, bars);
    const bh = Math.max(2, v * maxH);
    const color = i % 3 === 0 ? f.accent : f.primary;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    // simetria a partir do centro
    ctx.fillRect(cx + i * bw + 2, bottom - bh, bw - 4, bh);
    ctx.fillRect(cx - (i + 1) * bw + 2, bottom - bh, bw - 4, bh);
  }
  ctx.shadowBlur = 0;
  // linha de horizonte
  ctx.fillStyle = `${f.primary}40`;
  ctx.fillRect(f.w * 0.05, bottom + 2, f.w * 0.9, 1.5);
};

// ---------------------------------------------------------------------------
// Premium — partículas orbitais + anel + espelho (modo assinatura)
// ---------------------------------------------------------------------------
interface Particle { a: number; r: number; speed: number; size: number }
const particles: Particle[] = Array.from({ length: 90 }, (_, i) => ({
  a: (i / 90) * TAU,
  r: 0.55 + (i % 30) / 42,
  speed: 0.12 + (i % 7) * 0.035,
  size: 1 + (i % 4) * 0.75,
}));

const premium: VizRenderer = (ctx, f) => {
  fade(ctx, f, 0.18);
  const cx = f.w / 2;
  const cy = f.h * 0.46;
  const R = Math.min(f.w, f.h) * 0.21 * (1 + f.level * 0.14);

  // anel espectral
  ctx.save();
  ctx.translate(cx, cy);
  const segs = 96;
  for (let i = 0; i < segs; i++) {
    const v = sample(f.freq, i, segs);
    const a0 = (i / segs) * TAU - TAU / 4;
    const a1 = ((i + 0.7) / segs) * TAU - TAU / 4;
    ctx.strokeStyle = i % 2 ? f.primary : f.accent;
    ctx.globalAlpha = 0.35 + v * 0.65;
    ctx.lineWidth = 2 + v * 5;
    ctx.beginPath();
    ctx.arc(0, 0, R + v * R * 0.5, a0, a1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // partículas orbitais
  for (const p of particles) {
    p.a += p.speed * 0.016 * (1 + f.level * 2.2);
    const rr = R * p.r * (1.35 + f.level * 0.35);
    const x = Math.cos(p.a) * rr;
    const y = Math.sin(p.a) * rr * 0.62;
    ctx.fillStyle = p.size > 2 ? f.accent : f.primary;
    ctx.globalAlpha = 0.25 + f.level * 0.75;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // piso refletivo
  const floor = ctx.createLinearGradient(0, f.h * 0.72, 0, f.h);
  floor.addColorStop(0, `${f.primary}14`);
  floor.addColorStop(1, "transparent");
  ctx.fillStyle = floor;
  ctx.fillRect(0, f.h * 0.72, f.w, f.h * 0.28);
};

// ---------------------------------------------------------------------------
// Minimalista — uma linha, um pulso, nada mais
// ---------------------------------------------------------------------------
const minimal: VizRenderer = (ctx, f) => {
  ctx.clearRect(0, 0, f.w, f.h);
  fade(ctx, f, 1);
  const mid = f.h / 2;
  const margin = f.w * 0.12;
  const span = f.w - margin * 2;

  ctx.strokeStyle = `${f.primary}cc`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= span; x += 4) {
    const idx = Math.floor((x / span) * f.wave.length);
    const v = (f.wave[idx] - 128) / 128;
    const y = mid + v * f.h * 0.08;
    if (x === 0) ctx.moveTo(margin + x, y);
    else ctx.lineTo(margin + x, y);
  }
  ctx.stroke();

  // pulso central
  const r = 4 + f.level * 26;
  ctx.fillStyle = f.accent;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(f.w / 2, mid, 3, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(f.w / 2, mid, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
};

export const RENDERERS: Record<VisualizerMode, VizRenderer> = {
  spectrum,
  circular,
  waveform,
  ambient,
  neon,
  premium,
  minimal,
};
