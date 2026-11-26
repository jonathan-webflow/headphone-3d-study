"""Gera o diagrama de luz (vista de cima) do /case a partir de case/renders/breakdown/breakdown.json."""
import json, math, re, sys
d = json.load(open("case/renders/breakdown/breakdown.json"))
T, cam = d["target"], d["camera_hero"]
S, W, H = 220, 610, 560
cx, cy = 290, 290
P = lambda x, y: (cx + (x - T[0]) * S, cy - (y - T[1]) * S)
NAMES = {"FLM_key": "Strip key", "FLM_rim": "Strip rim", "FLM_side": "Strip side", "FLM_soft": "Strip soft", "FLM_fill": "Strip fill",
         "LGT_key": "Key", "LGT_rim_R": "Rim R", "LGT_rim_L": "Rim L", "LGT_top": "Top", "LGT_floor": "Floor", "LGT_ring_strip": "Ring", "CARD_gradient": "Card"}
# rótulos que colidiriam com a posição automática: deslocamento manual (dx, dy, alinhamento)
MANUAL = {"FLM_key": (-14, -14, "end"), "LGT_ring_strip": (12, 22, "start"), "CARD_gradient": (16, -8, "start")}
el = [f'<circle cx="{cx}" cy="{cy}" r="250" class="ld-hdri"/>',
      f'<text x="{cx}" y="{cy - 258}" text-anchor="middle" class="ld-t">HDRI · studio.hdr · 0.75</text>']
for L in d["lights"]:
    x, y = P(*L["loc"][:2]); dx, dy = x - cx, y - cy; n = math.hypot(dx, dy) or 1; ux, uy = dx / n, dy / n
    strip = L["group"] == "strips"
    if L["name"] == "LGT_floor":
        h = L["size"][0] * S / 2
        el.append(f'<rect x="{x - h:.0f}" y="{y - h:.0f}" width="{2 * h:.0f}" height="{2 * h:.0f}" rx="8" class="ld-floor"/>')
        el.append(f'<text x="{x - h + 8:.0f}" y="{y - h + 18:.0f}" class="ld-t">Floor (below)</text>'); continue
    half = max(L["size"][0], 0.04) * S / 2
    el.append(f'<line x1="{x + uy * half:.0f}" y1="{y - ux * half:.0f}" x2="{x - uy * half:.0f}" y2="{y + ux * half:.0f}" class="{"ld-strip" if strip else "ld-studio"}"/>')
    off = 16 + (6 if strip else 0)
    lx, ly = x + ux * off, y + uy * off + 4
    anchor = "start" if ux > 0.35 else "end" if ux < -0.35 else "middle"
    if abs(uy) > 0.6: ly += 8 if uy > 0 else -2
    if L["name"] in MANUAL: mx, my, anchor = MANUAL[L["name"]]; lx, ly = x + mx, y + my
    el.append(f'<text x="{lx:.0f}" y="{ly:.0f}" text-anchor="{anchor}" class="ld-t{" ld-tw" if strip else ""}">{NAMES[L["name"]]}</text>')
el.append(f'<rect x="{cx - 20}" y="{cy - 26}" width="40" height="52" rx="11" class="ld-prod"/>')
kx, ky = P(*cam[:2]); dx, dy = cx - kx, cy - ky; n = math.hypot(dx, dy)
el.append(f'<line x1="{kx:.0f}" y1="{ky:.0f}" x2="{kx + dx / n * 60:.0f}" y2="{ky + dy / n * 60:.0f}" class="ld-cam-ray"/>')
el.append(f'<circle cx="{kx:.0f}" cy="{ky:.0f}" r="6" class="ld-cam"/>')
el.append(f'<text x="{kx + 14:.0f}" y="{ky + 26:.0f}" class="ld-t ld-tw">Camera · 70 mm</text>')
svg = (f'<svg class="ld" viewBox="0 0 {W} {H}" role="img" aria-labelledby="ld-title"><title id="ld-title">Top view of the film lighting: '
       'four strip lights, four studio areas and a light card around the headphone, inside the studio HDRI, with the camera at the front right</title>' + "".join(el) + "</svg>")
p = "web/case/index.html"; s = open(p).read()
s = re.sub(r'<svg class="ld".*?</svg>', svg, s, count=1, flags=re.S); open(p, "w").write(s)
print("diagrama ok")
