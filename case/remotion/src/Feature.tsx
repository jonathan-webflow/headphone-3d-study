import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, dot, mono, out, sans } from "./brand";
import { Brand, MaskLines, Plate, Progress } from "./parts";

// Molde dos comerciais de detalhe: três tempos (título · dado · fechamento), como o comercial 8.
export type FeatureProps = {
  rendered: boolean;
  seq: string;                       // c01 … (a versão 4:5 usa seq + "f")
  label: string;                     // nome curto no progresso (4:5)
  title: string[];                   // em pontos (Doto)
  sub: string;
  stat?: { value: number | string; label: string };   // número conta de 0 até o valor
  detail?: string[];                 // alternativa ao número: linhas em Geist
  close: string[];
  tag?: string;
  cut?: number;                      // quadro de um corte entre dois planos: passa por preto
};

const DOT_W = 0.6;   // largura média de um caractere da Doto, em em

export const Feature: React.FC<FeatureProps> = ({ rendered, seq, label, title, sub, stat, detail, close, tag = "JONATHAN ROCHA · 3D STUDY 01", cut }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: D } = useVideoConfig();
  const s = width / 1080, tall = height / width > 1.5;
  const pad = 80 * s, bottomSafe = tall ? 420 * s : 110 * s, topSafe = tall ? 250 * s : 90 * s;
  // os três tempos se ajustam à duração (240 ou 300 quadros)
  const t1 = Math.round(D * 0.36), t2 = Math.round(D * 0.7);
  const longest = Math.max(...title.map((l) => l.length));
  const titleSize = Math.min(150 * s, (width - 2 * pad) / (longest * DOT_W));

  const midIn = interpolate(frame, [t1 + 2, t1 + 20], [0, 1], { ...clamp, easing: out });
  const midOut = interpolate(frame, [t2 - 12, t2], [1, 0], clamp);
  const num = typeof stat?.value === "number"
    ? Math.round(interpolate(frame, [t1 + 6, t2 - 24], [0, stat.value], { ...clamp, easing: out })).toString()
    : stat?.value;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Plate seq={tall ? seq : seq + "f"} rendered={rendered} />
      {cut ? <AbsoluteFill style={{ background: C.black, opacity: interpolate(frame, [cut - 10, cut - 1, cut, cut + 10], [0, 1, 1, 0], clamp) }} /> : null}
      <AbsoluteFill style={{ background: `linear-gradient(to top, rgba(0,0,0,0.9) ${bottomSafe / height * 100}%, rgba(0,0,0,0.6) ${(bottomSafe + 300 * s) / height * 100}%, rgba(0,0,0,0) ${(bottomSafe + 700 * s) / height * 100}%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) ${(topSafe + 60 * s) / height * 100}%, rgba(0,0,0,0) ${(topSafe + 220 * s) / height * 100}%)` }} />
      <Brand top={topSafe} left={pad} s={s} />

      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        {/* 1. título */}
        <div style={{ position: "absolute", left: 0, bottom: 0 }}>
          <MaskLines lines={title} from={10} to={t1 - 6} font={`800 1px ${dot}`} size={titleSize} lh={0.95} />
          <div style={{ marginTop: 26 * s, font: `400 ${40 * s}px/1.35 ${sans}`, color: C.grey, width: 800 * s,
            opacity: interpolate(frame, [30, 48, t1 - 8, t1], [0, 1, 1, 0], clamp) }}>{sub}</div>
        </div>
        {/* 2. dado: número ou linhas */}
        <div style={{ position: "absolute", left: 0, bottom: 0, opacity: midIn * midOut, translate: `0 ${(1 - midIn) * 30 * s}px` }}>
          {stat ? (
            <>
              <div style={{ font: `800 ${260 * s}px/0.9 ${dot}`, color: C.white, whiteSpace: "nowrap" }}>{num}</div>
              <div style={{ marginTop: 18 * s, font: `500 ${30 * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey, whiteSpace: "nowrap" }}>{stat.label}</div>
            </>
          ) : (
            <div>{(detail || []).map((l, i) => (
              <div key={i} style={{ font: `400 ${84 * s}px/1.1 ${sans}`, color: C.white, whiteSpace: "nowrap",
                opacity: interpolate(frame, [t1 + 4 + i * 8, t1 + 22 + i * 8], [0, 1], { ...clamp, easing: out }) }}>{l}</div>
            ))}</div>
          )}
        </div>
        {/* 3. fechamento */}
        <div style={{ position: "absolute", left: 0, bottom: 0 }}>
          <MaskLines lines={close} from={t2 + 2} font={`400 1px ${sans}`} size={92 * s} lh={1.08} stagger={6} />
          <div style={{ marginTop: 28 * s, display: "flex", alignItems: "center", gap: 16 * s, font: `500 ${28 * s}px ${mono}`, letterSpacing: "0.12em", color: C.grey, whiteSpace: "nowrap",
            opacity: interpolate(frame, [t2 + 22, t2 + 38], [0, 1], { ...clamp, easing: out }) }}>
            <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />{tag}
          </div>
        </div>
      </div>
      {tall ? null : <Progress bottom={40 * s} left={width - pad - 220 * s} width={220 * s} s={s} label={label} />}
    </AbsoluteFill>
  );
};
