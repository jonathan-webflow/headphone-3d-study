import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, dot, mono, out, sans } from "./brand";
import { Brand, MaskLines, Plate, Progress } from "./parts";

// Comercial 8: a explosão completa. 10 s a 30 fps.
// 0–3,3 s título · 3,5–7,8 s contador de camadas · 8–10 s cartão final.
export const Teardown: React.FC<{ rendered: boolean }> = ({ rendered }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1080, tall = height / width > 1.5;
  const pad = 80 * s, bottomSafe = tall ? 420 * s : 110 * s, topSafe = tall ? 250 * s : 90 * s;
  // uma camada a cada 10 quadros, no mesmo ritmo da explosão do Blender (início no quadro 100)
  const n = frame < 100 ? 0 : Math.min(11, Math.floor((frame - 100) / 10) + 1);
  const counterIn = interpolate(frame, [98, 116], [0, 1], { ...clamp, easing: out });
  const counterOut = interpolate(frame, [228, 240], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Plate seq={tall ? "c08" : "c08f"} rendered={rendered} />
      {/* escurece só a faixa do texto, para ler sobre o metal */}
      <AbsoluteFill style={{ background: `linear-gradient(to top, rgba(0,0,0,0.78) ${bottomSafe / height * 100}%, rgba(0,0,0,0) ${(bottomSafe + 520 * s) / height * 100}%)` }} />
      <Brand top={topSafe} left={pad} s={s} />

      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        {/* 1. título */}
        <div style={{ position: "absolute", left: 0, bottom: 0 }}>
          <MaskLines lines={["THE", "TEARDOWN"]} from={12} to={96} font={`800 1px ${dot}`} size={150 * s} lh={0.95} />
          <div style={{ marginTop: 26 * s, font: `400 ${40 * s}px/1.35 ${sans}`, color: C.grey, width: 760 * s,
            opacity: interpolate(frame, [34, 52, 92, 100], [0, 1, 1, 0], clamp) }}>
            Headphone (1) Pro, taken apart one layer at a time.
          </div>
        </div>
        {/* 2. contador */}
        <div style={{ position: "absolute", left: 0, bottom: 0, opacity: counterIn * counterOut, translate: `0 ${(1 - counterIn) * 30 * s}px` }}>
          <div style={{ font: `800 ${260 * s}px/0.9 ${dot}`, color: C.white }}>{String(n).padStart(2, "0")}</div>
          <div style={{ marginTop: 18 * s, font: `500 ${30 * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey, whiteSpace: "nowrap" }}>LAYERS, MODELLED FROM SCRATCH</div>
        </div>
        {/* 3. cartão final */}
        <div style={{ position: "absolute", left: 0, bottom: 0 }}>
          <MaskLines lines={["Eleven layers.", "One sound."]} from={240} font={`400 1px ${sans}`} size={92 * s} lh={1.08} stagger={6} />
          <div style={{ marginTop: 28 * s, display: "flex", alignItems: "center", gap: 16 * s, font: `500 ${28 * s}px ${mono}`, letterSpacing: "0.12em", color: C.grey,
            opacity: interpolate(frame, [262, 278], [0, 1], { ...clamp, easing: out }) }}>
            <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />BLENDER → THREE.JS
          </div>
        </div>
      </div>
      {tall ? null : <Progress bottom={40 * s} left={width - pad - 220 * s} width={220 * s} s={s} label="TEARDOWN" />}
    </AbsoluteFill>
  );
};
