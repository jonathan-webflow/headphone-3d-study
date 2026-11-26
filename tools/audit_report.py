"""Calcula o contraste WCAG de cada texto contra os pixels reais atrás dele.

Uso: python3 tools/audit_report.py <pasta-da-auditoria> [quantos-piores]
Lê audit.json + os prints *_bg.png gerados por audit_contrast.cjs.
"mean" = contra a média do fundo; "worst" = contra o percentil 95 mais claro (pior caso).
"""
import json, os, re, sys
import numpy as np
from PIL import Image

d = sys.argv[1]; top = int(sys.argv[2]) if len(sys.argv) > 2 else 25
data = json.load(open(os.path.join(d, "audit.json")))


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(rgb):
    r, g, b = lin(np.asarray(rgb, dtype=float)[..., 0]), lin(np.asarray(rgb, dtype=float)[..., 1]), lin(np.asarray(rgb, dtype=float)[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


rows = []
for shot in data["report"]:
    img = np.asarray(Image.open(os.path.join(d, shot["shot"] + "_bg.png")).convert("RGB"))
    H, W = img.shape[:2]
    for it in shot["items"]:
        x, y, w, h = it["rect"]; x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 - x0 < 2 or y1 - y0 < 2: continue
        bg = img[y0:y1, x0:x1].reshape(-1, 3).astype(float)
        m = re.findall(r"[\d.]+", it["color"]); col = np.array([float(v) for v in m[:3]]); a = (float(m[3]) if len(m) > 3 else 1.0) * it["opacity"]
        L = lum(bg); mean_bg = bg.mean(0); worst_bg = bg[np.argsort(L)[int(len(L) * 0.95)]]
        res = {}
        for k, b in (("mean", mean_bg), ("worst", worst_bg)):
            fg = col * a + b * (1 - a)
            res[k] = ratio(float(lum(fg[None])[0]), float(lum(b[None])[0]))
        big = it["size"] >= 24 or (it["size"] >= 18.66 and int(it["weight"]) >= 700)
        need = 3.0 if big else 4.5
        rows.append((res["worst"], res["mean"], need, shot["shot"], it["sel"], it["size"], it["text"]))

rows.sort()
fails = [r for r in rows if r[0] < r[2]]
print(f"viewport {data['viewport']}  textos medidos: {len(rows)}  abaixo da meta (pior pixel): {len(fails)}  erros de console: {len(data['errors'])}")
by = {}
for r in fails: by.setdefault(r[4].split(" ", 1)[1], []).append(r[0])
print("falhas por tipo:", {k: f"{len(v)} (pior {min(v):.1f})" for k, v in sorted(by.items(), key=lambda kv: -len(kv[1]))})
print(f"\n{'pior':>5} {'média':>5} {'meta':>4}  print                 elemento                    px  texto")
for w, m, need, shot, sel, size, text in rows[:top]:
    print(f"{w:5.1f} {m:5.1f} {need:4.1f}  {shot:<21} {sel:<27} {size:>3.0f}  {text}")
