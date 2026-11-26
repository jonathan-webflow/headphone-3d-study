// Roteiro da página: 12 capítulos presos ao scroll (GSAP timeline + ScrollTrigger).
// Cada capítulo anima um "estado" comum (câmera, peças, destaques, fundo);
// o main.js só lê esse estado a cada quadro. Unidade de tempo = vh de rolagem.

// ---------- Câmeras (Y-up do Three.js; X+ = lado de fora da concha direita, Z+ = frente) ----------
// t = alvo, d = direção do alvo até a câmera, dist em metros, fov vertical, off = deslocamento
// horizontal do quadro (negativo empurra o produto para a direita, positivo para a esquerda).
const P = (t, d, dist, fov, off) => ({ tx: t[0], ty: t[1], tz: t[2], dx: d[0], dy: d[1], dz: d[2], dist, fov, off });
export const CAMS = {
  hero:     P([0.005, 0.092, 0],     [0.728, 0.198, 0.655], 0.68, 26, -0.1),
  formA:    P([0.066, 0.062, 0.036], [0.30, 0.18, 1.0],     0.22, 30, 0.15),
  formB:    P([0.068, 0.006, 0.0],   [0.35, -0.75, 0.60],   0.19, 30, 0.15),
  formC:    P([0.084, 0.070, -0.022],[1.0, 0.30, 0.25],     0.19, 30, 0.15),
  glass:    P([0.140, 0.040, 0],     [0.80, 0.22, 0.60],    0.36, 30, -0.16),
  rim:      P([0.160, 0.040, 0],     [0.75, 0.25, 0.65],    0.33, 30, -0.16),
  plate:    P([0.152, 0.038, 0.001], [1.0, 0.10, 0.22],     0.21, 30, 0.035),
  board:    P([0.138, 0.062, 0.001], [0.85, 0.40, 0.45],    0.13, 30, -0.17),
  driverA:  P([0.121, 0.038, 0],     [1.0, 0.12, 0.20],     0.19, 30, -0.22),
  driverB:  P([0.118, 0.038, 0],     [0.25, 0.18, 1.0],     0.18, 30, -0.22),
  battery:  P([0.100, 0.016, 0.001], [0.65, 0.55, 0.55],    0.13, 30, -0.18),
  inside:   P([0.030, 0.043, 0],     [-0.40, 0.30, 1.0],    0.37, 30, 0.14),
  comfort:  P([-0.030, 0.043, 0],    [-0.65, 0.25, 0.75],   0.28, 30, -0.15),
  lineup:   P([0.065, 0.045, 0],     [0.22, 0.22, 1.0],     0.62, 30, 0.0),
};

