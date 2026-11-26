/**
 * Auditoria de contraste da página de scroll, com Playwright.
 *
 * Uso: NODE_PATH=~/.claude/skills/playwright-screenshots/node_modules node tools/audit_contrast.cjs <pasta-de-saida> [largura] [altura]
 * Para cada capítulo, em 3 posições, salva dois prints (com e sem texto) e as caixas de cada
 * texto visível. O contraste é calculado depois por tools/audit_report.py, contra os pixels
 * reais que ficam atrás de cada texto.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const [, , outDir = "previews/audit", W = "1440", H = "900"] = process.argv;
const URL = process.env.AUDIT_URL || "http://localhost:5173/";
const TEXT = ".ch h1, .ch h2, .ch .side, .ch .eyebrow, .ch dt, .ch dd, .ch .stat, .hs-label b, .hs-label span, .label, .legal, .numeral, .hud .mark, .hud .sub, .now, .bracket b, .menu-label";

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__hp && document.getElementById("loader").classList.contains("done"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const chapters = await page.evaluate(() => window.__hp.chapters.map((c) => c.id));
  const report = [];
  for (const id of chapters) {
    for (const f of [0.35, 0.65, 0.86]) {
      await page.evaluate(([id, f]) => {
        const hp = window.__hp, c = hp.chapters.find((c) => c.id === id);
        const y = hp.st.start + (hp.st.end - hp.st.start) * ((c.start + c.len * f) / hp.total);
        hp.lenis.scrollTo(y, { immediate: true, force: true });
      }, [id, f]);
      await page.waitForTimeout(1600);   // deixa o scrub e as entradas assentarem
      const name = `${String(chapters.indexOf(id) + 1).padStart(2, "0")}_${id}_${Math.round(f * 100)}`;
      await page.screenshot({ path: path.join(outDir, name + ".png") });
      const items = await page.evaluate((sel) => {
        const out = [];
        for (const el of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(el); let op = 1, vis = true;
          for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
            const s = getComputedStyle(e); op *= parseFloat(s.opacity); if (s.visibility === "hidden" || s.display === "none") vis = false;
          }
          const r = el.getBoundingClientRect();
          if (!vis || op < 0.5 || r.width < 4 || r.height < 4 || !el.textContent.trim()) continue;
          if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
          out.push({ sel: (el.closest("[data-ch]")?.dataset.ch || "") + " " + el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""),
            text: el.textContent.trim().slice(0, 40), color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight, opacity: +op.toFixed(2),
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
        }
        return out;
      }, TEXT);
      // segundo print, sem o texto, para medir o que fica atrás dele
      const tag = await page.addStyleTag({ content: `${TEXT} { color: transparent !important; } .eyebrow::before, .hs-label b::after { opacity: 0 !important; }` });
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(outDir, name + "_bg.png") });
      await tag.evaluate((n) => n.remove());
      report.push({ shot: name, chapter: id, f, items });
    }
  }
  fs.writeFileSync(path.join(outDir, "audit.json"), JSON.stringify({ viewport: [+W, +H], errors, report }, null, 1));
  console.log(`${report.length} shots, ${report.reduce((s, r) => s + r.items.length, 0)} text boxes, ${errors.length} errors → ${outDir}`);
  await browser.close();
})();
