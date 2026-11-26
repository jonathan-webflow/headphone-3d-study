"""Compara um render do Blender com uma foto de referência na mesma escala.

Uso: python3 tools/fit_compare.py <foto> <render.png> <saida.png>
Saída: três quadros lado a lado: foto | render | sobreposição (foto clareada + contorno do render em vermelho).
"""
import sys
from PIL import Image, ImageChops, ImageFilter, ImageOps

ref_path, ren_path, out_path = sys.argv[1:4]
ref = Image.open(ref_path).convert("RGB")
ren = Image.open(ren_path).convert("RGBA").resize(ref.size)

# contorno do render: borda do canal alfa
alpha = ren.split()[3]
edge = alpha.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(3))

ref_bright = ImageOps.autocontrast(ImageOps.grayscale(ref), cutoff=1).convert("RGB")
ref_bright = Image.blend(ref_bright, Image.new("RGB", ref.size, (255, 255, 255)), 0.15)
overlay = ref_bright.copy()
overlay.paste((255, 40, 40), mask=edge)

ren_on_black = Image.new("RGB", ref.size, (18, 18, 18))
ren_on_black.paste(ren, mask=alpha)

w, h = ref.size
sheet = Image.new("RGB", (w * 3, h), (0, 0, 0))
sheet.paste(ref, (0, 0)); sheet.paste(ren_on_black, (w, 0)); sheet.paste(overlay, (w * 2, 0))
sheet = sheet.resize((w * 3 // 2, h // 2))
sheet.save(out_path)

# cobertura: quanto do produto da foto o render cobre (silhueta grosseira por limiar)
ref_mask = ImageOps.grayscale(ref).point(lambda v: 255 if v > 38 else 0)
inter = ImageChops.multiply(ref_mask, alpha.point(lambda v: 255 if v > 128 else 0))
a = sum(1 for v in ref_mask.getdata() if v); b = sum(1 for v in alpha.getdata() if v > 128); c = sum(1 for v in inter.getdata() if v)
print(f"foto={a}px render={b}px intersecao={c}px  IoU~{c / max(1, a + b - c):.2f}")