// ---------- Pontos de interesse (entram um a um dentro do seu capítulo) ----------
// obj = nome no .glb; o ponto é o centro da caixa do objeto. side = deslocamento do rótulo em px.
export const HOTSPOTS = [
  { id: "roller",  ch: "form",    obj: "CupR_Btn_Roller",      title: "Roller",          sub: "Roll for volume, press to play, hold for noise control", side: [150, -70] },
  { id: "paddle",  ch: "form",    obj: "CupR_Btn_Paddle",      title: "Paddle",          sub: "Flick to skip, hold to scrub, press for calls",          side: [170, 40] },
  { id: "usbc",    ch: "form",    obj: "CupR_USBC_Tongue",     title: "USB-C",           sub: "Charging port",                                          side: [160, 60] },
  { id: "button",  ch: "form",    obj: "CupR_Btn_Assist",      title: "Button",          sub: "Smart assistant, customisable",                          side: [150, -80] },
  { id: "glass",   ch: "glass",   obj: "CupR_01_Glass",        title: "9H glass",        sub: "Transparent window",                                     side: [140, -120] },
  { id: "rim",     ch: "rim",     obj: "CupR_02_Rim",          title: "Aluminium bezel", sub: "Holds the glass and the arm in one line",                side: [150, -110], pick: "top" },
  { id: "red",     ch: "plate",   obj: "CupR_03f_RedSquare",   title: "Red accent",      sub: "The one colour on the cup",                              side: [-190, 70] },
  { id: "type",    ch: "plate",   obj: "CupR_03k_Text",        title: "Vertical type",   sub: "Printed on the inner plate",                             side: [-210, -30] },
  { id: "icon",    ch: "plate",   obj: "CupR_03j_Icon",        title: "Icon",            sub: "A small graphic signature",                              side: [-200, -100] },
  { id: "dots",    ch: "plate",   obj: "CupR_03h_DotGrid",     title: "Dot grid",        sub: "Dot-matrix detail, repeated in miniature",               side: [-180, 110] },
  { id: "soc",     ch: "board",   obj: "CupR_06_PCB_SoC",      title: "Processor",       sub: "Wireless and noise cancelling",                          side: [170, -90] },
  { id: "dsp",     ch: "board",   obj: "CupR_06_PCB_DSP",      title: "Audio DSP",       sub: "Signal processing",                                      side: [190, -40] },
  { id: "pmic",    ch: "board",   obj: "CupR_06_PCB_PMIC",     title: "Power",           sub: "Charging and battery management",                        side: [180, 80] },
  { id: "driver",  ch: "driver",  obj: "CupR_04_Driver",       title: "40 mm driver",    sub: "Dynamic, PET dome diaphragm",                            side: [210, 120] },
  { id: "coil",    ch: "driver",  obj: "CupR_04b_Coil",        title: "Voice coil",      sub: "Copper winding behind the cone",                         side: [210, -70] },
  { id: "battery", ch: "battery", obj: "CupR_07_Battery",      title: "1060 mAh",        sub: "Lithium-ion cell",                                       side: [180, -80] },
  { id: "frame",   ch: "inside",  obj: "CupR_05_DriverFrame",  title: "Driver baffle",   sub: "Vented acoustic mount",                                  side: [-210, -120] },
  { id: "chassis", ch: "inside",  obj: "CupR_08_Chassis",      title: "Inner chassis",   sub: "Ribs and acoustic port",                                 side: [-230, 40] },
  { id: "tray",    ch: "inside",  obj: "CupR_09b_Tray",        title: "Aluminium tray",  sub: "Base for the ear cushion",                               side: [-210, 140] },
  { id: "foam",    ch: "comfort", obj: "CupR_10_CushionFoam",  title: "Foam core",       sub: "Dual-layer comfort",                                     side: [180, -110] },
  { id: "cover",   ch: "comfort", obj: "CupR_11_CushionCover", title: "Ear cushion",     sub: "Soft synthetic leather",                                 side: [200, 100] },
];

// Peças da vista "lineup" (todas juntas, em colunas)
export const LINEUP = [
  ["CupR_01_Glass", "01", "9H glass window"], ["CupR_02_Rim", "02", "Aluminium bezel"],
  ["CupR_03_FacePlate", "03", "Graphic plate"], ["CupR_06_PCB", "04", "Main board"],
  ["CupR_04_Driver", "05", "40 mm driver"], ["CupR_07_Battery", "06", "1060 mAh battery"],
  ["CupR_05_DriverFrame", "07", "Driver baffle"], ["CupR_08_Chassis", "08", "Inner chassis"],
  ["CupR_09b_Tray", "09", "Aluminium tray"], ["CupR_10_CushionFoam", "10", "Foam core"],
  ["CupR_11_CushionCover", "11", "Ear cushion"],
];
export const PART_NAMES = LINEUP.map((l) => l[0]);
// Objetos "de contexto" que somem quando a câmera vai para trás da concha
export const REST_PREFIXES = ["CupL_", "Arm_L", "Band", "BandPad", "Slider_L", "Slider_R"];

