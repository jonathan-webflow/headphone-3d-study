import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, mono, out, sans } from "./brand";
import { Atmosphere } from "./Atmosphere";
import { Brand, MaskLines, Progress } from "./parts";
import { Browser, Phone } from "./devices";

// Filme do site em uso: a captura quadro a quadro (tools/capture_site.cjs) dentro de um aparelho.
// 9:16 usa a captura do celular; 4:5 usa a do desktop numa janela de navegador.
export const SITE_FRAMES = 600;
const URL = "HEADPHONE-TEARDOWN-STUDY.VERCEL.APP";

export const SiteFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1080, tall = height / width > 1.5;
  const pad = 80 * s, topSafe = tall ? 250 * s : 90 * s;
  const shot = Math.min(frame, SITE_FRAMES - 1) + 1;
  const src = `renders/site/${tall ? "mobile" : "desktop"}/${String(shot).padStart(4, "0")}.jpg`;
  const inK = interpolate(frame, [0, 24], [0, 1], { ...clamp, easing: out });

  const size = (tall ? 84 : 66) * s;
  const caption = (
    <>
      <div style={{ position: "relative", height: size * 1.08 * 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0 }}><MaskLines lines={["Scroll.", "It comes apart."]} from={14} to={280} font={`400 1px ${sans}`} size={size} lh={1.08} stagger={6} /></div>
        <div style={{ position: "absolute", left: 0, top: 0 }}><MaskLines lines={["Eleven layers,", "in the browser."]} from={300} to={560} font={`400 1px ${sans}`} size={size} lh={1.08} stagger={6} /></div>
        <div style={{ position: "absolute", left: 0, top: 0 }}><MaskLines lines={["Live.", "Try it yourself."]} from={580} font={`400 1px ${sans}`} size={size} lh={1.08} stagger={6} /></div>
      </div>
      <div style={{ marginTop: 26 * s, display: "flex", alignItems: "center", gap: 16 * s, font: `500 ${(tall ? 26 : 22) * s}px ${mono}`, letterSpacing: "0.12em", color: C.grey, whiteSpace: "nowrap",
        opacity: interpolate(frame, [30, 46], [0, 1], { ...clamp, easing: out }) }}>
        <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />{URL}
      </div>
    </>
  );

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Atmosphere cy={tall ? 0.62 : 0.45} clearR={0.42} />
      <div style={{ position: "absolute", inset: 0, opacity: inK, translate: `0 ${(1 - inK) * 40 * s}px` }}>
        {tall
          ? <Phone src={src} top={640 * s} screenH={1180 * s} s={s} width={width} />
          : <Browser src={src} top={200 * s} left={pad} w={width - 2 * pad} s={s} />}
      </div>
      <Brand top={topSafe} left={pad} s={s} />
      <div style={{ position: "absolute", left: pad, top: tall ? 380 * s : 890 * s }}>{caption}</div>
      {tall ? null : <Progress bottom={40 * s} left={width - pad - 220 * s} width={220 * s} s={s} label="LIVE SITE" />}
    </AbsoluteFill>
  );
};
