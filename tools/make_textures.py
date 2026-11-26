"""Gera as texturas repetíveis (tileable) do site em web/tex/.

Uso: python3 tools/make_textures.py
Cada material ganha um mapa de relevo (normal) e, quando faz sentido, um de rugosidade.
O ruído é filtrado no domínio da frequência (FFT), então as bordas emendam sem costura.
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "tex")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def band_noise(n, lo, hi, aniso=(1.0, 1.0)):
    """Ruído periódico com frequências entre lo e hi (ciclos por lado)."""
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    r = np.hypot(fx, fy)
    mask = np.exp(-((r - (lo + hi) / 2) ** 2) / (2 * ((hi - lo) / 2) ** 2))
    h = np.real(np.fft.ifft2(f * mask))
    return (h - h.min()) / (h.max() - h.min())


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / l, dy / l, nz / l], -1)   # Y para cima (convenção OpenGL / glTF)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save(name, arr, quality=88):
    path = os.path.join(OUT, name + ".webp")
    Image.fromarray(arr).save(path, quality=quality, method=6)
    print(f"{name}.webp  {arr.shape[1]}px  {os.path.getsize(path) // 1024} KB")


def grey(h):
    return (np.clip(h, 0, 1) * 255).astype(np.uint8)


# Alumínio jateado: grão muito fino e uniforme
h = band_noise(512, 60, 130)
save("alu_blast_n", normal_from_height(h, 2.2))
save("alu_blast_r", grey(0.5 + (band_noise(512, 30, 90) - 0.5) * 0.5))

# Couro sintético: vincos (ruído "ridged") + poros finos
ridge = 1 - np.abs(band_noise(1024, 10, 26) * 2 - 1)          # células com vincos entre elas
ridge = ridge ** 2.2
pores = band_noise(1024, 90, 160)
h = ridge * 0.85 + pores * 0.15
save("leather_n", normal_from_height(h, 5.5))
save("leather_r", grey(0.42 + (1 - ridge) * 0.3 + (pores - 0.5) * 0.1))

# Espuma de célula aberta: poros arredondados e irregulares
cells = band_noise(512, 26, 44)
h = np.clip((cells - 0.42) * 3.0, 0, 1) ** 1.5
save("foam_n", normal_from_height(h, 7.0))
save("foam_c", grey(0.35 + h * 0.65))                         # poros mais escuros (multiplica a cor)

# Tecido acústico: trama regular
n = 512; k = 28
y, x = np.mgrid[0:n, 0:n] / n * 2 * np.pi * k
h = (np.sin(x) * 0.5 + 0.5) * (np.sin(y) * 0.5 + 0.5)
h = h * 0.85 + band_noise(n, 80, 140) * 0.15
save("fabric_n", normal_from_height(h, 6.0))

# Soft-touch (arco e slider): textura quase lisa, só quebra o brilho
h = band_noise(512, 90, 170)
save("soft_n", normal_from_height(h, 1.0))
