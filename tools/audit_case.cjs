/**
 * Auditoria da página /case, com Playwright.
 *
 * Uso: NODE_PATH=~/.claude/skills/playwright-screenshots/node_modules node tools/audit_case.cjs <pasta-de-saida> [url]
 * Desktop (1440) e celular (390): print da página inteira depois de rolar até o fim,
 * contagem de bytes baixados ao abrir (antes de rolar), vídeos tocando por posição,
 * imagens quebradas, erros do console e rolagem horizontal.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const out = process.argv[2] || "audit_case";
const url = process.argv[3] || "http://localhost:5173/case/";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = []; let bytes = 0; const media = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", async (r) => {
      try { const b = await r.body(); bytes += b.length; if (/\.(mp4|jpg)$/.test(r.url())) media.push(r.url().split("/").pop()); } catch {}
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const initialBytes = bytes, initialMedia = [...media];

    // rola devagar até o fim, anotando quantos vídeos tocam em cada parada
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    const playing = [];
    for (let y = 0; y < H; y += vp.height * 0.8) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(450);
      playing.push(await page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length));
    }
    await page.waitForTimeout(800);
    const checks = await page.evaluate(() => ({
      hscroll: document.documentElement.scrollWidth > innerWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")),
      hidden: [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity !== "1").length,
    }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${name}_full.jpg`), fullPage: true, quality: 70, type: "jpeg" });
    report[name] = { initialKB: Math.round(initialBytes / 1024), totalKB: Math.round(bytes / 1024), initialMedia, maxPlaying: Math.max(...playing), playing, ...checks, errors };
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
