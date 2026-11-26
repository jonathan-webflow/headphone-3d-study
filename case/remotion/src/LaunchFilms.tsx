import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, mono, out, sans } from "./brand";
import { Atmosphere } from "./Atmosphere";
import { Brand, MaskLines } from "./parts";

const seqFrame = (seq: string, frame: number, last: number) => staticFile(`renders/${seq}/${String(Math.min(frame, last - 1) + 1).padStart(4, "0")}.png`);

// Light reveal: o fone só aparece pela luz. Texto e assinatura entram só no fim, como num teaser.
export const REVEAL_FRAMES = 420;
export const LightReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1080, tall = height / width > 1.5;
  const pad = 80 * s, topSafe = tall ? 250 * s : 90 * s, bottomSafe = tall ? 420 * s : 110 * s;
  const atmo = interpolate(frame, [340, 400], [0, 1], { ...clamp, easing: out });   // o fundo do site acende junto com o estúdio
  const size = (tall ? 92 : 76) * s;
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <AbsoluteFill style={{ opacity: atmo }}><Atmosphere cy={tall ? 0.36 : 0.42} /></AbsoluteFill>
      <Img src={seqFrame(tall ? "r01" : "r01f", frame, REVEAL_FRAMES)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {frame >= 370 ? <Brand top={topSafe} left={pad} s={s} from={372} /> : null}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: bottomSafe, display: "grid", justifyItems: "center", textAlign: "center" }}>
        <div style={{ display: "grid", justifyItems: "center" }}>
          <MaskLines lines={["Built to be", "taken apart."]} from={386} font={`400 1px ${sans}`} size={size} lh={1.06} stagger={7} />
        </div>
        <div style={{ marginTop: 28 * s, display: "flex", alignItems: "center", gap: 14 * s, font: `500 ${(tall ? 26 : 22) * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey,
          opacity: interpolate(frame, [412, 430], [0, 1], { ...clamp, easing: out }) }}>
          <span style={{ width: 11 * s, height: 11 * s, borderRadius: "50%", background: C.red }} />HEADPHONE (1) PRO · 3D STUDY
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Macro cuts: sete detalhes de 2 s, legenda vertical na borda (como nas referências), e o fone inteiro no fim.
export const MACRO_FRAMES = 480;
const SHOT = 60;
const CAPTIONS = ["Graphite aluminium", "Printed graphic plate", "40 mm dynamic driver", "Vented acoustic mount", "Synthetic leather", "Roller, paddle, button", "Arm and pivot"];

export const MacroCuts: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1080;
  const pad = 80 * s, topSafe = 250 * s, bottomSafe = 420 * s;
  const i = Math.floor(frame / SHOT), t = frame - i * SHOT, end = i >= CAPTIONS.length;
  const capIn = interpolate(t, [4, 16], [0, 1], { ...clamp, easing: out });
  const capOut = interpolate(t, [SHOT - 8, SHOT - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Atmosphere cy={0.38} />
      <Img src={seqFrame("m01", frame, MACRO_FRAMES)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 18%)" }} />
      {end ? <AbsoluteFill style={{ background: `linear-gradient(to top, rgba(0,0,0,0.85) ${bottomSafe / height * 100}%, rgba(0,0,0,0) ${(bottomSafe + 520 * s) / height * 100}%)` }} /> : null}
      <Brand top={topSafe} left={pad} s={s} from={-100} />
      {!end ? (
        <div style={{ position: "absolute", right: 64 * s, top: 360 * s, writingMode: "vertical-rl", display: "flex", alignItems: "center", gap: 22 * s,
          opacity: capIn * capOut, translate: `0 ${(1 - capIn) * 24 * s}px`, font: `500 ${30 * s}px ${mono}`, letterSpacing: "0.16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          <span style={{ color: C.grey }}>{String(i + 1).padStart(2, "0")} / {String(CAPTIONS.length).padStart(2, "0")}</span>
          <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />
          <span style={{ color: C.white }}>{CAPTIONS[i]}</span>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        <MaskLines lines={["Every part,", "up close."]} from={CAPTIONS.length * SHOT + 10} font={`400 1px ${sans}`} size={92 * s} lh={1.08} stagger={6} />
        <div style={{ marginTop: 28 * s, display: "flex", alignItems: "center", gap: 16 * s, font: `500 ${28 * s}px ${mono}`, letterSpacing: "0.12em", color: C.grey, whiteSpace: "nowrap",
          opacity: interpolate(frame, [CAPTIONS.length * SHOT + 30, CAPTIONS.length * SHOT + 46], [0, 1], { ...clamp, easing: out }) }}>
          <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />JONATHAN ROCHA · 3D STUDY 01
        </div>
      </div>
    </AbsoluteFill>
  );
};
