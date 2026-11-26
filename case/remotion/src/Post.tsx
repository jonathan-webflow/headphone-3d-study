import React from "react";
import { AbsoluteFill } from "remotion";
import { C, dot, mono, sans } from "./brand";
import { Brand, Plate } from "./parts";

// Post estático 4:5. Título em pontos ou em Geist, linha de apoio, rodapé técnico.
export type PostProps = { still: string; rendered: boolean; kicker: string; title: string[]; titleFont: "dot" | "sans"; sub: string; foot: string; align: "top" | "bottom"; specs?: [string, string][] };
export const Post: React.FC<PostProps> = ({ still, rendered, kicker, title, titleFont, sub, foot, align, specs }) => {
  const s = 1, pad = 80;
  const size = titleFont === "dot" ? (title.length === 1 && title[0].length <= 3 ? 240 : 128) : 88;
  const block = (
    <div>
      <div style={{ font: `500 22px ${mono}`, letterSpacing: "0.14em", color: C.grey, marginBottom: 22 }}>{kicker}</div>
      {title.map((l, i) => (
        <div key={i} style={{ font: titleFont === "dot" ? `800 ${size}px/0.95 ${dot}` : `400 ${size}px/1.06 ${sans}`, color: C.white, whiteSpace: "nowrap" }}>{l}</div>
      ))}
      <div style={{ marginTop: 24, font: `400 32px/1.4 ${sans}`, color: C.grey, width: 640 }}>{sub}</div>
      {specs ? (
        <div style={{ marginTop: 34, width: 920 }}>
          {specs.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
              <span style={{ font: `500 22px ${mono}`, letterSpacing: "0.12em", color: C.grey }}>{k.toUpperCase()}</span>
              <span style={{ font: `400 30px ${sans}`, color: C.white }}>{v}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
  const shade = align === "bottom" ? "to top" : "to bottom";
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Plate still={still} rendered={rendered} />
      <AbsoluteFill style={{ background: `linear-gradient(${shade}, rgba(0,0,0,0.8) 18%, rgba(0,0,0,0) 52%)` }} />
      {/* a assinatura fica sempre no topo; sombra leve atrás dela quando o texto está embaixo */}
      {align === "bottom" ? <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 20%)" }} /> : null}
      <Brand top={70} left={pad} s={s} from={-100} />
      <div style={{ position: "absolute", left: pad, ...(align === "bottom" ? { bottom: 90 } : { top: 200 }) }}>{block}</div>
      <div style={{ position: "absolute", right: pad, ...(align === "bottom" ? { top: 92 } : { bottom: 92 }), font: `500 20px ${mono}`, letterSpacing: "0.12em", color: C.grey }}>{foot}</div>
    </AbsoluteFill>
  );
};
