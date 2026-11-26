import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { createBackground, createDust, createOrbit } from "./atmosphere.js";
import { loadStudio, createPost } from "./studio.js";
import { initMenu } from "./menu.js";
import { createLoaderGrid } from "./loader.js";
import { createReveal } from "./particles.js";
import { CAMS, HOTSPOTS, LINEUP, PART_NAMES, REST_PREFIXES, buildTimeline } from "./chapters.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

// ---------- Estado animado pela timeline (chapters.js) ----------
const S = {
  cam: { ...CAMS.hero },
  ex: Object.fromEntries(PART_NAMES.map((n) => [n, 0])),   // 0 montado, 1 explodido
  dim: Object.fromEntries(PART_NAMES.map((n) => [n, 0])),  // 1 = escurecida (fora de foco)
  hot: Object.fromEntries(HOTSPOTS.map((h) => [h.id, 0])),   // destaque do ponto
  typ: Object.fromEntries(HOTSPOTS.map((h) => [h.id, 0])),   // etiqueta aberta e digitada (0 → 1)
  bg: { rings: 1, grid: 0, eq: 0 },
  rest: 1,     // concha esquerda + arco
  lineup: 0,   // rótulos de todas as peças
  spin: 0,     // giro do produto no herói
  intro: 0,    // giro extra da entrada, depois do loading
  pull: 0,     // recuo extra da câmera na entrada (fração da distância)
  fx: 1,       // poeira e arco orbital (0 → 1 na entrada)
};

// ---------- Renderer, cena, câmera ----------
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.16;
const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 4);

const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-0.3, 0.42, 0.45); scene.add(key);
const rimR = new THREE.DirectionalLight(0xffffff, 1.6); rimR.position.set(0.06, 0.32, -0.5); scene.add(rimR);
const rimL = new THREE.DirectionalLight(0xf4f4f4, 1.2); rimL.position.set(-0.45, 0.22, -0.25); scene.add(rimL);
// luz de recorte que acompanha a câmera: desenha um filete na peça em foco
const kicker = new THREE.DirectionalLight(0xffffff, 2.1); scene.add(kicker); scene.add(kicker.target);
scene.add(new THREE.HemisphereLight(0x5a5a5a, 0x050505, 0.25));
const manager = new THREE.LoadingManager();
const load = { real: 0, ready: false };
let reveal = null, modelObj = null;   // partículas da entrada (web/particles.js)
const warm = { done: false };
let sceneShown = false;   // vira true quando o loader começa a sair: antes disso a cena 3D não é desenhada (ninguém a vê)
let moduleReady; const moduleDone = new Promise((r) => (moduleReady = r));   // o módulo tem await no topo (fontes)
// tudo o que o navegador compilaria na primeira vez em que aparece (o fone inteiro, as peças em modo
// transparente, as partículas) é compilado agora, atrás do loader; assim a entrada e a primeira rolagem não travam
async function warmUp(model) {
  const t0 = performance.now();
  try {
    await envDone; await moduleDone;
    model.visible = true;
    const mats = []; model.traverse((o) => o.isMesh && !o.material.userData.glass && mats.push(o.material));
    const flags = mats.map((m) => m.transparent);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    mats.forEach((m) => { m.transparent = !m.transparent; m.needsUpdate = true; });
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    mats.forEach((m, i) => { m.transparent = flags[i]; m.needsUpdate = true; });
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    renderFrame(performance.now() / 1000, true);   // um quadro invisível sobe as texturas e o pós-processamento
  } catch (e) { console.warn("[headphone] warm-up", e); }
  finally {
    if (reveal) model.visible = false;
    warm.done = true;
    console.info(`[headphone] warm-up ${(performance.now() - t0).toFixed(0)} ms`);
  }
}
// progresso real por bytes: modelo e HDR são a maior parte; as texturas entram pela contagem do manager
const bytes = { glb: 0, hdr: 0, items: 0 };
const bump = () => { load.real = Math.max(load.real, (0.35 * bytes.glb + 0.45 * bytes.hdr + 0.2 * bytes.items) * 0.96); };
const frac = (e) => (e && e.total ? e.loaded / e.total : 0);
manager.onProgress = (_url, loaded, total) => { bytes.items = loaded / total; bump(); };
let envReady; const envDone = new Promise((r) => (envReady = r));
loadStudio(renderer, scene, "env/studio.hdr", () => { scene.environmentIntensity = 0.9; bytes.hdr = 1; bump(); envReady(); }, manager, (e) => { bytes.hdr = frac(e); bump(); });

const root = new THREE.Group();
scene.add(root);
const bg = createBackground();
const dust = createDust(new THREE.Vector3(0.06, 0.09, 0));
scene.add(dust.points);
const orbit = createOrbit();
scene.add(orbit.group);

// ---------- Overlay: pontos de interesse e rótulos do lineup ----------
const SVGNS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("lines");
const labelsEl = document.getElementById("labels");
const el = (tag, cls, parent, html = "") => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };

