import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, dot, mono, out, sans } from "./brand";
import { Atmosphere } from "./Atmosphere";
import { Brand, MaskLines } from "./parts";

// Bastidores: do blockout ao filme. Prints reais do processo (previews/), trechos reais do código
// e, no fim, os dez filmes rodando juntos.
export const BTS_FRAMES = 540;
const STEP = 36, P0 = 70, CODE0 = P0 + 6 * STEP, CODE = 60, GRID0 = CODE0 + 3 * CODE;

const SHOTS = [
  { src: "previews/01_blockout.png", name: "BLOCKOUT", ar: 1 },
  { src: "previews/02_concha.png", name: "SHELL", ar: 1 },
  { src: "previews/03_janela.png", name: "WINDOW", ar: 1104 / 550 },
  { src: "previews/05a_conjunto.png", name: "ASSEMBLY", ar: 1 },
  { src: "previews/06_render_v3.png", name: "LOOK", ar: 1200 / 1350 },
  { src: "previews/07_explodida.png", name: "TEARDOWN", ar: 1.6 },
];

// trechos de tools/film_render.py, web/main.js e case/remotion/src/parts.tsx (quebrados para caber)
const CODES = [
  { tool: "BLENDER · PYTHON", file: "film_render.py", code: [
    "def c01(f, cam):   # the whole headphone turns",
    "    layers(True, True); parts()",
    "    scene.view_settings.exposure = lerp(",
    "        -4, -0.15, ease_out(f / 10))",
    "    shot(f, cam, [",
    "        dict(f=0, t=(0.01, 0, 0.095),",
    "             d=(0.35, -0.9, 0.22), lens=70),",
    "        dict(f=300, t=(0.0, 0, 0.095),",
    "             d=(0.85, -0.55, 0.25), lens=70),",
    "    ])",
  ] },
  { tool: "SITE · JAVASCRIPT", file: "main.js", code: [
    "const lenis = new Lenis({ lerp: 0.065 });",
    "lenis.on(\"scroll\", ScrollTrigger.update);",
    "gsap.ticker.add((t) => lenis.raf(t * 1000));",
    "",
    "const st = ScrollTrigger.create({",
    "  trigger: track,",
    "  start: \"top top\", end: \"bottom bottom\",",
    "  animation: tl,  // one timeline, 12 chapters",
    "  scrub: 0.8,     // the scene settles",
    "});",
  ] },
  { tool: "FILMS · REMOTION", file: "parts.tsx", code: [
    "const src = staticFile(",
    "  `renders/${seq}/${pad(frame + 1)}.png`",
    ");",
    "return (",
    "  <AbsoluteFill>",
    "    <Atmosphere />  {/* the site's dot field */}",
    "    <Img src={src} /> {/* Blender frame, alpha */}",
    "  </AbsoluteFill>",
    ");",
  ] },
];