// ---------- Construção da timeline ----------
export function buildTimeline(gsap, S, dom, SplitText) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
  const chapters = [];
  let t0 = 0;

  const cam = (preset, at, dur, ease = "power2.inOut") => tl.to(S.cam, { ...CAMS[preset], duration: dur, ease }, at);
  const out = (names, at, dur) => tl.to(S.ex, { ...Object.fromEntries(names.map((n) => [n, 1])), duration: dur }, at);
  const dim = (names, v, at, dur = 8) => tl.to(S.dim, { ...Object.fromEntries(names.map((n) => [n, v])), duration: dur }, at);
  // título entra linha a linha de dentro de uma máscara; o apoio vem depois, de desfocado a nítido
  const text = (id, s, L, keep = false) => {
    const el = dom.text[id]; if (!el) return;
    const h = el.querySelector("h1, h2"), rest = el.querySelectorAll(".eyebrow, .stat, .side, .specs, .end-actions");
    const lines = SplitText.create(h, { type: "lines", mask: "lines" }).lines;
    tl.fromTo(el, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, y: 0, duration: L * 0.01, ease: "none" }, s + L * 0.04);
    tl.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: L * 0.1, stagger: L * 0.03, ease: "power3.out" }, s + L * 0.045);
    tl.fromTo(rest, { autoAlpha: 0, y: 14, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: L * 0.09, stagger: L * 0.025, ease: "power2.out" }, s + L * 0.1);
    if (!keep) tl.to(el, { autoAlpha: 0, y: -18, duration: L * 0.07, ease: "power2.in" }, s + L * 0.9);
  };
  // número em destaque conta junto com o scroll
  const count = (id, s, L) => {
    const el = dom.count[id]; if (!el) return;
    tl.fromTo(el, { textContent: 0 }, { textContent: +el.dataset.count, snap: { textContent: 1 }, duration: L * 0.28, ease: "power2.out" }, s + L * 0.1);
  };
  const hotspots = (ch, s, L, from = 0.4, to = 0.86) => {
    const list = HOTSPOTS.filter((h) => h.ch === ch);
    const step = (to - from) / list.length;
    list.forEach((h, i) => {
      tl.to(S.hot, { [h.id]: 1, duration: L * step * 0.7, ease: "none" }, s + L * (from + i * step));
      tl.to(S.typ, { [h.id]: 1, duration: L * step * 0.8, ease: "none" }, s + L * (from + i * step));
      tl.to(S.typ, { [h.id]: 0, duration: L * 0.04, ease: "none" }, s + L * 0.925);
      if (i < list.length - 1) tl.to(S.hot, { [h.id]: 0.45, duration: L * 0.04, ease: "none" }, s + L * (from + (i + 1) * step));
      tl.to(S.hot, { [h.id]: 0, duration: L * 0.05, ease: "none" }, s + L * 0.92);
    });
  };
  const bgTo = (vals, at, dur) => tl.to(S.bg, { ...vals, duration: dur }, at);
  const chapter = (id, L, build) => { build(t0, L); chapters.push({ id, start: t0, len: L }); t0 += L; };

  // 1. Hero: o produto gira devagar
  chapter("hero", 110, (s, L) => {
    tl.to(S, { spin: 0.35, duration: L * 0.9, ease: "none" }, s);
    tl.to(dom.text.hero, { autoAlpha: 0, y: -24, duration: L * 0.12, ease: "power2.in" }, s + L * 0.82);
  });
  // 2. Form: a câmera passeia pela borda; controles um a um
  chapter("form", 230, (s, L) => {
    tl.to(S, { spin: 0, duration: L * 0.25 }, s);
    cam("formA", s, L * 0.3); bgTo({ rings: 0.35 }, s, L * 0.3);
    cam("formB", s + L * 0.5, L * 0.16);
    cam("formC", s + L * 0.7, L * 0.14);
    text("form", s, L); hotspots("form", s, L, 0.3, 0.9);
  });
  // 3. Glass: só o vidro sai
  chapter("glass", 150, (s, L) => {
    cam("glass", s, L * 0.35); out(["CupR_01_Glass"], s + L * 0.15, L * 0.45);
    text("glass", s, L); count("glass", s, L); hotspots("glass", s, L, 0.55, 0.85);
  });
  // 4. Rim
  chapter("rim", 150, (s, L) => {
    cam("rim", s, L * 0.3); dim(["CupR_01_Glass"], 1, s, L * 0.2);
    out(["CupR_02_Rim"], s + L * 0.12, L * 0.45);
    text("rim", s, L); hotspots("rim", s, L, 0.5, 0.85);
  });
  // 5. Graphic plate: os detalhes acendem um a um
  chapter("plate", 230, (s, L) => {
    cam("plate", s + L * 0.1, L * 0.35); dim(["CupR_01_Glass", "CupR_02_Rim"], 2, s, L * 0.25);
    out(["CupR_03_FacePlate"], s, L * 0.35);
    text("plate", s, L); hotspots("plate", s, L, 0.38, 0.9);
  });
  // 6. Main board (quieto, antes do ponto alto)
  chapter("board", 150, (s, L) => {
    cam("board", s, L * 0.35); dim(["CupR_03_FacePlate"], 2, s, L * 0.25);
    out(["CupR_06_PCB"], s + L * 0.1, L * 0.4); bgTo({ rings: 0.15, grid: 1 }, s, L * 0.3);
    text("board", s, L); hotspots("board", s, L, 0.45, 0.88);
  });
  // 7. Driver: o ponto alto (maior trecho)
  chapter("driver", 300, (s, L) => {
    dim(["CupR_06_PCB"], 2, s, L * 0.15);
    cam("driverA", s, L * 0.25); out(["CupR_04_Driver"], s + L * 0.12, L * 0.3);
    bgTo({ grid: 0, eq: 1 }, s + L * 0.1, L * 0.2);
    cam("driverB", s + L * 0.55, L * 0.25, "power3.inOut");
    text("driver", s, L); count("driver", s, L); hotspots("driver", s, L, 0.45, 0.88);
    bgTo({ eq: 0 }, s + L * 0.9, L * 0.1);
  });
  // 8. Battery
  chapter("battery", 130, (s, L) => {
    cam("battery", s, L * 0.35); dim(["CupR_04_Driver"], 1, s, L * 0.2);
    out(["CupR_07_Battery"], s + L * 0.12, L * 0.4); bgTo({ grid: 0.6 }, s, L * 0.3);
    text("battery", s, L); count("battery", s, L); hotspots("battery", s, L, 0.55, 0.85);
  });
  // 9. Inside out: a câmera vai para trás; o resto do headphone some
  chapter("inside", 230, (s, L) => {
    tl.to(S, { rest: 0, duration: L * 0.25 }, s); dim(["CupR_07_Battery"], 1, s, L * 0.2);
    cam("inside", s, L * 0.35, "power3.inOut"); bgTo({ grid: 0 }, s, L * 0.3);
    out(["CupR_11_CushionCover", "CupR_10_CushionFoam"], s + L * 0.1, L * 0.3);
    out(["CupR_09b_Tray"], s + L * 0.25, L * 0.3);
    out(["CupR_08_Chassis"], s + L * 0.35, L * 0.3);
    out(["CupR_05_DriverFrame"], s + L * 0.45, L * 0.3);
    dim(["CupR_11_CushionCover", "CupR_10_CushionFoam"], 1, s + L * 0.2, L * 0.15);
    text("inside", s, L); hotspots("inside", s, L, 0.5, 0.9);
  });
  // 10. Comfort: espuma e capa em foco
  chapter("comfort", 170, (s, L) => {
    cam("comfort", s, L * 0.35);
    dim(["CupR_05_DriverFrame", "CupR_08_Chassis", "CupR_09b_Tray"], 1, s, L * 0.2);
    dim(["CupR_11_CushionCover", "CupR_10_CushionFoam"], 0, s, L * 0.2);
    text("comfort", s, L); hotspots("comfort", s, L, 0.4, 0.85);
  });
  // 11. Lineup: todas as peças com rótulos
  chapter("lineup", 220, (s, L) => {
    cam("lineup", s, L * 0.35, "power3.inOut");
    dim(PART_NAMES, 0, s, L * 0.25);
    tl.to(S, { lineup: 1, duration: L * 0.3 }, s + L * 0.3);
    tl.to(S, { lineup: 0, duration: L * 0.08 }, s + L * 0.9);
    text("lineup", s, L);
  });
  // 12. Close: remonta, mostra a ficha e segura o encerramento (a página para aqui)
  chapter("close", 240, (s, L) => {
    tl.to(S.ex, { ...Object.fromEntries(PART_NAMES.map((n) => [n, 0])), duration: L * 0.34, ease: "power3.inOut" }, s + L * 0.04);
    tl.to(S, { rest: 1, duration: L * 0.2 }, s + L * 0.2);
    cam("hero", s + L * 0.08, L * 0.38, "power3.inOut"); bgTo({ rings: 1 }, s + L * 0.18, L * 0.25);
    text("close", s + L * 0.3, L * 0.5, true);
    tl.to({}, { duration: L * 0.18 }, s + L * 0.82);   // pausa final: nada se move, o fim assenta
  });

  return { tl, chapters, total: t0 };
}

// Vaga de cada etiqueta na coluna do seu capítulo (ordem de entrada)
const seen = {};
for (const h of HOTSPOTS) { h.slot = seen[h.ch] = (seen[h.ch] ?? -1) + 1; }
