import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Fundo do site (web/atmosphere.js) refeito em canvas: grafite no centro, preto nas bordas,
// matriz de pontos (halftone) com ondas que saem do produto e uma zona limpa atrás dele.
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const Atmosphere: React.FC<{ cx?: number; cy?: number; clearR?: number }> = ({ cx = 0.5, cy = 0.4, clearR = 0.3 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext("2d"); if (!g) return;
    const aspect = width / height, t = frame / fps;
    // base: grafite no centro, preto nas bordas
    const grad = g.createRadialGradient(cx * width, cy * height, 0, cx * width, cy * height, 0.9 * height);
    grad.addColorStop(0, "rgb(14,14,14)"); grad.addColorStop(1, "rgb(0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, width, height);
    // pontos
    const cell = 10 * (height / 1600 + 0.5);
    g.fillStyle = "#fff";
    for (let y = cell / 2; y < height; y += cell) {
      for (let x = cell / 2; x < width; x += cell) {
        const dx = (x / width - cx) * aspect, dy = y / height - cy;
        const r = Math.hypot(dx, dy);
        const w = 0.5 + 0.5 * Math.sin(r * 24 - t * 0.4);
        const ring = w * w * w * smoothstep(0.12, 0.3, r) * (1 - smoothstep(0.32, 0.95, r));
        const clear = smoothstep(clearR * 0.9, clearR * 1.5, r);
        const field = Math.min(1, ring * 0.9) * clear;
        const a = (0.035 * clear + 0.17 * field) * 1.4;
        if (a < 0.004) continue;
        g.globalAlpha = a;
        g.beginPath(); g.arc(x, y, (0.08 + 0.32 * field) * cell, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }, [frame, width, height, fps, cx, cy, clearR]);

  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};
