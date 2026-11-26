import React from "react";
import { Img, staticFile } from "remotion";
import { C, mono } from "./brand";

// Celular sem marca: só o vidro, a borda e a tela (a captura do site em 390 × 844).
export const Phone: React.FC<{ src: string; top: number; screenH: number; s: number; width: number }> = ({ src, top, screenH, s, width }) => {
  const screenW = screenH * (390 / 844), bezel = 14 * s;
  return (
    <div style={{ position: "absolute", top, left: (width - screenW) / 2 - bezel, padding: bezel, borderRadius: 64 * s, background: "#0b0b0b",
      boxShadow: `inset 0 0 0 ${1.5 * s}px rgba(255,255,255,0.16), 0 ${40 * s}px ${120 * s}px rgba(0,0,0,0.65)` }}>
      <div style={{ width: screenW, height: screenH, borderRadius: 50 * s, overflow: "hidden", background: C.black }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
};

// Janela de navegador neutra: barra escura, três pontos cinza e o endereço do site.
export const Browser: React.FC<{ src: string; top: number; left: number; w: number; s: number; url?: string }> = ({ src, top, left, w, s, url = "headphone-teardown-study.vercel.app" }) => (
  <div style={{ position: "absolute", top, left, width: w, borderRadius: 16 * s, overflow: "hidden", background: "#111",
    boxShadow: `inset 0 0 0 ${1.5 * s}px rgba(255,255,255,0.14), 0 ${40 * s}px ${120 * s}px rgba(0,0,0,0.65)` }}>
    <div style={{ height: 40 * s, display: "flex", alignItems: "center", padding: `0 ${16 * s}px`, gap: 8 * s, position: "relative" }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 10 * s, height: 10 * s, borderRadius: "50%", background: "#3a3a3a" }} />)}
      <span style={{ position: "absolute", left: "50%", translate: "-50% 0", padding: `${6 * s}px ${18 * s}px`, borderRadius: 999, background: "#1c1c1c",
        font: `400 ${14 * s}px ${mono}`, letterSpacing: "0.04em", color: C.grey }}>{url}</span>
    </div>
    <Img src={staticFile(src)} style={{ width: w, height: w * (900 / 1440), display: "block" }} />
  </div>
);

// Cortina que revela a camada de cima de baixo para cima, com um fio branco na borda.
export const Wipe: React.FC<{ k: number; children: React.ReactNode }> = ({ k, children }) => (
  <div style={{ position: "absolute", inset: 0, clipPath: `inset(${(1 - k) * 100}% 0 0 0)` }}>
    {children}
    {k > 0 && k < 1 ? <div style={{ position: "absolute", left: 0, right: 0, top: `${(1 - k) * 100}%`, height: 2, background: "rgba(255,255,255,0.8)" }} /> : null}
  </div>
);
