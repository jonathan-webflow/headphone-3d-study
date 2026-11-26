// Fundo do loading: matriz de pontos que acende de cima para baixo conforme o carregamento avança.
// A grade apagada é desenhada uma vez num canvas fora da tela. A cada quadro os pontos acesos são
// agrupados por cor e nível de brilho e cada grupo vira um único preenchimento (poucos fill por quadro).
const RED = [215, 25, 33], LEVELS = 8;

// ruído determinístico por ponto (o mesmo ponto pisca sempre do mesmo jeito)
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createLoaderGrid(canvas, { reduced = false } = {}) {
  const g = canvas.getContext("2d");
  const base = document.createElement("canvas"), bg = base.getContext("2d");
  let W = 0, H = 0, dpr = 1, step = 14, r = 2.1, cols = 0, rows = 0;
  let progress = 0, shown = 0, wave = -1, raf = 0, t0 = performance.now(), lastT = t0;
  // zona limpa: uma elipse suave atrás da frase de status, onde os pontos quase somem (legibilidade)
  let clear = null;
  const clearK = (px, py) => {
    if (!clear) return 1;
    const d = Math.sqrt(((px - clear.cx) / clear.rx) ** 2 + ((py - clear.cy) / clear.ry) ** 2);
    const k = Math.min(1, Math.max(0, (d - 0.7) / 0.5));   // miolo limpo e borda longa, sem corte visível
    return 0.05 + 0.95 * k * k * (3 - 2 * k);
  };
  // cores pré-calculadas por nível de brilho: nada de string nova a cada ponto
  const fills = { grey: [], red: [] };
  for (let l = 1; l <= LEVELS; l++) {
    const a = l / LEVELS;
    fills.grey.push(`rgba(235,235,235,${(a * 0.8).toFixed(3)})`);
    fills.red.push(`rgba(${RED[0]},${RED[1]},${RED[2]},${Math.min(1, a * 1.1).toFixed(3)})`);
  }
  const buckets = { grey: Array.from({ length: LEVELS }, () => []), red: Array.from({ length: LEVELS }, () => []) };

  function layout() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    step = Math.min(18, Math.max(10, Math.min(W, H) * 0.016)); r = step * 0.19;   // a grade cresce com a tela, como os textos
    cols = Math.ceil(W / step) + 1; rows = Math.ceil(H / step) + 1;
    for (const c of [canvas, base]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    // grade apagada: grafite escuro, um pouco mais visível em cima
    bg.setTransform(dpr, 0, 0, dpr, 0, 0); bg.clearRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      const fade = Math.max(0, 1 - (y * step) / (H * 1.1));
      const a0 = 0.07 + 0.09 * fade, py = y * step + step / 2;
      bg.fillStyle = `rgba(255,255,255,${a0.toFixed(3)})`;
      bg.beginPath();
      for (let x = 0; x < cols; x++) {
        const px = x * step + step / 2;
        if (clear && clearK(px, py) < 0.999) continue;   // na zona limpa a grade apagada é desenhada à parte, mais fraca
        bg.moveTo(px + r, py); bg.arc(px, py, r, 0, Math.PI * 2);
      }
      bg.fill();
      if (clear) for (let x = 0; x < cols; x++) {
        const px = x * step + step / 2, k = clearK(px, py);
        if (k >= 0.999) continue;
        bg.fillStyle = `rgba(255,255,255,${(a0 * k).toFixed(3)})`; bg.beginPath(); bg.arc(px, py, r, 0, Math.PI * 2); bg.fill();
      }
    }
  }

  // brilho de cada ponto aceso: a faixa desce até a base da tela; mais forte em cima, ainda visível embaixo
  const reachNow = () => shown * (H + step * 4);
  function lit(x, y, t, reach, cb) {
    const py = y * step + step / 2;
    const edge = Math.min(1, Math.max(0, (reach - py) / (step * 3)));
    if (edge <= 0) return;
    const fade = 0.35 + 0.65 * Math.pow(Math.max(0, 1 - py / H), 0.8);
    const i = y * cols + x, h = hash(i);
    if (h > 0.7) return;                                                 // nem todo ponto acende
    const flick = reduced ? 0.7 : 0.45 + 0.55 * Math.max(0, Math.sin(t * (1.2 + h * 3.1) + h * 40));
    let a = edge * fade * flick * clearK(x * step + step / 2, py);
    if (wave >= 0) a *= Math.min(1, Math.max(0, (py - wave) / (step * 4)));
    if (a >= 0.03) cb(x * step + step / 2, py, a, hash(i + 9.17) < 0.08);
  }

  const toBucket = (px, py, a, red) => { buckets[red ? "red" : "grey"][Math.min(LEVELS - 1, Math.floor(a * LEVELS))].push(px, py); };

  function draw(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    // a faixa nunca fica parada: anda devagar sozinha (até 10% à frente do número), e alcança o progresso real sem saltos
    const creep = Math.min(0.97, progress + 0.1, shown + dt * 0.02);
    shown = reduced ? progress : Math.max(shown + (progress - shown) * Math.min(1, dt * 5), creep);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(base, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const k of ["grey", "red"]) for (const b of buckets[k]) b.length = 0;
    const reach = reachNow(), lastRow = Math.min(rows, Math.ceil((reach + step * 3) / step));
    for (let y = 0; y < lastRow; y++) for (let x = 0; x < cols; x++) lit(x, y, t, reach, toBucket);
    for (const k of ["grey", "red"]) {
      const rr = k === "red" ? r * 1.05 : r;
      buckets[k].forEach((pts, l) => {
        if (!pts.length) return;
        g.fillStyle = fills[k][l]; g.beginPath();
        for (let j = 0; j < pts.length; j += 2) { g.moveTo(pts[j] + rr, pts[j + 1]); g.arc(pts[j], pts[j + 1], rr, 0, Math.PI * 2); }
        g.fill();
      });
    }
    raf = requestAnimationFrame(draw);
  }

  // pontos acesos no quadro atual: [x, y, r, g, b, a, raio] por ponto (px CSS, cor 0–1), para virarem partículas
  function snapshot() {
    const out = [], t = (performance.now() - t0) / 1000, reach = reachNow();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      lit(x, y, t, reach, (px, py, a, red) => { out.push(px, py, red ? RED[0] / 255 : 0.92, red ? RED[1] / 255 : 0.92, red ? RED[2] / 255 : 0.92, Math.min(1, red ? a * 1.1 : a * 0.8), r); });
    }
    return out;
  }

  layout(); window.addEventListener("resize", layout);
  raf = requestAnimationFrame(draw);

  return {
    snapshot,
    // recebe o retângulo da frase (px CSS) e abre a zona limpa em volta dela
    setClear(rect) {
      clear = rect ? { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, rx: rect.width / 2 + step * 8, ry: rect.height / 2 + step * 5 } : null;
      layout();
    },
    hide() { cancelAnimationFrame(raf); canvas.style.visibility = "hidden"; },
    setProgress(v) { progress = Math.min(1, Math.max(0, v / 100)); },
    // apaga os pontos em onda (de cima para baixo); resolve quando a onda passa da tela
    exit(duration = 0.45) {
      return new Promise((done) => {
        const start = performance.now(), end = H * 1.1;
        const tick = (now) => { const k = Math.min(1, (now - start) / (duration * 1000)); wave = k * end; k < 1 ? requestAnimationFrame(tick) : done(); };
        requestAnimationFrame(tick);
      });
    },
    stop() { cancelAnimationFrame(raf); window.removeEventListener("resize", layout); },
  };
}
