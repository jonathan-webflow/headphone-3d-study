import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, dot, mono, out } from "./brand";
import { Atmosphere } from "./Atmosphere";

// Sequência de quadros do Blender (0001.png …). Sem render ainda: fundo preto.
export const Plate: React.FC<{ seq?: string; still?: string; rendered: boolean; offset?: number }> = ({ seq, still, rendered, offset = 0 }) => {
  const frame = useCurrentFrame();
  if (!rendered) return <AbsoluteFill style={{ background: C.black }} />;
  const src = still ? staticFile(`renders/${still}`) : staticFile(`renders/${seq}/${String(frame + 1 + offset).padStart(4, "0")}.png`);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Atmosphere />
      <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};

// Pílula da marca, igual ao canto superior esquerdo do site.
export const Brand: React.FC<{ top: number; left: number; s: number; from?: number; full?: boolean }> = ({ top, left, s, from = 0, full = false }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [from, from + 18], [0, 1], { ...clamp, easing: out });
  return (
    <div style={{ position: "absolute", top, left, opacity: k, translate: `0 ${(1 - k) * -16 * s}px`, display: "flex", alignItems: "center", gap: 22 * s }}>
      {/* assinatura: monograma JR em matriz de pontos + nome e papel em mono, empilhados */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 * s, height: (full ? 84 : 72) * s, padding: `0 ${(full ? 30 : 26) * s}px 0 ${24 * s}px`, borderRadius: 18 * s,
        background: "rgba(12,12,12,0.88)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.16)" }}>
        <span style={{ font: `800 ${(full ? 54 : 46) * s}px/1 ${dot}`, color: C.white, letterSpacing: "0.02em" }}>JR</span>
        {full ? (
          <span style={{ display: "grid", gap: 7 * s, font: `500 ${19 * s}px/1 ${mono}`, letterSpacing: "0.14em" }}>
            <span style={{ color: C.white }}>JONATHAN ROCHA</span>
            <span style={{ color: C.grey }}>CREATIVE DEVELOPER</span>
          </span>
        ) : (
          <span style={{ font: `500 ${19 * s}px/1 ${mono}`, letterSpacing: "0.14em", color: C.grey }}>CREATIVE DEVELOPER</span>
        )}
      </div>
    </div>
  );
};

// Linhas que sobem por trás de uma máscara (como o título do site).
export const MaskLines: React.FC<{ lines: string[]; from: number; to?: number; font: string; size: number; lh?: number; color?: string; stagger?: number }> = ({ lines, from, to, font, size, lh = 1.0, color = C.white, stagger = 5 }) => {
  const frame = useCurrentFrame();
  // a máscara desce um pouco abaixo da linha para não cortar as letras com perna (y, p, g, vírgula);
  // a margem negativa mantém o espaço entre linhas, e o deslocamento cobre a máscara maior
  const line = size * lh, foot = size * 0.6, hide = ((line + foot) / line) * 100 + 4;
  return (
    <div>
      {lines.map((l, i) => {
        const a = interpolate(frame, [from + i * stagger, from + i * stagger + 24], [hide, 0], { ...clamp, easing: out });
        const b = to === undefined ? 0 : interpolate(frame, [to + i * 3, to + i * 3 + 16], [0, -hide], { ...clamp, easing: out });
        return (
          <div key={i} style={{ overflow: "hidden", height: line + foot, marginBottom: -foot, lineHeight: `${line}px` }}>
            <div style={{ translate: `0 ${a + b}%`, font: `${font}`, fontSize: size, color, whiteSpace: "nowrap" }}>{l}</div>
          </div>
        );
      })}
    </div>
  );
};

// Linha fina de progresso, como a do canto inferior do site.
export const Progress: React.FC<{ bottom: number; left: number; width: number; s: number; label: string }> = ({ bottom, left, width, s, label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", bottom, left, display: "grid", gap: 14 * s }}>
      <span style={{ font: `500 ${20 * s}px ${mono}`, letterSpacing: "0.12em", color: C.grey }}>{label}</span>
      <div style={{ width, height: 3 * s, background: "#3a3a3a", borderRadius: 2 }}>
        <div style={{ width: `${(frame / (durationInFrames - 1)) * 100}%`, height: "100%", background: C.white }} />
      </div>
    </div>
  );
};
