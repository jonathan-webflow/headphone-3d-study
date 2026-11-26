import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, mono, out, sans } from "./brand";
import { Atmosphere } from "./Atmosphere";
import { Brand, MaskLines } from "./parts";
import { Phone, Wipe } from "./devices";
import { SITE_FRAMES } from "./SiteFilm";

// Reel "one file, three outputs": o mesmo modelo como viewport do Blender (argila), como site e como filme.
// A argila e o filme usam a mesma câmera do c01, então a cortina troca só o acabamento.
export const THREE_FRAMES = 480;
const A = 150, B = 300, W = 20;   // começo do site, começo do filme, duração da cortina
const pad4 = (n: number) => String(n).padStart(4, "0");

const Viewport: React.FC<{ s: number }> = ({ s }) => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #3a3a3a 0%, #262626 70%)" }}>
    {/* chão do viewport: grade em perspectiva e os eixos X (vermelho) e Y (verde) */}
    <div style={{ position: "absolute", left: "-50%", right: "-50%", top: "52%", height: "70%", transformOrigin: "50% 0", transform: "perspective(900px) rotateX(72deg)",
      backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: `${90 * s}px ${90 * s}px`,
      maskImage: "linear-gradient(to bottom, black, transparent 80%)" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "20%", height: 2, background: "rgba(215,60,60,0.7)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, background: "rgba(120,190,80,0.6)" }} />
    </div>
  </AbsoluteFill>
);

export const ThreeOutputs: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const s = width / 1080, pad = 80 * s, bottomSafe = 420 * s, topSafe = 250 * s;
  const kB = interpolate(frame, [A, A + W], [0, 1], { ...clamp, easing: out });
  const kC = interpolate(frame, [B, B + W], [0, 1], { ...clamp, easing: out });
  const clay = pad4(Math.min(frame, A + W) + 1);
  const site = pad4(Math.max(0, Math.min(frame - A, SITE_FRAMES - 1)) + 1);
  const film = pad4(Math.min(300, 120 + Math.max(0, frame - B) + 1));

  const steps = [
    { from: 0, to: A, n: "01", tool: "BLENDER", lines: ["One model."] },
    { from: A, to: B, n: "02", tool: "THREE.JS", lines: ["A website."] },
    { from: B, to: 410, n: "03", tool: "REMOTION", lines: ["A campaign."] },
  ];

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Viewport s={s} />
      <Img src={staticFile(`renders/c01_wb/${clay}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <Wipe k={kB}>
        <AbsoluteFill style={{ background: C.black }}><Atmosphere cy={0.45} clearR={0.4} /></AbsoluteFill>
        <Phone src={`renders/site/mobile/${site}.jpg`} top={360 * s} screenH={900 * s} s={s} width={width} />
      </Wipe>
      <Wipe k={kC}>
        <AbsoluteFill style={{ background: C.black }}><Atmosphere /></AbsoluteFill>
        <Img src={staticFile(`renders/c01/${film}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </Wipe>
      <AbsoluteFill style={{ background: `linear-gradient(to top, rgba(0,0,0,0.85) ${bottomSafe / 19.2}%, rgba(0,0,0,0) ${(bottomSafe + 520 * s) / 19.2}%)` }} />
      <Brand top={topSafe} left={pad} s={s} />

      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        {steps.map((st) => (
          <div key={st.n} style={{ position: "absolute", left: 0, bottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 * s, marginBottom: 20 * s, font: `500 ${28 * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey, whiteSpace: "nowrap",
              opacity: interpolate(frame, [st.from + 8, st.from + 22, st.to - 10, st.to], [0, 1, 1, 0], clamp) }}>
              <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: C.red }} />{st.n} · {st.tool}
            </div>
            <MaskLines lines={st.lines} from={st.from + 10} to={st.to - 14} font={`400 1px ${sans}`} size={110 * s} lh={1.05} />
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, bottom: 0 }}>
          <MaskLines lines={["One file,", "three outputs."]} from={414} font={`400 1px ${sans}`} size={110 * s} lh={1.05} stagger={6} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
