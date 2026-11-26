/**
 * Testes de comportamento do scroll, com Playwright.
 * Uso: NODE_PATH=~/.claude/skills/playwright-screenshots/node_modules node tools/audit_scroll.cjs <pasta> [largura] [altura]
 *
 * 1. Loading: o contador passa por valores intermediários e chega a 100.
 * 2. Sobreposição: nenhuma etiqueta visível cruza outra etiqueta nem o bloco de texto.
 * 3. Ida e volta: o texto das etiquetas é igual chegando de cima e chegando de baixo.
 * 4. Fim: a página para no fim (não volta ao início) e o Replay leva ao topo.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const [, , outDir = "previews/audit/scroll", W = "1440", H = "900"] = process.argv;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const result = { viewport: [+W, +H] };

  // 1. loading: ritmo do contador e tira de quadros da entrada
  await page.goto(process.env.AUDIT_URL || "http://localhost:5173/", { waitUntil: "commit" });
  const samples = []; const t0 = Date.now(); let first = null, last = null;
  for (let i = 0; i < 400; i++) {
    const v = await page.evaluate(() => +document.getElementById("loadpct")?.dataset.value).catch(() => NaN);
    if (!Number.isNaN(v)) { samples.push(v); if (first === null && v > 0) first = Date.now(); if (v >= 100) { last = Date.now(); break; } }
    await page.waitForTimeout(40);
  }
  const jumps = samples.slice(1).map((v, i) => v - samples[i]);
  result.loading = { samples: samples.length, distinct: new Set(samples).size, countSeconds: +((last - (first || t0)) / 1000).toFixed(2), maxJump: Math.max(...jumps), backwards: jumps.filter((j) => j < 0).length };
  const frames = [];
  for (let k = 0; k < 14; k++) { const f = path.join(outDir, `intro_${String(k).padStart(2, "0")}.png`); await page.screenshot({ path: f }); frames.push(f); await page.waitForTimeout(170); }
  await page.waitForFunction(() => window.__hp && document.getElementById("loader").classList.contains("done") && !document.body.classList.contains("booting"), null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "hero_after_load.png") });

  const go = (id, f) => page.evaluate(([id, f]) => {
    const hp = window.__hp, c = hp.chapters.find((c) => c.id === id);
    hp.lenis.scrollTo(hp.st.start + (hp.st.end - hp.st.start) * ((c.start + c.len * f) / hp.total), { immediate: true, force: true });
  }, [id, f]);
  const labels = () => page.evaluate(() => [...document.querySelectorAll(".hs-label")].filter((e) => getComputedStyle(e).display !== "none" && +getComputedStyle(e).opacity > 0.5)
    .map((e) => { const r = e.getBoundingClientRect(); return { text: e.children[0].textContent + " | " + e.children[1].textContent, rect: [r.left, r.top, r.right, r.bottom] }; }));
  const hit = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
  const chapters = await page.evaluate(() => window.__hp.chapters.map((c) => c.id));

  // 2. sobreposição em 3 posições por capítulo
  result.overlaps = []; let checked = 0;
  for (const id of chapters) for (const f of [0.5, 0.7, 0.88]) {
    await go(id, f); await page.waitForTimeout(1500);
    const ls = await labels();
    const block = await page.evaluate((id) => { const e = document.querySelector(`[data-ch="${id}"] > div`) || document.querySelector(`[data-ch="${id}"]`); const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }, id);
    checked += ls.length;
    ls.forEach((a, i) => {
      ls.slice(i + 1).forEach((b) => hit(a.rect, b.rect) && result.overlaps.push(`${id}@${f}: "${a.text}" x "${b.text}"`));
      if (hit(a.rect, block)) result.overlaps.push(`${id}@${f}: "${a.text}" x text block`);
      if (a.rect[0] < 0 || a.rect[2] > +W || a.rect[1] < 60 || a.rect[3] > +H - 60) result.overlaps.push(`${id}@${f}: "${a.text}" off-screen`);
    });
    if (f === 0.88 && ["form", "plate", "board", "inside"].includes(id)) await page.screenshot({ path: path.join(outDir, `labels_${id}.png`) });
  }
  result.labelsChecked = checked;

  // 3. ida e volta
  result.roundtrip = [];
  for (const id of ["form", "plate", "board", "driver", "inside", "comfort"]) {
    const i = chapters.indexOf(id);
    await go(chapters[i - 1], 0.5); await page.waitForTimeout(900); await go(id, 0.88); await page.waitForTimeout(1600);
    const down = (await labels()).map((l) => l.text).sort();
    await go(chapters[i + 1], 0.9); await page.waitForTimeout(900); await go(id, 0.88); await page.waitForTimeout(1600);
    const up = (await labels()).map((l) => l.text).sort();
    result.roundtrip.push({ id, same: JSON.stringify(down) === JSON.stringify(up), labels: down.length, down, up });
  }

  // 3b. menu: abre e fecha (clique, Esc, clique fora), foco preso, cada item leva ao capítulo certo
  const isOpen = () => page.evaluate(() => document.getElementById("menu-btn").getAttribute("aria-expanded") === "true");
  const menu = { problems: [] };
  await go("hero", 0.2); await page.waitForTimeout(800);
  await page.click("#menu-btn");
  for (let k = 0; k < 8; k++) { await page.screenshot({ path: path.join(outDir, `menu_${k}.png`), clip: { x: +W - Math.min(+W, 420), y: 0, width: Math.min(+W, 420), height: 520 } }); await page.waitForTimeout(60); }
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, "menu_open.png") });
  if (!(await isOpen())) menu.problems.push("did not open on click");
  menu.scrollLocked = await page.evaluate(() => window.__hp.lenis.isStopped);
  let escaped = 0;
  for (let k = 0; k < 12; k++) { await page.keyboard.press(k % 4 === 3 ? "Shift+Tab" : "Tab"); if (!(await page.evaluate(() => document.getElementById("menu").contains(document.activeElement)))) escaped++; }
  menu.focusEscapes = escaped;
  menu.contrast = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgL = lum("rgb(30,30,30)");   // pior caso do painel sobre cena clara
    return [...document.querySelectorAll("#menu-list li a")].map((a) => +((lum(getComputedStyle(a).color) + 0.05) / (bgL + 0.05)).toFixed(2));
  });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  if (await isOpen()) menu.problems.push("Esc did not close");
  if (!(await page.evaluate(() => document.activeElement.id === "menu-btn"))) menu.problems.push("focus not returned to button after Esc");
  await page.click("#menu-btn"); await page.waitForTimeout(500);
  await page.mouse.click(60, +H - 140); await page.waitForTimeout(400);
  if (await isOpen()) menu.problems.push("outside click did not close");
  menu.items = [];
  const EXPECT = { hero: ["hero"], form: ["form"], glass: ["glass"], plate: ["plate"], board: ["board"], inside: ["inside"], close: ["close"] };
  for (const id of Object.keys(EXPECT)) {
    await page.click("#menu-btn"); await page.waitForTimeout(650);
    await page.click(`#menu-list a[data-goto="${id}"]`); await page.waitForTimeout(4300);
    const at = await page.evaluate(() => { const hp = window.__hp, t = hp.st.progress * hp.total; let i = 0; hp.chapters.forEach((c, k) => { if (t >= c.start - 0.5) i = k; }); return { id: hp.chapters[i].id, on: document.querySelector("#menu-list li.on a").dataset.goto, open: document.getElementById("menu").classList.contains("open") }; });
    menu.items.push(`${id}→${at.id}${EXPECT[id].includes(at.id) && at.on === id && !at.open ? "" : " WRONG"}`);
  }
  await page.click("#menu-btn"); await page.waitForTimeout(650);
  await page.click(".menu-replay"); await page.waitForTimeout(4300);
  menu.replayScroll = await page.evaluate(() => Math.round(window.scrollY));
  // atalho do canto: SPECS leva ao fim e vira REPLAY
  const jl = () => page.evaluate(() => document.getElementById("jump-label").textContent);
  menu.jump = [await jl()];
  await page.click("#jump"); await page.waitForTimeout(4300);
  menu.jump.push(await jl(), await page.evaluate(() => Math.round(window.scrollY) === Math.round(window.__hp.lenis.limit)));
  result.menu = menu;

  // 4. fim da página
  await page.evaluate(() => window.__hp.lenis.scrollTo(window.__hp.lenis.limit, { immediate: true, force: true }));
  await page.waitForTimeout(1800);
  await page.mouse.move(+W / 2, +H / 2);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(80); }
  await page.waitForTimeout(1500);
  const end = await page.evaluate(() => ({ scroll: Math.round(window.scrollY), limit: Math.round(window.__hp.lenis.limit), closeOpacity: getComputedStyle(document.querySelector('[data-ch="close"]')).opacity, now: document.getElementById("now").textContent }));
  await page.screenshot({ path: path.join(outDir, "end.png") });
  await page.click("#replay"); await page.waitForTimeout(5200);
  end.afterReplay = await page.evaluate(() => Math.round(window.scrollY));
  result.end = end; result.errors = errors;

  fs.writeFileSync(path.join(outDir, "scroll.json"), JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ loading: result.loading, menu: result.menu, dof: await page.evaluate(() => window.__hp.dof), labelsChecked: checked, overlaps: result.overlaps, roundtrip: result.roundtrip.map((r) => `${r.id}:${r.same ? "ok" : "DIFF"}(${r.labels})`), end, errors }, null, 1));
  await browser.close();
})();