// cor mínima: comentário apagado, texto entre aspas cinza, o resto branco
const Line: React.FC<{ text: string }> = ({ text }) => {
  const m = text.match(/(\s*(#|\/\/|\{\/\*).*)$/);
  const body = m ? text.slice(0, m.index) : text, note = m ? m[1] : "";
  const parts = body.split(/("[^"]*"|`[^`]*`)/);
  return <>{parts.map((p, i) => <span key={i} style={{ color: /^["`]/.test(p) ? C.grey : C.white }}>{p}</span>)}<span style={{ color: "#6b6b6b" }}>{note}</span></>;
};

export const BehindScenes: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const s = width / 1080, pad = 80 * s, bottomSafe = 420 * s, topSafe = 250 * s;
  const cardW = width - 2 * pad, midY = 820 * s;   // centro da área entre a marca e o texto

  const shot = Math.floor((frame - P0) / STEP);
  const code = Math.floor((frame - CODE0) / CODE);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Atmosphere cy={0.42} clearR={0.45} />

      {/* 1. prints do processo, um por vez, com corte seco e um leve recuo */}
      {shot >= 0 && shot < SHOTS.length ? (() => {
        const sh = SHOTS[shot], t = frame - P0 - shot * STEP, h = Math.min(cardW / sh.ar, 900 * s), w = h * sh.ar;
        const k = interpolate(t, [0, 14], [0, 1], { ...clamp, easing: out });
        return (
          <>
            <div style={{ position: "absolute", left: (width - w) / 2, top: midY - h / 2, width: w, height: h, borderRadius: 18 * s, overflow: "hidden",
              boxShadow: `inset 0 0 0 ${1.5 * s}px rgba(255,255,255,0.14)`, scale: `${1.04 - 0.04 * k}`, clipPath: `inset(${(1 - k) * 100}% 0 0 0 round ${18 * s}px)` }}>
              <Img src={staticFile(sh.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ position: "absolute", left: pad, bottom: bottomSafe, display: "flex", alignItems: "baseline", gap: 28 * s }}>
              <span style={{ font: `800 ${200 * s}px/0.9 ${dot}`, color: C.white }}>{String(shot + 1).padStart(2, "0")}</span>
              <span style={{ font: `500 ${32 * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey }}>{sh.name}</span>
            </div>
          </>
        );
      })() : null}

      {/* 2. código real, linha a linha */}
      {code >= 0 && code < CODES.length ? (() => {
        const c = CODES[code], t = frame - CODE0 - code * CODE;
        const k = interpolate(t, [0, 12, CODE - 8, CODE], [0, 1, 1, 0], clamp);
        return (
          <>
            <div style={{ position: "absolute", left: pad, width: cardW, top: midY - 330 * s, padding: `${34 * s}px ${36 * s}px`, borderRadius: 18 * s, background: "rgba(12,12,12,0.92)",
              boxShadow: `inset 0 0 0 ${1.5 * s}px rgba(255,255,255,0.14)`, opacity: k }}>
              <div style={{ font: `500 ${20 * s}px ${mono}`, letterSpacing: "0.12em", color: "#6b6b6b", marginBottom: 26 * s }}>{c.file}</div>
              {c.code.map((l, i) => (
                <div key={i} style={{ font: `400 ${27 * s}px/1.6 ${mono}`, whiteSpace: "pre", height: 27 * 1.6 * s,
                  opacity: interpolate(t, [4 + i * 2, 10 + i * 2], [0, 1], clamp) }}><Line text={l} /></div>
              ))}
            </div>
            <div style={{ position: "absolute", left: pad, bottom: bottomSafe, display: "flex", alignItems: "center", gap: 16 * s, font: `500 ${32 * s}px ${mono}`, letterSpacing: "0.14em", color: C.grey, opacity: k }}>
              <span style={{ width: 14 * s, height: 14 * s, borderRadius: "50%", background: C.red }} />{c.tool}
            </div>
          </>
        );
      })() : null}

      {/* 3. os dez filmes juntos */}
      {frame >= GRID0 ? (
        <div style={{ position: "absolute", left: pad, top: 400 * s, width: cardW, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 * s }}>
          {["c01_hero", "c02_controls", "c03_glass", "c04_bezel", "c05_plate", "c06_driver", "c07_battery", "c08_teardown", "c09_comfort", "c10_rebuild"].map((n, i) => (
            <div key={n} style={{ aspectRatio: "9 / 16", borderRadius: 10 * s, overflow: "hidden", background: "#0b0b0b",
              opacity: interpolate(frame, [GRID0 + i * 2, GRID0 + 10 + i * 2], [0, 1], { ...clamp, easing: out }) }}>
              <OffthreadVideo src={staticFile(`films/${n}_9x16.mp4`)} muted startFrom={60} style={{ width: "100%", height: "100%" }} />
            </div>
          ))}
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 20%)" }} />
      <Brand top={topSafe} left={pad} s={s} />

      {/* textos que abrem e fecham */}
      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        <MaskLines lines={["BEHIND", "THE STUDY."]} from={8} to={P0 - 10} font={`800 1px ${dot}`} size={150 * s} lh={0.95} />
      </div>
      <div style={{ position: "absolute", left: pad, bottom: bottomSafe }}>
        <MaskLines lines={["Ten films.", "Ten posts.", "One site."]} from={GRID0 + 14} font={`400 1px ${sans}`} size={92 * s} lh={1.08} stagger={6} />
      </div>
    </AbsoluteFill>
  );
};
