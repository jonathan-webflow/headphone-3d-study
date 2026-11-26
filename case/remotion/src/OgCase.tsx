import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, dot, mono, sans } from "./brand";
import { Atmosphere } from "./Atmosphere";
import { Brand } from "./parts";

// Prévia social da página /case (1200 × 630): título à esquerda, a pilha explodida à direita.
export const OgCase: React.FC = () => (
  <AbsoluteFill style={{ background: C.black }}>
    <Atmosphere cx={0.74} cy={0.5} clearR={0.34} />
    <Img src={staticFile("renders/posts/p02.png")} style={{ position: "absolute", right: -40, top: -150, height: 930 }} />
    <Brand top={56} left={64} s={0.9} full from={-100} />
    <div style={{ position: "absolute", left: 64, bottom: 64 }}>
      <div style={{ font: `500 18px ${mono}`, letterSpacing: "0.14em", color: C.grey, marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.red }} />CASE STUDY / 3D STUDY 01
      </div>
      <div style={{ font: `800 96px/0.95 ${dot}`, color: C.white }}>HEADPHONE<br />(1) PRO</div>
      <div style={{ marginTop: 24, font: `400 26px/1.35 ${sans}`, color: C.grey, width: 640 }}>Concept, 3D, front-end and motion.<br />One site, 13 films, 10 posts.</div>
    </div>
  </AbsoluteFill>
);
