import "./index.css";
import React from "react";
import { Composition, Still } from "remotion";
import { Teardown } from "./Teardown";
import { Post, PostProps } from "./Post";
import { Feature } from "./Feature";
import { CLIPS } from "./clips";
import { SITE_FRAMES, SiteFilm } from "./SiteFilm";
import { THREE_FRAMES, ThreeOutputs } from "./ThreeOutputs";
import { BTS_FRAMES, BehindScenes } from "./BehindScenes";
import { OgCase } from "./OgCase";
import { LightReveal, MacroCuts, MACRO_FRAMES, REVEAL_FRAMES } from "./LaunchFilms";

// rendered=false até o Blender gerar os quadros em case/renders/
const R = { c08: true, posts: true };
// comerciais de detalhe já renderizados no Blender (a lista cresce a cada lote)
const DONE = new Set<string>(["c01", "c02", "c03", "c04", "c05", "c06", "c07", "c09", "c10"]);

const POSTS: (Omit<PostProps, "rendered"> & { id: string })[] = [
  { id: "P01-Hero", still: "posts/p01.png", kicker: "TEARDOWN STUDY", title: ["HEADPHONE", "(1) PRO"], titleFont: "dot", sub: "Modelled from scratch in Blender, taken apart in the browser.", foot: "01 / 10", align: "bottom" },
  { id: "P02-Exploded", still: "posts/p02.png", kicker: "THE TEARDOWN", title: ["Eleven layers.", "One sound."], titleFont: "sans", sub: "Every part named, measured and placed.", foot: "02 / 10", align: "top" },
  { id: "P03-Driver", still: "posts/p03.png", kicker: "40 MM DYNAMIC DRIVER", title: ["40"], titleFont: "dot", sub: "A PET dome at the centre of everything.", foot: "03 / 10", align: "bottom" },
  { id: "P04-Controls", still: "posts/p04.png", kicker: "CONTROLS", title: ["Every control,", "where your", "hand expects it."], titleFont: "sans", sub: "A roller, a paddle and a button. Learn them once.", foot: "04 / 10", align: "bottom" },
  { id: "P05-Glass", still: "posts/p05.png", kicker: "GLASS HARDNESS", title: ["9H"], titleFont: "dot", sub: "A hardened window keeps the inside on show.", foot: "05 / 10", align: "bottom" },
  { id: "P06-Bezel", still: "posts/p06.png", kicker: "THE BEZEL", title: ["Cut from", "metal."], titleFont: "sans", sub: "Graphite aluminium holds the glass and the arm in one line.", foot: "06 / 10", align: "bottom" },
  { id: "P07-Plate", still: "posts/p07.png", kicker: "GRAPHIC PLATE", title: ["The layer", "you see."], titleFont: "sans", sub: "Red accent, dot grid and vertical type, right behind the glass.", foot: "07 / 10", align: "bottom" },
  { id: "P08-Battery", still: "posts/p08.png", kicker: "MAH BATTERY", title: ["1060"], titleFont: "dot", sub: "A lithium-ion cell, tucked under the driver.", foot: "08 / 10", align: "bottom" },
  { id: "P09-Comfort", still: "posts/p09.png", kicker: "COMFORT", title: ["Soft where", "it touches."], titleFont: "sans", sub: "A foam core wrapped in synthetic leather.", foot: "09 / 10", align: "bottom" },
  { id: "P10-Specs", still: "posts/p10.png", kicker: "SPECIFICATIONS", title: ["Headphone (1) Pro"], titleFont: "sans", sub: "Eleven layers, modelled from scratch.", foot: "10 / 10", align: "bottom", specs: [["Dimensions", "190.2 × 174.4 × 78 mm"], ["Weight", "327 g"], ["Bass driver", "40 mm dynamic"], ["Battery", "1060 mAh"]] },
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="C08-Teardown-9x16" component={Teardown} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{ rendered: R.c08 }} />
    <Composition id="C08-Teardown-4x5" component={Teardown} durationInFrames={300} fps={30} width={1080} height={1350} defaultProps={{ rendered: R.c08 }} />
    {CLIPS.map(({ id, frames, ...p }) => (
      <React.Fragment key={id}>
        <Composition id={`${id}-9x16`} component={Feature} durationInFrames={frames} fps={30} width={1080} height={1920} defaultProps={{ ...p, rendered: DONE.has(p.seq) }} />
        <Composition id={`${id}-4x5`} component={Feature} durationInFrames={frames} fps={30} width={1080} height={1350} defaultProps={{ ...p, rendered: DONE.has(p.seq) }} />
      </React.Fragment>
    ))}
    {/* peças novas: site em uso, um arquivo e três saídas, bastidores */}
    <Composition id="S01-Site-9x16" component={SiteFilm} durationInFrames={SITE_FRAMES + 60} fps={30} width={1080} height={1920} />
    <Composition id="S01-Site-4x5" component={SiteFilm} durationInFrames={SITE_FRAMES + 60} fps={30} width={1080} height={1350} />
    <Composition id="S02-ThreeOutputs-9x16" component={ThreeOutputs} durationInFrames={THREE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="S03-Behind-9x16" component={BehindScenes} durationInFrames={BTS_FRAMES} fps={30} width={1080} height={1920} />
    {/* filmes de lançamento: revelação pela luz e cortes em macro */}
    <Composition id="L01-Reveal-9x16" component={LightReveal} durationInFrames={REVEAL_FRAMES + 60} fps={30} width={1080} height={1920} />
    <Composition id="L01-Reveal-4x5" component={LightReveal} durationInFrames={REVEAL_FRAMES + 60} fps={30} width={1080} height={1350} />
    <Composition id="L02-Macro-9x16" component={MacroCuts} durationInFrames={MACRO_FRAMES + 30} fps={30} width={1080} height={1920} />
    <Still id="OG-Case" component={OgCase} width={1200} height={630} />
    {POSTS.map(({ id, ...p }) => (
      <Still key={id} id={id} component={Post} width={1080} height={1350} defaultProps={{ ...p, rendered: R.posts }} />
    ))}
  </>
);
