/**
 * Captura o site quadro a quadro para o filme "site em uso".
 * A rolagem é roteirizada: poucas paradas, viagens longas que entram e saem devagar. A inércia do
 * site (lerp do Lenis e scrub de 0,8 s) é simulada quadro a quadro, então a cena assenta depois de
 * cada viagem como no navegador, e o resultado não depende da velocidade da máquina.
 *
 * Uso: NODE_PATH=~/.claude/skills/playwright-screenshots/node_modules node tools/capture_site.cjs <mobile|desktop> [pasta] [segundos]
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const [, , mode = "mobile", outArg, secArg] = process.argv;
const FPS = 30, SECONDS = +(secArg || 20);
const out = outArg || `case/renders/site/${mode}`;
const VIEW = mode === "mobile"
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };

const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);   // seno: entra e sai devagar
// paradas do filme; os capítulos entre elas passam durante as viagens
const STOPS = ["hero", "form", "plate", "driver", "inside", "lineup", "close"];
const HOLD_START = 45, TRAVEL = 60, HOLD = 24;   // quadros: 1,5 s no herói, 2 s de viagem, 0,8 s de pausa
// inércia do site a 30 fps: Lenis lerp 0,065 a 60 fps e scrub 0,8 s como suavização exponencial
const K_SCROLL = 1 - Math.pow(1 - 0.065, 2), K_SCRUB = 0.12;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (f.endsWith(".jpg")) fs.unlinkSync(path.join(out, f));
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext(VIEW)).newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(process.env.SITE_URL || "http://localhost:5173/", { waitUntil: "load" });
  await page.waitForFunction(() => window.__hp && !document.body.classList.contains("booting"), null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  // pontos de leitura de cada capítulo, em fração da rolagem (o mesmo cálculo do menu do site)
  const all = await page.evaluate(() => {
    const { chapters, total } = window.__hp;
    return chapters.map((c) => ({ id: c.id, p: c.id === "hero" ? 0 : c.id === "close" ? 1 : (c.start + c.len * 0.6) / total }));
  });
  const stops = STOPS.map((id) => all.find((s) => s.id === id));
  // roteiro: parado no herói, depois viagem + pausa até cada parada; o fim segura o que sobrar
  const total = SECONDS * FPS, per = TRAVEL + HOLD;
  if (HOLD_START + per * (stops.length - 1) > total - 30) throw new Error("roteiro maior que a captura");
  const target = (i) => {
    if (i < HOLD_START) return 0;
    const k = i - HOLD_START, seg = Math.floor(k / per);
    if (seg >= stops.length - 1) return 1;
    const u = Math.min(1, (k - seg * per) / TRAVEL);
    return stops[seg].p + (stops[seg + 1].p - stops[seg].p) * ease(u);
  };
  // rolagem e cena com a inércia do site
  const path_ = []; let sc = 0, sn = 0;
  for (let i = 0; i < total; i++) { sc += (target(i) - sc) * K_SCROLL; sn += (sc - sn) * K_SCRUB; path_.push([sc, sn]); }
  const maxStep = Math.max(...path_.slice(1).map((v, i) => Math.abs(v[1] - path_[i][1])));
  // referência: o roteiro antigo (12 paradas em 15 s, 0,8 s de viagem, sem inércia)
  const cub = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), oldPer = (450 - 75) / (all.length - 1);
  const old = (i) => { if (i < 30) return 0; const k = i - 30, g = Math.min(all.length - 2, Math.floor(k / oldPer)); if (k >= oldPer * (all.length - 1)) return 1;
    return all[g].p + (all[g + 1].p - all[g].p) * cub(Math.min(1, (k - g * oldPer) / (oldPer * 0.72)))};
  let oldMax = 0; for (let i = 1; i < 450; i++) oldMax = Math.max(oldMax, Math.abs(old(i) - old(i - 1)));
  console.log(`[site] maior passo da cena por quadro: ${(maxStep * 100).toFixed(3)}% da rolagem (antes: ${(oldMax * 100).toFixed(3)}%)`);
  if (process.env.DRY) { await browser.close(); return; }

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(async ([p, q]) => {
      const { lenis, st, tl } = window.__hp;
      lenis.scrollTo(st.start + (st.end - st.start) * p, { immediate: true, force: true });
      st.getTween()?.progress(1);   // o scrub do navegador não corre aqui: a inércia já está em q
      tl.progress(q);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, path_[i]);
    await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 60 === 0) console.log(`[site] ${mode} ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`[site] ${mode} ${total}/${total} pronto. capítulos: ${stops.map((s) => s.id).join(" ")}`);
  if (errors.length) console.log("[site] erros:", errors.slice(0, 5));
  await browser.close();
})();