const hotspots = HOTSPOTS.map((h) => ({
  ...h,
  ring: sv("circle", { r: 16, class: "hs-ring", pathLength: 100 }),
  core: sv("circle", { r: 2.5, class: "hs-core" }),
  line: sv("polyline", { class: "hs-line", pathLength: 100 }),
  label: el("div", "hs-label", labelsEl, `<b></b><span></span>`),
}));
const lineup = LINEUP.map(([name, n, title], i) => ({
  name, front: i < 6, slot: i < 6 ? i : i - 6,
  line: sv("line", { class: "lu-line" }), dot: sv("circle", { r: 2, class: "hs-core" }),
  label: el("div", "label", labelsEl, `<span class="n">${n}</span>${title}`),
}));

// ---------- Modelo ----------
const parts = {};          // nome → { obj, base, dx, mats: [{m, color}] }
const rest = [];           // objetos de contexto (somem atrás)
const anchors = {};        // nome → centro local (para pontos de interesse)
const draco = new DRACOLoader(manager).setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/draco/gltf/");
const loader = new GLTFLoader(manager).setDRACOLoader(draco);
const pct = document.getElementById("loadpct");

// ---------- Texturas: mapas repetíveis por material + oclusão assada por peça ----------
const TL = new THREE.TextureLoader(manager), texCache = {};
function tile(file, repeat, srgb = false) {
  const k = file + repeat;
  if (!texCache[k]) {
    const t = TL.load(`tex/${file}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache[k] = t;
  }
  return texCache[k];
}
const AO_MAPS = ["CupR_09_Shell", "CupL_09_Shell", "CupR_09b_Tray", "CupR_08_Chassis", "CupR_05_DriverFrame", "CupR_04_Driver",
  "CupR_11_CushionCover", "CupR_10_CushionFoam", "Slider_R", "CupR_02_Rim"];
function applyTextures(o, m) {
  const n = m.name, relief = (file, repeat, scale) => { m.normalMap = tile(file, repeat); m.normalScale.set(scale, scale); };
  // a UV 0 é uma projeção em caixa em escala real: 1 unidade = 3 cm
  if (n.startsWith("MAT-alu")) relief("alu_blast_n", 5, 0.3);
  else if (n.startsWith("MAT-titanium")) relief("alu_blast_n", 7, 0.2);
  else if (n.startsWith("MAT-leather")) { relief("leather_n", 2.4, 0.32); m.roughnessMap = tile("leather_r", 2.4); m.roughness = 0.95; m.sheen = 0.35; }
  else if (n.startsWith("MAT-foam")) { relief("foam_n", 3.5, 0.9); m.map = tile("foam_c", 3.5, true); m.color.set(0x7a7b80); }
  else if (n.startsWith("MAT-fabric")) relief("fabric_n", 6, 1.0);
  else if (n.startsWith("MAT-plastic_softtouch") || n.startsWith("MAT-plastic_gray")) relief("soft_n", 4, 0.25);
  // oclusão assada (UV 1); as peças espelhadas da esquerda usam o mapa da direita
  let key = o.name;
  if (!AO_MAPS.includes(key)) key = key.replace("CupL_", "CupR_").replace("Slider_L", "Slider_R");
  if (AO_MAPS.includes(key) && o.geometry.attributes.uv1) {
    const t = TL.load(`tex/ao_${key}.webp`); t.flipY = false; t.channel = 1;
    m.aoMap = t; m.aoMapIntensity = 1.0;
  }
  m.needsUpdate = true;
}

function anchorFor(o, pick) {
  const box = new THREE.Box3().setFromObject(o);
  const c = box.getCenter(new THREE.Vector3());
  if (pick === "top") c.y = box.max.y;
  return o.worldToLocal(c);
}

loader.load(
  "models/headphone.draco.glb",
  (gltf) => {
    const model = gltf.scene;
    root.add(model);
    model.updateMatrixWorld(true);
    // material próprio por malha (para escurecer/esconder peça por peça)
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      const m = o.material;
      if (m.name === "MAT-glass_smoke") {
        m.transmission = 0; m.transparent = true; m.opacity = 0.22; m.depthWrite = false; m.userData.glass = true;
        m.color.set(0x0b0c0e); m.metalness = 0; m.roughness = 0.03; m.clearcoat = 1; m.clearcoatRoughness = 0.02; m.envMapIntensity = 1.6;
      }
      if (m.name.startsWith("MAT-leather")) { m.roughness = 0.46; m.sheen = 0.6; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color(0x30333a); m.color.set(0x0c0c0d); }
      if (m.name.startsWith("MAT-fabric")) { m.roughness = 0.9; m.sheen = 1; m.sheenRoughness = 0.7; m.sheenColor = new THREE.Color(0x2a2a2e); }
      if (m.name.startsWith("MAT-foam")) { m.roughness = 1; m.sheen = 0.5; m.sheenRoughness = 0.9; m.sheenColor = new THREE.Color(0x55565a); }
      if (m.name.startsWith("MAT-alu")) { m.metalness = 1; m.roughness = m.name.includes("rim") ? 0.26 : 0.36; m.color.set(m.name.includes("rim") ? 0x53565c : 0x464a51); m.clearcoat = 0.25; m.clearcoatRoughness = 0.45; }
      if (m.name.startsWith("MAT-titanium")) { m.metalness = 1; m.roughness = 0.3; m.color.set(0x3a3a3d); }
      if (m.name.startsWith("MAT-plastic_softtouch")) { m.roughness = 0.62; m.color.set(0x161718); m.sheen = 0.4; m.sheenRoughness = 0.6; m.sheenColor = new THREE.Color(0x3a3d44); }
      if (m.name === "MAT-copper_coil") { m.roughness = 0.22; }
      if (m.name === "MAT-battery_foil") { m.roughness = 0.24; m.clearcoat = 0.4; }
      applyTextures(o, m);
      m.userData.base = m.color.clone(); m.userData.opacity = m.opacity;
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0006, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) }));
    led.position.set(0.071, 0.0004, -0.0045); root.add(led);
    for (const name of PART_NAMES) {
      const o = model.getObjectByName(name);
      if (!o) { console.warn("missing", name); continue; }
      const mats = []; o.traverse((c) => c.isMesh && mats.push(c.material));
      parts[name] = { obj: o, base: o.position.x, dx: (o.userData.explode_dx_mm || 0) * 0.001, mats };
    }
    model.children.forEach((o) => {
      if (REST_PREFIXES.some((p) => o.name.startsWith(p))) {
        const mats = []; o.traverse((c) => { if (c.isMesh) { c.material.transparent = true; mats.push(c.material); } });
        rest.push({ obj: o, mats });
      }
    });
    for (const h of hotspots) {
      const o = model.getObjectByName(h.obj);
      if (o) { h.o = o; h.local = anchorFor(o, h.pick); } else console.warn("hotspot sem objeto", h.obj);
    }
    for (const l of lineup) { const o = model.getObjectByName(l.name); if (o) { l.o = o; l.local = anchorFor(o); } }
    console.log(`[headphone] ${Object.keys(parts).length} parts, ${hotspots.filter((h) => h.o).length} hotspots`);
    // entrada por partículas: amostra a superfície agora, ainda com o loader na tela; o fone só aparece depois
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { reveal = createReveal({ root, model, count: innerWidth < 760 ? 16000 : 36000 }); modelObj = model; model.visible = false; }
      catch (e) { console.warn("[headphone] reveal off", e); reveal = null; }
    }
    load.ready = true;
    ScrollTrigger.refresh();
    warmUp(model);
  },
  (e) => { bytes.glb = frac(e); bump(); },
  (err) => { pct.textContent = "ERR"; console.error(err); },
);

// ---------- Timeline + scroll ----------
const dom = {
  text: Object.fromEntries([...document.querySelectorAll("[data-ch]")].map((e) => [e.dataset.ch, e])),
  numeral: Object.fromEntries([...document.querySelectorAll("[data-numeral]")].map((e) => [e.dataset.numeral, e])),
};
dom.count = Object.fromEntries([...document.querySelectorAll("[data-count]")].map((e) => [e.closest("[data-ch]").dataset.ch, e]));
await document.fonts.ready;   // as quebras de linha dos títulos dependem das fontes
dom.block = Object.fromEntries(Object.entries(dom.text).map(([k, e]) => [k, e.querySelector(":scope > div") || e]));
const LABEL_PITCH = 78;   // altura de uma etiqueta de duas linhas + respiro
const { tl, chapters, total } = buildTimeline(gsap, S, dom, SplitText);
const track = document.querySelector(".track");
track.style.height = `${total + 100}vh`;   // 1 unidade da timeline = 1vh de rolagem

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lenis = new Lenis({ lerp: reduced ? 1 : 0.065, wheelMultiplier: 0.9, smoothWheel: !reduced, syncTouch: !reduced });
lenis.stop();   // só rola depois do loading
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

const st = ScrollTrigger.create({
  trigger: track, start: "top top", end: "bottom bottom",
  animation: tl, scrub: reduced ? true : 0.8,   // inércia: a cena assenta depois que a roda para
});

// barra inferior: atalhos e pontos de progresso
const fill = document.getElementById("fill"), now = document.getElementById("now");
const NAMES = { hero: "Overview", form: "Controls", glass: "Glass", rim: "Bezel", plate: "Graphic plate", board: "Main board", driver: "Driver", battery: "Battery", inside: "Inside out", comfort: "Comfort", lineup: "Eleven layers", close: "End" };
const chapterAt = (p) => { const t = p * total; let i = 0; chapters.forEach((c, k) => { if (t >= c.start - 0.5) i = k; }); return i; };
// ir para um capítulo: ponto de leitura no meio dele (o herói vai ao topo, o fim vai ao limite)
function goTo(id) {
  const c = chapters.find((c) => c.id === id);
  const y = id === "hero" ? 0 : id === "close" ? lenis.limit : st.start + (st.end - st.start) * ((c.start + c.len * 0.6) / total);
  lenis.start();
  lenis.scrollTo(y, { duration: reduced ? 0 : 2.6 });
}
const menu = initMenu({ goTo, onToggle: (open) => { if (document.body.classList.contains("booting")) return; open ? lenis.stop() : lenis.start(); } });
const jump = document.getElementById("jump"), jumpLabel = document.getElementById("jump-label");
jump.addEventListener("click", (e) => { e.preventDefault(); goTo(jump.dataset.goto || "close"); });
const legal = document.querySelector(".legal"); const subEl = document.querySelector(".hud .sub");
document.getElementById("replay").addEventListener("click", () => lenis.scrollTo(0, { duration: reduced ? 0 : 3.2 }));

// ---------- Loading: matriz de pontos que acende, frase de status e contador no canto; depois a cortina sobe ----------
const loaderEl = document.getElementById("loader"), bar = document.getElementById("loadbar");
const grid = createLoaderGrid(document.getElementById("loadgrid"), { reduced });
// frase de status: cada letra entra saindo do desfoque; troca conforme a fase do carregamento
const sayEl = document.getElementById("loadsay"); let sayText = sayEl.textContent.trim();
// leitores de tela ouvem a frase inteira (ld-sr); as letras animadas ficam escondidas deles
const splitSay = (text) => {
  sayEl.innerHTML = `<span class="ld-sr">${text}</span><span aria-hidden="true">${[...text].map((c) => `<span class="ld-c">${c === " " ? "&nbsp;" : c}</span>`).join("")}</span>`;
  grid.setClear(sayEl.getBoundingClientRect());   // a zona limpa acompanha o tamanho da frase
  return sayEl.querySelectorAll(".ld-c");
};
addEventListener("resize", () => grid.setClear(sayEl.getBoundingClientRect()));
// enquanto o loader está na tela, o resto da página sai do foco do teclado e dos leitores de tela
const behind = [...document.body.children].filter((el) => el !== loaderEl && !["SCRIPT", "LINK", "STYLE"].includes(el.tagName));
behind.forEach((el) => (el.inert = true));
const releaseBehind = () => behind.forEach((el) => (el.inert = false));
function sayIn() {
  const ch = splitSay(sayText);
  if (!reduced) gsap.fromTo(ch, { autoAlpha: 0, filter: "blur(8px)", yPercent: 40 }, { autoAlpha: 1, filter: "blur(0px)", yPercent: 0, duration: 0.6, stagger: 0.025, ease: "power3.out" });
}
function say(text) {
  if (text === sayText) return;
  sayText = text;
  if (reduced) { sayEl.textContent = text; return; }
  const old = sayEl.querySelectorAll(".ld-c"); gsap.killTweensOf(old);
  gsap.to(old, { autoAlpha: 0, filter: "blur(8px)", yPercent: -30, duration: 0.3, stagger: 0.012, ease: "power2.in", onComplete: sayIn });
}
sayIn();
// três colunas de dígitos que rolam na vertical (0…9 e um 0 extra para a virada)
pct.innerHTML = [0, 1, 2].map(() => `<span class="col"><span class="strip">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<i>${d}</i>`).join("")}</span></span>`).join("");
const strips = [...pct.querySelectorAll(".strip")];
function showCount(v) {
  // unidades rolam contínuas; dezenas e centenas rolam junto com a última unidade antes da virada
  const u = v % 10, t = Math.floor(v / 10) + Math.max(0, u - 9), hnd = Math.max(0, v - 99);
  [hnd, t, u].forEach((pos, k) => { strips[k].style.transform = `translateY(${(-pos * 100 / 11).toFixed(3)}%)`; });
  pct.dataset.value = Math.floor(v);
  bar.style.transform = `scaleX(${(v / 100).toFixed(4)})`;
  grid.setProgress(v);
  const step10 = String(Math.floor(v / 10) * 10); if (loaderEl.getAttribute("aria-valuenow") !== step10) loaderEl.setAttribute("aria-valuenow", step10);
  say(v >= 100 ? "READY" : v >= 45 ? "LIGHTING THE STUDIO" : "LOADING THE MODEL");
}
function finishLoading() {
  const hero = dom.text.hero, lines = SplitText.create(hero.querySelector("h1"), { type: "lines", mask: "lines" }).lines;
  sceneShown = true;
  const done = () => { loaderEl.classList.add("done"); grid.stop(); document.body.classList.remove("booting"); releaseBehind(); lenis.start(); };
  if (reduced) return done();
  const gain = bg.uniforms.uGain.value;
  const tl = gsap.timeline({ delay: 0.4 })   // segura no 100 antes de sair
    // saída do loading: a frase e o cartão desfocam
    .to("#loadsay .ld-c", { autoAlpha: 0, filter: "blur(8px)", yPercent: -30, duration: 0.4, stagger: 0.015, ease: "power2.in" }, 0)
    .to(".ld-card", { autoAlpha: 0, filter: "blur(6px)", y: 8, duration: 0.4, ease: "power2.in" }, 0.05)
    .to(".ld-bar", { autoAlpha: 0, duration: 0.3, ease: "power2.out" }, 0.1);
  let d = 0;   // quanto a entrada do herói atrasa para o fone se formar primeiro
  if (reveal) {
    // os pontos acesos do loader viram partículas e voam até a superfície do fone, que então fica sólido
    const R = { k: 0, fade: 1, flash: 0 }, push = () => reveal.set(R.k, R.fade, R.flash);
    d = 0.4;
    tl.call(() => {
      const ok = reveal.begin(grid.snapshot(), camera, renderer.getPixelRatio(), S.cam.dist * (1 + S.pull));
      grid.hide(); loaderEl.style.background = "transparent"; loaderEl.classList.add("done");
      if (!ok) { modelObj.visible = true; reveal.dispose(); }
    }, null, 0.35)
      .fromTo(R, { k: 0 }, { k: 1, duration: 1.6, ease: "none", onUpdate: push }, 0.35)
      .call(() => { modelObj.visible = true; }, null, 1.6)
      .to(R, { flash: 1, duration: 0.15, ease: "power2.out", onUpdate: push }, 1.55)
      .to(R, { flash: 0, fade: 0, duration: 0.55, ease: "power2.out", onUpdate: push }, 1.7)
      .call(() => { reveal.dispose(); grid.stop(); }, null, 2.3);
  } else {
    // sem partículas: os pontos apagam em onda e a cortina abre por cima
    tl.call(() => grid.exit(0.45), null, 0.1)
      .to(loaderEl, { clipPath: "inset(0 0 100% 0)", duration: 1.2, ease: "expo.inOut" }, 0.4)
      .call(() => { loaderEl.classList.add("done"); grid.stop(); }, null, 1.65);
  }
  // entrada, do fundo para a frente
  tl.fromTo(bg.uniforms.uGain, { value: 0 }, { value: gain, duration: 1.8, ease: "power2.out" }, 0.45 + d)
    .fromTo(S, { intro: 1.1, pull: 0.14 }, { intro: 0, pull: 0, duration: 2.4, ease: "power3.out" }, 0.45)
    .fromTo(S, { fx: 0 }, { fx: 1, duration: 1.4, ease: "power2.out" }, 1.0 + d)
    .from(".hud.tl, .menu", { y: -16, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" }, 1.1 + d)
    .from(lines, { yPercent: 112, duration: 1.05, stagger: 0.09, ease: "power3.out" }, 1.15 + d)
    .from(hero.querySelector(".side"), { autoAlpha: 0, y: 14, filter: "blur(6px)", duration: 0.9, ease: "power2.out" }, 1.5 + d)
    .call(() => lenis.start(), null, 1.9 + d)
    // destino explícito e transform limpo no fim: o [ SPECS ] chegou a ficar preso 16 px abaixo do lugar
    .fromTo(".hud.bl, .hud.br", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: "power3.out", clearProps: "transform" }, 1.6 + d)
    .call(() => { document.body.classList.remove("booting"); releaseBehind(); }, null, 2.3 + d);
}
if (reduced) {
  const wait = () => (load.ready && warm.done ? (showCount(100), finishLoading()) : requestAnimationFrame(wait)); wait();
} else {
  // uma curva só de 0 a 100, integrada à mão: o carregamento real freia o avanço quando o
  // número o alcança, e um quadro longo (rede ou compilação) nunca vira um salto
  const curve = gsap.parseEase("sine.inOut"), DURATION = 3.4;
  let t = 0, speed = 0, waited = 0;
  const gate = (_time, dt) => {
    waited += Math.min(dt, 50) / 1000;
    // enquanto nada terminou de carregar, o número avança devagar até 24 para não parecer travado
    const allowed = load.ready && warm.done ? 100 : Math.max(load.real * 100, Math.min(24, waited * 3));
    const value = curve(t) * 100;
    const target = (load.ready && warm.done) || value < allowed - 0.5 ? 1 : 0;
    speed += (target - speed) * 0.1;                       // freia e retoma sem tranco
    t = Math.min(1, t + (Math.min(dt, 50) / 1000 / DURATION) * speed);
    showCount(curve(t) * 100);
    if (t >= 1) { gsap.ticker.remove(gate); finishLoading(); }
  };
  gsap.ticker.add(gate);
}
window.__hp = { lenis, st, tl, S, chapters, total, camera, renderer, menu, get dof() { return dofState; } }; // testes no console

// ---------- Aplicar o estado a cada quadro ----------
const T = new THREE.Vector3(), D = new THREE.Vector3(), v = new THREE.Vector3(), R = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// ---------- Ponteiro: só com mouse de verdade e sem "reduzir movimento" ----------
const finePointer = !reduced && matchMedia("(hover: hover) and (pointer: fine)").matches;
const ptr = { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0, mx: 0, my: 0, k: 0, on: false, hover: null, any: 0, last: 0 };
const TILT_X = Math.tan(THREE.MathUtils.degToRad(2.5)), TILT_Y = Math.tan(THREE.MathUtils.degToRad(1.6));
if (finePointer) {
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1;
    ptr.px = e.clientX; ptr.py = e.clientY;
    if (!ptr.on) { ptr.mx = ptr.px; ptr.my = ptr.py; ptr.on = true; }
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { ptr.on = false; ptr.x = ptr.y = 0; });
  document.body.classList.add("fine");
  for (const hs of hotspots) {
    hs.hv = 0;
    for (const e of [hs.label, hs.ring]) {
      e.addEventListener("pointerenter", () => { ptr.hover = hs.id; });
      e.addEventListener("pointerleave", () => { if (ptr.hover === hs.id) ptr.hover = null; });
    }
  }
}
let fovFit = 1, dimK = 0.45;   // quanto as peças fora de foco escurecem (menos quando há desfoque)
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function project(obj, local) {
  v.copy(local).applyMatrix4(obj.matrixWorld).project(camera);
  return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, v.z < 1];
}

function apply(time) {
  const c = S.cam, w = innerWidth, h = innerHeight;
  // câmera
  T.set(c.tx, c.ty, c.tz); D.set(c.dx, c.dy, c.dz).normalize();
  // o produto inclina de leve com o cursor (amortecido; volta ao centro com o menu aberto)
  const dt = Math.min(0.05, Math.max(0, time - ptr.last)); ptr.last = time;
  if (finePointer) {
    const ease = 1 - Math.exp(-dt * 3.5), tx = menu.open ? 0 : ptr.x, ty = menu.open ? 0 : ptr.y;
    ptr.sx += (tx - ptr.sx) * ease; ptr.sy += (ty - ptr.sy) * ease;
    const follow = 1 - Math.exp(-dt * 9);
    ptr.mx += (ptr.px - ptr.mx) * follow; ptr.my += (ptr.py - ptr.my) * follow;
    ptr.k += ((ptr.on && !menu.open ? 1 : 0) - ptr.k) * (1 - Math.exp(-dt * 4));
    ptr.any += ((ptr.hover ? 1 : 0) - ptr.any) * (1 - Math.exp(-dt * 12));
    R.crossVectors(UP, D).normalize();
    D.addScaledVector(R, ptr.sx * TILT_X * S.fx).addScaledVector(UP, ptr.sy * TILT_Y * S.fx).normalize();
    const pr = renderer.getPixelRatio();
    bg.uniforms.uMouse.value.set(ptr.mx * pr, (h - ptr.my) * pr);
    bg.uniforms.uMouseK.value = ptr.k * S.fx;
  }
  camera.position.copy(T).addScaledVector(D, c.dist * (1 + S.pull));
  camera.fov = c.fov * fovFit;
  if (w > 900) camera.setViewOffset(w, h, c.off * w, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.lookAt(T);
  camera.updateMatrixWorld();
  root.rotation.y = -S.spin - S.intro;
  kicker.target.position.copy(T);
  kicker.position.copy(T).addScaledVector(D, -0.5).add(v.set(0.25, 0.35, 0).applyQuaternion(camera.quaternion));
  scene.environmentRotation.y = 0.6 + st.progress * 1.2;

  // peças, foco e contexto
  for (const n in parts) {
    const p = parts[n];
    p.obj.position.x = p.base + p.dx * S.ex[n];
    // dim 0 = em foco, 1 = escurecida, 2 = fora de cena (some)
    const d = S.dim[n], k = 1 - dimK * Math.min(1, d), op = 1 - Math.max(0, Math.min(1, d - 1));
    p.obj.visible = op > 0.01;
    for (const m of p.mats) {
      m.color.copy(m.userData.base).multiplyScalar(k);
      const tr = op < 0.999;
      if (!m.userData.glass && m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op * m.userData.opacity;
    }
  }
  for (const r of rest) {
    r.obj.visible = S.rest > 0.02;
    for (const m of r.mats) { m.opacity = S.rest; m.depthWrite = S.rest > 0.98; }
  }
  root.updateMatrixWorld(true);

  // atmosfera
  v.copy(T).project(camera);
  bg.uniforms.uCenter.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  bg.uniforms.uTime.value = time;
  bg.uniforms.uPhase.value = st.progress * 14;
  bg.uniforms.uRings.value = S.bg.rings;
  bg.uniforms.uGrid.value = Math.max(S.bg.grid, S.bg.eq);
  dust.uniforms.uTime.value = time;
  dust.points.rotation.y = st.progress * 2.4 + time * 0.012;
  orbit.group.position.copy(T);
  orbit.group.quaternion.copy(camera.quaternion);
  orbit.update(c.dist * 0.3, 1.1 + st.progress * 18 + time * 0.06, 1.8, 0.5 * S.fx);
  dust.uniforms.uAlpha.value = 0.6 * S.fx;
  dust.uniforms.uNear.value = c.dist;
  // zona sem pontos atrás do produto: acompanha o tamanho dele na tela
  bg.uniforms.uClear.value = Math.min(0.8, Math.max(0.2, 0.085 / (2 * c.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))));

  // pontos de interesse. A etiqueta fica numa coluna fixa (logo abaixo do texto do capítulo),
  // uma vaga por etiqueta, então duas nunca se sobrepõem. Tudo vem de S.typ, que é função do
  // scroll: o quadro é o mesmo indo ou voltando.
  const mobile = w <= 900;
  let mobileActive = null, best = 0.001;
  if (mobile) for (const hs of hotspots) if (S.typ[hs.id] > 0 && S.hot[hs.id] > best) { best = S.hot[hs.id]; mobileActive = hs.id; }
  const cols = {}, rects = {};
  // leituras de layout primeiro, todas juntas: ler e escrever alternado força um layout por etiqueta
  for (const hs of hotspots) {
    if (hs.label.style.display === "none") continue;
    hs.lw = hs.label.offsetWidth; hs.lh = hs.label.offsetHeight;
    if (!mobile && !rects[hs.ch]) rects[hs.ch] = dom.block[hs.ch].getBoundingClientRect();
  }
  if (S.lineup >= 0.001) for (const l of lineup) l.lw = l.label.offsetWidth || l.lw || 160;
  for (const hs of hotspots) {
    const typ = S.typ[hs.id], on = typ > 0.001 && hs.o;
    hs.ring.style.display = hs.core.style.display = hs.line.style.display = hs.label.style.display = on ? "" : "none";
    if (!on) continue;
    const a = S.hot[hs.id], [x, y] = project(hs.o, hs.local);
    const open = clamp01(typ * 3), type = clamp01((typ - 0.25) / 0.7), vis = clamp01(typ * 4);
    const t = hs.title.toUpperCase();
    hs.label.children[0].textContent = t.slice(0, Math.round(t.length * type));
    hs.label.children[1].textContent = hs.sub;
    hs.label.children[1].style.opacity = clamp01((typ - 0.8) / 0.2);
    hs.label.classList.toggle("typing", type < 1);
    hs.label.classList.toggle("dim", a < 0.6);
    let hv = 0, back = 1;
    if (finePointer) {
      hs.hv += ((ptr.hover === hs.id ? 1 : 0) - hs.hv) * (1 - Math.exp(-dt * 12));
      hv = hs.hv; back = 1 - 0.55 * ptr.any * (1 - hv);   // as outras recuam
      hs.label.classList.toggle("hot", ptr.hover === hs.id);
      hs.ring.setAttribute("r", (16 * (1 + 0.15 * hv)).toFixed(2));
      hs.core.setAttribute("r", (2.5 * (1 + 0.4 * hv)).toFixed(2));
    }
    hs.label.style.opacity = vis * back;
    hs.ring.setAttribute("cx", x); hs.ring.setAttribute("cy", y);
    hs.core.setAttribute("cx", x); hs.core.setAttribute("cy", y);
    hs.ring.style.strokeDashoffset = 100 - 100 * clamp01(typ * 2.5);
    hs.line.style.strokeDashoffset = 100 - 100 * clamp01(typ * 2);
    hs.ring.style.opacity = hs.core.style.opacity = vis * Math.max(hv, 0.55 + 0.45 * a) * back;
    hs.line.style.opacity = vis * Math.max(hv, 0.4 + 0.6 * a) * back;
    if (hs.lw === undefined) { hs.lw = hs.label.offsetWidth; hs.lh = hs.label.offsetHeight; }   // primeira vez: mede uma vez
    const lw = hs.lw, lh = hs.lh;
    if (mobile) {   // celular: só a etiqueta ativa, num cartão fixo acima da barra
      const show = hs.id === mobileActive, top = h - 70 - lh;
      hs.label.style.display = hs.line.style.display = show ? "" : "none";
      hs.label.style.transform = `translate(16px, ${top}px)`;
      hs.label.style.clipPath = `inset(0 ${100 - open * 100}% 0 0)`;
      hs.line.setAttribute("points", `${x},${y + (top > y ? 14 : -14)} ${x},${top > y ? top : top + lh}`);
      continue;
    }
    // coluna do capítulo: mede o bloco de texto uma vez por quadro
    const col = cols[hs.ch] || (cols[hs.ch] = (() => {
      const r = rects[hs.ch] || dom.block[hs.ch].getBoundingClientRect();
      return { x: r.left, top: r.bottom + 30, right: r.left < w / 2 };   // texto à esquerda → produto à direita
    })());
    const lx = col.x, ly = Math.min(col.top + hs.slot * LABEL_PITCH, h - 72 - lh);
    hs.label.style.transform = `translate(${lx}px, ${ly}px)`;
    hs.label.style.clipPath = col.right ? `inset(0 ${100 - open * 100}% 0 0)` : `inset(0 0 0 ${100 - open * 100}%)`;
    const ax = col.right ? lx + lw + 10 : lx - 10, ay = ly + lh / 2, dir = col.right ? -1 : 1;
    hs.line.setAttribute("points", `${ax},${ay} ${x + dir * 60},${ay} ${x + dir * 12},${y + Math.sign(ay - y) * 10}`);
  }

  // lineup: todas as peças em duas colunas
  for (const l of lineup) {
    const a = S.lineup;
    l.label.style.opacity = a; l.line.style.opacity = a * 0.9; l.dot.style.opacity = a;
    if (a < 0.001 || !l.o) continue;
    const [x, y] = project(l.o, l.local);
    const lw = l.lw || 160;
    const lx = l.front ? w * (w > 900 ? 0.8 : 0.58) : Math.max(16, w * 0.045);
    const ly = l.front ? h * (0.2 + l.slot * 0.1) : h * (0.54 + l.slot * 0.068);
    const ax = l.front ? lx - 10 : lx + lw + 10;
    l.label.style.transform = `translate(${lx}px, ${ly - 8}px)`;
    l.line.setAttribute("x1", x); l.line.setAttribute("y1", y); l.line.setAttribute("x2", ax); l.line.setAttribute("y2", ly);
    l.dot.setAttribute("cx", x); l.dot.setAttribute("cy", y);
    if (mobile) {   // grade de 2 colunas acima da barra, sem linhas
      const idx = l.front ? l.slot : l.slot + 6, col = idx % 2, row = idx >> 1;
      l.label.style.transform = `translate(${16 + col * (w - 32) / 2}px, ${h - 70 - (6 - row) * 31}px)`;
      l.line.style.opacity = 0;
    }
  }

  // barra inferior
  const p = st.progress, ci = chapterAt(p);
  fill.style.transform = `scaleX(${p.toFixed(4)})`;
  const nm = NAMES[chapters[ci].id].toUpperCase(); if (now.textContent !== nm) now.textContent = nm;
  menu.setActive(chapters[ci].id);
  const last = ci === chapters.length - 1, want = last ? "REPLAY" : "SPECS";
  if (jumpLabel.textContent !== want) { jumpLabel.textContent = want; jump.dataset.goto = last ? "hero" : "close"; }
  legal.classList.toggle("show", ci === 0 || ci === chapters.length - 1);
  subEl.classList.toggle("show", ci === 0 || last);
}

// ---------- Tamanho ----------
function resize() {
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  fovFit = camera.aspect < 1.45 ? Math.min(2.2, 1.45 / camera.aspect) : 1;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (post) post.setSize(w, h);
  bg.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  dust.uniforms.uPixel.value = renderer.getPixelRatio() * Math.max(1, h / 800);
}
const usePost = !reduced && !/[?&]nopost/.test(location.search);
// profundidade de campo: só em tela grande com mouse; se a taxa de quadros cair, desliga sozinha
const dofState = { on: usePost && finePointer && innerWidth > 900 && !/[?&]nodof/.test(location.search), k: 0, frames: 0, t0: 0, slow: 0 };
dimK = dofState.on ? 0.33 : 0.45;
const post = usePost ? createPost(renderer, scene, camera, bg, [dust.points, orbit.group]) : null;
addEventListener("resize", resize);
resize();

// ---------- Loop de render ----------
function renderFrame(t, force = false) {
  if (!force && !sceneShown) return;
  if (post) post.render(t);
  else { renderer.clear(); renderer.render(bg.scene, bg.camera); renderer.render(scene, camera); }
}
gsap.ticker.add((t) => {
  apply(t);
  if (post && sceneShown) {
    if (dofState.on && !document.body.classList.contains("booting") && !document.hidden) {   // mede em janelas de 1 s
      if (!dofState.t0) dofState.t0 = t;
      dofState.frames++;
      if (t - dofState.t0 >= 0.5) {
        const fps = dofState.frames / (t - dofState.t0); dofState.t0 = t; dofState.frames = 0;
        dofState.slow = fps < 45 ? dofState.slow + 1 : 0;
        if (dofState.slow >= 2 || /[?&]slowdof/.test(location.search)) { dofState.on = false; dimK = 0.45; console.info("[headphone] depth of field off (low frame rate)"); }
      }
    }
    dofState.k += ((dofState.on ? 1 : 0) - dofState.k) * 0.08;
    // closes desfocam mais; o plano de foco é o alvo da câmera
    post.setFocus(S.cam.dist * (1 + S.pull), dofState.k * S.fx * Math.min(1, 0.45 / Math.max(0.15, S.cam.dist)));
  }
  renderFrame(t);
});
moduleReady();
