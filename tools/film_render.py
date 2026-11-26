"""Renderiza um comercial da cena Film sem abrir a interface.

Uso (da raiz do projeto):
  /Applications/Blender.app/Contents/MacOS/Blender -b headphone_v019_film.blend -P tools/film_render.py -- c08 [primeiro] [ultimo] [passo]

A explosão e a câmera são calculadas aqui, quadro a quadro (as keyframes do site ficam intactas
no arquivo: este processo não salva nada).
"""
import bpy, math, sys, os, time
import mathutils
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
clip = argv[0]
first = int(argv[1]) if len(argv) > 1 and argv[0] not in ("posts", "still", "breakdown") and "," not in argv[1] else 1
last = int(argv[2]) if len(argv) > 2 and argv[0] not in ("posts", "still", "breakdown") else None
step = int(argv[3]) if len(argv) > 3 and argv[0] not in ("posts", "still", "breakdown") else 1
ROOT = os.path.dirname(bpy.data.filepath)

scene = bpy.data.scenes["Film"]
bpy.context.window.scene = scene if bpy.context.window else None


def smooth(x):            # ease in-out cúbico
    x = min(1, max(0, x)); return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1, max(0, x)); return 1 - (1 - x) ** 3


def lerp(a, b, t): return a + (b - a) * t


def aim(cam, target, d, dist, up_hint, shift_y=0.0):
    d = Vector(d).normalized(); pos = Vector(target) + d * dist
    fwd = -d; up = Vector(up_hint); up = (up - fwd * up.dot(fwd)).normalized(); right = fwd.cross(up)
    cam.matrix_world = mathutils.Matrix.Translation(pos) @ mathutils.Matrix((right, up, -fwd)).transposed().to_4x4()
    cam.data.shift_y = shift_y


# peças que explodem: a animação do site é desligada neste processo
PARTS = [o for o in bpy.data.objects if o.get("explode_dx_mm") is not None]
for o in PARTS:
    o.animation_data_clear()
BASE_X = 0.073

# ---------- look do filme: objeto preto em luz de faixas (só neste processo, nada é salvo) ----------
for n in ("LGT_floor", "FLM_fill", "LGT_top"):
    if n in bpy.data.objects: bpy.data.objects[n].hide_render = True


def strip(name, loc, target, size, energy):
    L = bpy.data.objects.get(name)
    if not L:
        L = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA")); scene.collection.objects.link(L)
    L.data.shape = "RECTANGLE"; L.data.size, L.data.size_y = size; L.data.energy = energy * STRIP_K
    L.location = loc; L.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


T0 = (0.074, 0, 0.05)
STRIP_K = 0.6   # com o estúdio do site iluminando, as faixas só desenham as bordas
strip("FLM_key", (0.42, -0.5, 0.6), T0, (0.7, 0.07), 9)      # faixa alta: linha de brilho no topo das peças
strip("FLM_rim", (-0.25, 0.45, 0.35), T0, (0.6, 0.06), 26)   # contorno por trás
strip("FLM_side", (0.75, 0.2, 0.05), T0, (0.05, 0.6), 7)     # faixa vertical: borda lateral do aro e da concha
strip("FLM_soft", (0.3, -0.8, 0.15), T0, (0.8, 0.8), 0.9)    # preenchimento mínimo, só para o preto não virar buraco
# ---------- materiais do site (web/main.js: applyTextures + bloco de materiais), para o filme ler igual ----------
TEX = os.path.join(ROOT, "web", "tex")
srgb = lambda h: tuple((c / 255) ** 2.2 for c in ((h >> 16) & 255, (h >> 8) & 255, h & 255)) + (1,)


def site_look(m, b):
    nt = m.node_tree; N, L = nt.nodes, nt.links

    def img(file, repeat, color=False):
        uv = N.new("ShaderNodeUVMap"); uv.uv_map = "UVMap"
        mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (repeat, repeat, 1)
        t = N.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(TEX, file + ".webp"), check_existing=True)
        t.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        L.new(uv.outputs["UV"], mp.inputs["Vector"]); L.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    def relief(file, repeat, strength):
        nm = N.new("ShaderNodeNormalMap"); nm.uv_map = "UVMap"; nm.inputs["Strength"].default_value = strength
        L.new(img(file, repeat).outputs["Color"], nm.inputs["Color"])
        for l in list(b.inputs["Normal"].links): L.remove(l)
        L.new(nm.outputs["Normal"], b.inputs["Normal"])

    def plain(name, v):
        for l in list(b.inputs[name].links): L.remove(l)
        b.inputs[name].default_value = v

    def sheen(w, r, tint):
        b.inputs["Sheen Weight"].default_value = w; b.inputs["Sheen Roughness"].default_value = r
        b.inputs["Sheen Tint"].default_value = tint

    n = m.name
    if n.startswith("MAT-alu"):
        rim = "rim" in n
        plain("Base Color", srgb(0x53565c if rim else 0x464a51)); plain("Roughness", 0.26 if rim else 0.36)
        b.inputs["Coat Weight"].default_value = 0.25; b.inputs["Coat Roughness"].default_value = 0.45
        relief("alu_blast_n", 5, 0.3)
    elif n.startswith("MAT-titanium"):
        plain("Base Color", srgb(0x3a3a3d)); plain("Roughness", 0.3); relief("alu_blast_n", 7, 0.2)
    elif n.startswith("MAT-leather"):
        plain("Base Color", srgb(0x0c0c0d))
        r = img("leather_r", 2.4); mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 0.95
        for l in list(b.inputs["Roughness"].links): L.remove(l)
        L.new(r.outputs["Color"], mul.inputs[0]); L.new(mul.outputs["Value"], b.inputs["Roughness"])
        sheen(0.35, 0.5, (0.34, 0.35, 0.37, 1)); relief("leather_n", 2.4, 0.32)
    elif n.startswith("MAT-foam"):
        c = img("foam_c", 3.5, color=True); mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1; mix.inputs["A"].default_value = srgb(0x66676b)
        L.new(c.outputs["Color"], mix.inputs["B"]); L.new(mix.outputs["Result"], b.inputs["Base Color"])
        plain("Roughness", 1.0); sheen(0.5, 0.9, (0.6, 0.6, 0.63, 1)); relief("foam_n", 3.5, 0.9)
    elif n.startswith("MAT-fabric"):
        plain("Roughness", 0.9); sheen(1.0, 0.7, (0.3, 0.3, 0.33, 1)); relief("fabric_n", 6, 1.0)
    elif n.startswith("MAT-plastic_softtouch"):
        plain("Base Color", srgb(0x161718)); plain("Roughness", 0.62); sheen(0.12, 0.6, (0.34, 0.35, 0.37, 1)); b.inputs["Specular IOR Level"].default_value = 0.35; relief("soft_n", 4, 0.25)
    elif n.startswith("MAT-plastic_gray"):
        relief("soft_n", 4, 0.25)
    elif n == "MAT-copper_coil":
        plain("Roughness", 0.22)
    elif n == "MAT-battery_foil":
        plain("Roughness", 0.24); b.inputs["Coat Weight"].default_value = 0.4


for m in bpy.data.materials:
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m.use_nodes and m.node_tree else None
    if b and m.name.startswith("MAT-"): site_look(m, b)

# mundo: o estúdio do site (web/env/studio.hdr) ilumina e dá reflexo; a câmera vê fundo transparente
W = bpy.data.worlds.new("World_film_site"); W.use_nodes = True
wn, wl = W.node_tree.nodes, W.node_tree.links
bg = next(n for n in wn if n.type == "BACKGROUND"); out_w = next(n for n in wn if n.type == "OUTPUT_WORLD")
env = wn.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.join(ROOT, "web", "env", "studio.hdr"), check_existing=True)
wmap = wn.new("ShaderNodeMapping"); wco = wn.new("ShaderNodeTexCoord")
wl.new(wco.outputs["Generated"], wmap.inputs["Vector"]); wl.new(wmap.outputs["Vector"], env.inputs["Vector"])
wl.new(env.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 0.75
scene.world = W; scene.render.film_transparent = True
ENV_ROT = wmap.inputs["Rotation"]


def env_turn(z):   # gira o estúdio como o site gira o ambiente durante a rolagem
    ENV_ROT.default_value = (0, 0, z)


env_turn(0.6)
scene.view_settings.exposure = -0.15
scene.eevee.taa_render_samples = 32   # lotes 2 e 3: metade das amostras, quase metade do tempo
for m in bpy.data.materials:
    if m.name.startswith("MAT-glass"):
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b:
            b.inputs["Transmission Weight"].default_value = 0.0; b.inputs["Alpha"].default_value = 0.14
            b.inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1); b.inputs["Roughness"].default_value = 0.03
            b.inputs["Specular IOR Level"].default_value = 1.0
        m.surface_render_method = "BLENDED"


def lights(key=9, rim=26, side=7, soft=0.9):
    for n, e in (("FLM_key", key), ("FLM_rim", rim), ("FLM_side", side), ("FLM_soft", soft)):
        bpy.data.objects[n].data.energy = e * STRIP_K


def explode(frame, start, stagger, dur):
    for o in PARTS:
        s = start + o["explode_order"] * stagger
        o.location.x = BASE_X + o["explode_dx_mm"] * 0.001 * smooth((frame - s) / dur)


# ---------- comerciais ----------
def teardown(frame, cam, end_dist, shift0, shift1):
    # 0–100: fone montado, câmera aproxima devagar · 100–270: camadas saem uma a uma · 270–300: segura
    explode(frame, start=100, stagger=10, dur=70)
    pull = smooth((frame - 80) / 120)     # a câmera recua junto com o vidro e assenta antes das últimas camadas
    push = ease_out(frame / 100) * 0.06
    dist = lerp(0.66 - push, end_dist, pull)
    tx = lerp(0.06, 0.074, pull)
    # órbita em volta do eixo da pilha (X): começa baixa e sobe por cima das camadas enquanto elas abrem
    orbit = math.radians(lerp(12, -48, smooth((frame - 90) / 200)) + 4 * (frame / 300))
    drift = math.radians(lerp(-4, 6, frame / 300))
    d = Vector((0.55, -0.72, 0.42)); d.rotate(mathutils.Euler((orbit, 0, drift)))
    aim(cam, (tx, 0, 0.045), d, dist, (1, 0, 0), lerp(shift0, shift1, pull))


def c08(frame, cam):    # 9:16: a pilha aberta cabe entre a marca (topo) e o texto (base)
    teardown(frame, cam, 1.3, -0.17, -0.13)


def c08f(frame, cam):   # 4:5, enquadrado para o feed
    teardown(frame, cam, 1.12, -0.1, -0.08)


# ---------- ferramentas dos comerciais de detalhe ----------
REST = {o.name: BASE_X for o in PARTS}
FMT = "45" if clip.endswith("f") or clip == "still" else "916"


def parts(k=None, hide=()):
    """k: {nome: fração da explosão}. As outras peças ficam montadas. hide: peças fora de cena."""
    k = k or {}
    for o in PARTS:
        o.location.x = BASE_X + o["explode_dx_mm"] * 0.001 * k.get(o.name, 0.0)
        o.hide_render = o.name in hide


def layers(cup_l=False, band=False):
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name == "Cup_L": lc.exclude = not cup_l
        if lc.name == "Headband": lc.exclude = not band


import json
# folga no topo para a assinatura, só nos planos com a peça isolada (os closes enchem o quadro de propósito)
HEADS = {"c01": {"916": [1.1, 0.07], "45": [1.06, 0.04]},
         "c03": {"916": [1.25, 0.12], "45": [1.15, 0.06]},
         "c09": {"916": [1.25, 0.12], "45": [1.15, 0.06]},
         "c10": {"916": [1.2, 0.1], "45": [1.1, 0.05]}}
_src = clip if clip != "still" else (argv[1] if argv[1] in ("c03f", "c09f") else "")   # posts: só os de peça isolada
HEAD = HEADS.get(_src.rstrip("f"), {"916": [1, 0], "45": [1, 0]})
if os.environ.get("FILM_HEAD"): HEAD = json.loads(os.environ["FILM_HEAD"])


def shot(frame, cam, keys):
    """keys: lista de dicts {f, t, d, dist, lens, sy:(9:16, 4:5), up, fstop}; interpola com ease in-out."""
    if frame <= keys[0]["f"]: a = b = keys[0]; u = 0
    elif frame >= keys[-1]["f"]: a = b = keys[-1]; u = 0
    else:
        i = max(j for j in range(len(keys)) if keys[j]["f"] <= frame)
        a, b = keys[i], keys[i + 1]; u = smooth((frame - a["f"]) / (b["f"] - a["f"]))
    L = lambda x, y: Vector(x).lerp(Vector(y), u)
    t = L(a["t"], b["t"]); d = L(a["d"], b["d"]); up = L(a.get("up", (0, 0, 1)), b.get("up", (0, 0, 1)))
    j = 0 if FMT == "916" else 1
    cam.data.lens = lerp(a.get("lens", 85), b.get("lens", 85), u)
    D = lambda k_: k_["dist"][j] if isinstance(k_["dist"], tuple) else k_["dist"]   # distância pode variar por formato
    # folga no topo para a assinatura: afasta a câmera (×M) e desce o produto (DY), por formato
    M, DY = HEAD[FMT]
    aim(cam, t, d, lerp(D(a), D(b), u) * M, up, lerp(a["sy"][j], b["sy"][j], u) + DY)
    fs = a.get("fstop")
    cam.data.dof.use_dof = fs is not None
    if fs: cam.data.dof.focus_distance = lerp(D(a), D(b), u) * M; cam.data.dof.aperture_fstop = fs


def k(f, f0, f1): return smooth((f - f0) / (f1 - f0))


CUP = (0.073, 0, 0.045)
FACE = (0.086, 0, 0.040)


def c01(f, cam):   # o fone inteiro sai do escuro e gira
    layers(True, True); parts()
    scene.view_settings.exposure = lerp(-4, -0.15, ease_out(f / 10))   # o produto aparece já no primeiro terço de segundo
    shot(f, cam, [
        dict(f=0, t=(0.01, 0, 0.095), d=(0.35, -0.9, 0.22), dist=(0.95, 0.92), lens=70, sy=(-0.15, -0.1)),
        dict(f=300, t=(0.0, 0, 0.095), d=(0.85, -0.55, 0.25), dist=(0.88, 0.86), lens=70, sy=(-0.15, -0.1)),
    ])


def c02(f, cam):   # controles: desliza do roller para o paddle e revela a lateral
    layers(); parts()
    shot(f, cam, [
        dict(f=0, t=(0.071, -0.037, 0.064), d=(0.35, -1, 0.2), dist=0.11, lens=100, sy=(-0.1, -0.06), fstop=2.8),
        dict(f=120, t=(0.071, -0.037, 0.047), d=(0.25, -1, 0.05), dist=0.12, lens=100, sy=(-0.1, -0.06), fstop=2.8),
        dict(f=240, t=(0.073, -0.02, 0.05), d=(0.45, -1, 0.3), dist=0.34, lens=100, sy=(-0.1, -0.06), fstop=5.6),
    ])


def c03(f, cam):   # o vidro sai da concha em direção à câmera
    layers(); parts({"CupR_01_Glass": 0.55 * k(f, 70, 190)})
    shot(f, cam, [
        dict(f=0, t=FACE, d=(1, -0.55, 0.35), dist=0.36, lens=85, sy=(-0.11, -0.07)),
        dict(f=240, t=(0.1, 0, 0.04), d=(1, -0.35, 0.3), dist=0.42, lens=85, sy=(-0.11, -0.07)),
    ])


def c04(f, cam):   # o aro: uma faixa de luz corre pelo metal
    layers(); lights(soft=0.2); parts({"CupR_01_Glass": 0.9, "CupR_02_Rim": 0.35 * k(f, 40, 160)}, hide=("CupR_01_Glass",))
    side = bpy.data.objects["FLM_side"]
    side.location = Vector((0.6, lerp(-0.6, 0.6, f / 240), 0.1)); side.data.energy = 12
    side.rotation_euler = (Vector(FACE) - side.location).to_track_quat("-Z", "Y").to_euler()
    shot(f, cam, [
        dict(f=0, t=(0.09, -0.02, 0.06), d=(0.75, -0.6, 0.45), dist=0.24, lens=100, sy=(-0.1, -0.06), fstop=8),
        dict(f=240, t=(0.095, 0, 0.045), d=(0.9, -0.3, 0.35), dist=0.3, lens=100, sy=(-0.1, -0.06), fstop=8),
    ])


def c05(f, cam):   # a placa gráfica, de frente, com o vidro e o aro afastados
    layers(); lights(key=6, soft=0.0); parts({"CupR_01_Glass": 1, "CupR_02_Rim": 1, "CupR_03_FacePlate": 0.25 * k(f, 30, 200)}, hide=("CupR_01_Glass", "CupR_02_Rim"))
    shot(f, cam, [
        dict(f=0, t=(0.09, 0.008, 0.032), d=(1, -0.3, 0.2), dist=0.19, lens=100, sy=(-0.09, -0.05), fstop=5.6),
        dict(f=240, t=(0.09, 0, 0.04), d=(1, -0.45, 0.3), dist=0.27, lens=100, sy=(-0.1, -0.06), fstop=5.6),
    ])


def c06(f, cam):   # o driver sai devagar da concha, em close
    layers(); lights(soft=0.3); top = ("CupR_01_Glass", "CupR_02_Rim", "CupR_03_FacePlate")
    parts({"CupR_04_Driver": 0.65 * k(f, 40, 200)}, hide=top)
    shot(f, cam, [
        dict(f=0, t=(0.07, 0, 0.042), d=(0.95, -0.25, 0.3), dist=0.3, lens=100, sy=(-0.1, -0.06), fstop=4),
        dict(f=240, t=(0.09, 0, 0.04), d=(0.85, -0.45, 0.3), dist=0.28, lens=100, sy=(-0.1, -0.06), fstop=5.6),
    ])


def c07(f, cam):   # a bateria aparece por baixo do driver
    layers(); lights(soft=0.3); top = ("CupR_01_Glass", "CupR_02_Rim", "CupR_03_FacePlate", "CupR_06_PCB")
    parts({"CupR_04_Driver": 1.4 * k(f, 20, 120), "CupR_07_Battery": 0.9 * k(f, 90, 210)}, hide=top)
    shot(f, cam, [
        dict(f=0, t=(0.075, 0, 0.03), d=(0.9, -0.5, 0.45), dist=0.3, lens=100, sy=(-0.1, -0.06)),
        dict(f=240, t=(0.088, 0, 0.014), d=(0.8, -0.55, 0.45), dist=0.17, lens=100, sy=(-0.1, -0.06), fstop=5.6),
    ])


def c09(f, cam):   # conforto: almofada e espuma se afastam, vistas do lado da cabeça
    layers(); parts({"CupR_11_CushionCover": 0.75 * k(f, 50, 190), "CupR_10_CushionFoam": 0.45 * k(f, 70, 200)})
    shot(f, cam, [
        dict(f=0, t=(0.05, 0, 0.045), d=(-0.9, -0.6, 0.35), dist=0.38, lens=85, sy=(-0.11, -0.07)),
        dict(f=240, t=(0.03, 0, 0.045), d=(-0.75, -0.8, 0.4), dist=0.45, lens=85, sy=(-0.11, -0.07)),
    ])


CUT10 = 210   # corte por preto (feito no Remotion) entre a concha se fechando e o fone inteiro


def c10(f, cam):   # plano 1: as onze camadas voltam para o lugar · plano 2: o fone inteiro gira
    if f < CUT10:
        layers(False, False)
        for o in PARTS:
            s0 = 20 + (10 - o["explode_order"]) * 9
            o.location.x = BASE_X + o["explode_dx_mm"] * 0.001 * (1 - smooth((f - s0) / 70))
            o.hide_render = False
        shot(f, cam, [
            dict(f=0, t=(0.074, 0, 0.05), d=(0.55, -0.72, 0.42), dist=1.2, lens=85, up=(1, 0, 0), sy=(-0.13, -0.08)),
            dict(f=CUT10, t=(0.07, 0, 0.05), d=(0.5, -0.8, 0.3), dist=0.7, lens=85, up=(1, 0, 0), sy=(-0.15, -0.1)),
        ])
    else:
        layers(True, True); parts()
        shot(f, cam, [
            dict(f=CUT10, t=(0.0, 0, 0.095), d=(0.55, -0.8, 0.2), dist=(0.98, 0.78), lens=70, sy=(-0.15, -0.07)),
            dict(f=300, t=(0.0, 0, 0.095), d=(0.85, -0.5, 0.25), dist=(0.92, 0.74), lens=70, sy=(-0.15, -0.07)),
        ])



# ---------- filmes de lançamento: revelação pela luz (r01) e cortes em macro (m01) ----------
def ctr(name):
    o = bpy.data.objects[name]; bpy.context.view_layer.update()
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


def hide_tree(names):
    """esconde as peças e tudo o que está preso nelas (detalhes da placa, bobina do driver…)"""
    def walk(o):
        o.hide_render = True
        for ch in o.children: walk(ch)
    for n in names: walk(bpy.data.objects[n])


HIDDEN0 = {o.name for o in scene.objects if o.hide_render}   # o que o arquivo já deixa fora do render continua fora


def show_all():
    for o in scene.objects:
        if o.type == "MESH" and not o.name.startswith("CARD"): o.hide_render = o.name in HIDDEN0


STUDIO = [o for o in scene.objects if (o.type == "LIGHT" and o.name.startswith("LGT_") and not o.hide_render) or o.name.startswith("CARD")]
WORLD_K = bg.inputs["Strength"].default_value


def darkness(k=0.0):
    """k = 0: só a faixa que varre; k = 1: a luz normal dos filmes"""
    for o in STUDIO: o.hide_render = k < 0.02
    for o in STUDIO:
        if o.type == "LIGHT": o.data.energy = o.get("_e", o.data.energy) * 1
    bg.inputs["Strength"].default_value = WORLD_K * k
    lights(9 * k, 26 * k, 7 * k, 0.9 * k)


for o in STUDIO:
    if o.type == "LIGHT": o["_e"] = o.data.energy


def sweep(name, start, end, u, target, energy, size=None):
    L = bpy.data.objects[name]; L.location = Vector(start).lerp(Vector(end), u)
    L.rotation_euler = (Vector(target) - L.location).to_track_quat("-Z", "Y").to_euler()
    L.data.energy = energy
    if size: L.data.size, L.data.size_y = size


def r01(f, cam):   # o fone aparece só pela luz: arco, aro, controles, e por fim inteiro
    show_all()
    if f < 110:      # 1. a linha de luz corre pelo arco
        layers(True, True); parts(); darkness(0); u = f / 110
        sweep("FLM_key", (-0.35, -0.25, 0.42), (0.35, -0.25, 0.42), smooth(u), (0, 0, 0.17), 14, (0.05, 0.6))
        shot(f, cam, [dict(f=0, t=(0.0, 0, 0.165), d=(0.15, -1, 0.12), dist=(0.42, 0.36), lens=85, sy=(0.0, 0.0)),
                      dict(f=110, t=(0.01, 0, 0.165), d=(0.3, -1, 0.1), dist=(0.39, 0.33), lens=85, sy=(0.0, 0.0))])
    elif f < 220:    # 2. uma faixa vertical atravessa o aro de alumínio
        layers(); parts(); darkness(0); u = (f - 110) / 110
        sweep("FLM_side", (0.6, -0.6, 0.1), (0.6, 0.6, 0.1), u, FACE, 14, (0.05, 0.6))
        shot(f, cam, [dict(f=110, t=(0.09, -0.02, 0.06), d=(0.75, -0.6, 0.45), dist=0.24, lens=100, sy=(-0.04, -0.02), fstop=8),
                      dict(f=220, t=(0.095, 0, 0.05), d=(0.85, -0.4, 0.38), dist=0.27, lens=100, sy=(-0.04, -0.02), fstop=8)])
    elif f < 310:    # 3. a luz desce pela lateral e acha os controles
        layers(); parts(); darkness(0); u = (f - 220) / 90
        sweep("FLM_side", (0.25, -0.55, 0.32), (0.25, -0.55, -0.12), smooth(u), (0.071, -0.037, 0.055), 10, (0.5, 0.05))
        shot(f, cam, [dict(f=220, t=(0.071, -0.037, 0.06), d=(0.35, -1, 0.15), dist=0.12, lens=100, sy=(0.0, 0.0), fstop=2.8),
                      dict(f=310, t=(0.071, -0.037, 0.05), d=(0.3, -1, 0.08), dist=0.115, lens=100, sy=(0.0, 0.0), fstop=2.8)])
    else:            # 4. a faixa passa pelo fone inteiro e a luz do estúdio acende
        layers(True, True); parts(); u = (f - 310) / 110
        darkness(smooth((f - 345) / 50))
        sweep("FLM_key", (-0.5, -0.5, 0.6), (0.6, -0.5, 0.6), smooth(min(1, u * 1.6)), (0, 0, 0.09), max(9 * 0.6, 16 * (1 - smooth((f - 345) / 50))), (0.7, 0.07))
        shot(f, cam, [dict(f=310, t=(0.0, 0, 0.095), d=(0.55, -0.8, 0.2), dist=(0.86, 0.8), lens=70, sy=(-0.1, -0.06)),
                      dict(f=420, t=(0.0, 0, 0.095), d=(0.75, -0.62, 0.24), dist=(0.82, 0.76), lens=70, sy=(-0.1, -0.06))])


MSHOT = 60   # quadros por plano nos cortes em macro (2 s)


def focus_on(cam, target):
    """foco na superfície real: um raio da câmera até o alvo; sem acerto, usa a distância do alvo"""
    o = cam.matrix_world.translation; d = (Vector(target) - o).normalized(); p = o.copy(); dg = bpy.context.evaluated_depsgraph_get()
    for _ in range(12):   # atravessa o que está fora do render (vidro, aro escondidos) até a primeira peça visível
        hit, loc, nrm, idx, ob, mtx = scene.ray_cast(dg, p, d)
        if not hit: break
        if not ob.original.hide_render:
            print(f"[film] foco {ob.name} {(loc - o).length:.4f} (alvo {(Vector(target) - o).length:.4f})", flush=True)
            return (loc - o).length
        p = loc + d * 1e-4
    return (Vector(target) - o).length


def macro(f, cam, i, target, d, dist, fstop=5.0, sy=0.0, push=0.06, slide=5.0, lens=100, ray=True):
    """plano de detalhe: aproxima um pouco e desliza de lado, com o foco cravado na superfície"""
    u = (f - i * MSHOT) / MSHOT
    dd = Vector(d).normalized(); dd.rotate(mathutils.Euler((0, 0, math.radians(lerp(-slide / 2, slide / 2, u)))))
    dist_ = dist * (1 - push * smooth(u))
    cam.data.lens = lens; aim(cam, target, dd, dist_, (0, 0, 1), sy); bpy.context.view_layer.update()
    cam.data.dof.use_dof = True; cam.data.dof.focus_object = None
    cam.data.dof.focus_distance = focus_on(cam, target) if ray else (Vector(target) - cam.matrix_world.translation).length; cam.data.dof.aperture_fstop = fstop
    sweep("FLM_side", Vector(target) + dd * 0.4 + Vector((0, -0.25, 0.1)), Vector(target) + dd * 0.4 + Vector((0, 0.25, 0.1)), u, target, 7 * STRIP_K * 1.6)
    return u


TOP3 = ("CupR_01_Glass", "CupR_02_Rim", "CupR_03_FacePlate")
M_END = 7 * MSHOT


def m01(f, cam):   # sete detalhes em cortes de 2 s e o fone inteiro no fim
    show_all(); darkness(1); layers(); parts(); i = min(f // MSHOT, 7)
    scene.eevee.taa_render_samples = 64
    if i == 0:     # aro de alumínio, de raspão
        macro(f, cam, i, ctr("CupR_02_Rim") + Vector((0.0, 0.02, 0.026)), (0.7, 0.55, 0.45), 0.13)
    elif i == 1:   # grade de pontos e texto impresso da placa
        parts({"CupR_01_Glass": 1, "CupR_02_Rim": 1}); hide_tree(("CupR_01_Glass", "CupR_02_Rim"))
        macro(f, cam, i, ctr("CupR_03h_DotGrid") + Vector((0, 0.003, 0.005)), (1, -0.3, 0.3), 0.11)
    elif i == 2:   # os anéis do driver, fora da concha
        hide_tree(TOP3); parts({"CupR_04_Driver": 0.45})
        macro(f, cam, i, ctr("CupR_04d_Surround") + Vector((0.002, 0.0, 0.012)), (0.5, -0.75, 0.45), 0.11, fstop=8.0, ray=False)
    elif i == 3:   # a grade acústica por trás do driver
        hide_tree(TOP3 + ("CupR_04_Driver", "CupR_06_PCB", "CupR_07_Battery"))
        macro(f, cam, i, ctr("CupR_05a_Grille"), (1, -0.35, 0.3), 0.1)
    elif i == 4:   # o grão do couro da almofada
        macro(f, cam, i, ctr("CupR_11_CushionCover") + Vector((-0.006, -0.03, 0.02)), (-0.45, -0.8, 0.4), 0.09, fstop=4.0)
    elif i == 5:   # roller e paddle na lateral
        macro(f, cam, i, Vector((0.071, -0.037, 0.058)), (0.35, -1, 0.18), 0.12)
    elif i == 6:   # a articulação do braço na concha
        layers(True, True); parts()
        macro(f, cam, i, ctr("Arm_R") + Vector((0, 0, -0.006)), (0.75, -0.65, 0.15), 0.12)
    else:          # fim: o fone inteiro
        layers(True, True); parts(); cam.data.dof.use_dof = False
        shot(f, cam, [dict(f=M_END, t=(0.0, 0, 0.095), d=(0.6, -0.78, 0.22), dist=(0.86, 0.8), lens=70, sy=(-0.1, -0.06)),
                      dict(f=M_END + 60, t=(0.0, 0, 0.095), d=(0.72, -0.66, 0.24), dist=(0.82, 0.76), lens=70, sy=(-0.1, -0.06))])


CLIPS = {"c08": (c08, 300), "c08f": (c08f, 300)}
for name, fn_, n in (("c01", c01, 300), ("c02", c02, 240), ("c03", c03, 240), ("c04", c04, 240), ("c05", c05, 240),
                     ("c06", c06, 240), ("c07", c07, 240), ("c09", c09, 240), ("c10", c10, 300)):
    CLIPS[name] = (fn_, n); CLIPS[name + "f"] = (fn_, n)
CLIPS.update({"r01": (r01, 420), "r01f": (r01, 420), "m01": (m01, 480)})


# ---------- posts estáticos (Cycles, 1080×1350) ----------
def set_layers(show):
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name in ("Cup_L", "Headband"): lc.exclude = not show


def still_cam(name):
    c = bpy.data.objects.get(name)
    if not c:
        c = bpy.data.objects.new(name, bpy.data.cameras.new(name)); scene.collection.objects.link(c)
    c.data.sensor_width = 36; c.data.clip_start = 0.01; c.data.clip_end = 10
    return c


def p01(cam):   # o fone inteiro, como no herói do site; texto embaixo
    set_layers(True); explode(0, 1, 1, 1)
    hero = bpy.data.objects["CAM_hero"]
    cam.matrix_world = hero.matrix_world.copy(); cam.data.lens = 70; cam.data.shift_y = -0.12; cam.data.shift_x = 0.0
    cam.location += (cam.matrix_world.to_quaternion() @ Vector((0, 0, 1))) * 0.12   # recua para caber no 4:5


def p02(cam):   # a concha aberta; texto em cima
    set_layers(False); explode(999, 0, 0, 1)
    cam.data.lens = 85; cam.data.shift_x = 0.0
    aim(cam, (0.074, 0, 0.045), (0.55, -0.72, 0.42), 1.1, (1, 0, 0), 0.13)   # mais baixo: a assinatura e o título ficam em cima
    cam.data.shift_x = -0.06


def p03(cam):   # o driver em close extremo, com desfoque óptico
    set_layers(False)
    for o in PARTS:   # as camadas por cima do driver saem de cena; o driver sai um pouco da concha
        o.location.x = BASE_X
        if o["explode_order"] < 3: o.hide_render = True
    drv = bpy.data.objects["CupR_04_Driver"]
    drv.location.x = BASE_X + drv["explode_dx_mm"] * 0.001 * 0.6
    t = Vector((drv.location.x + 0.004, 0, 0.045))
    cam.data.lens = 100; cam.data.shift_x = 0.0
    aim(cam, t, (0.9, -0.38, 0.3), 0.26, (0, 0, 1), -0.1)
    cam.data.dof.use_dof = True; cam.data.dof.focus_object = drv; cam.data.dof.aperture_fstop = 2.8


POSTS = {"p01": p01, "p02": p02, "p03": p03}

if clip == "still":
    # post a partir de um quadro de um comercial, em Cycles 4:5: still <clip> <quadro> <nome>
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d_ in prefs.devices: d_.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("[film] GPU indisponível:", e)
    src, fr, name = argv[1], int(argv[2]), argv[3]
    scene.render.engine = "CYCLES"; scene.cycles.samples = 256; scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1080, 1350
    cam = bpy.data.objects["CAM_c08"]; scene.camera = cam
    scene.frame_set(fr); CLIPS[src][0](fr, cam); bpy.context.view_layer.update()
    # ajustes opcionais só do post: [afastar ×] [shift_y] [f-stop, 0 = sem desfoque]; "-" mantém
    opt = argv[4:7] + ["-"] * (3 - len(argv[4:7]))
    if opt[0] != "-":
        m = float(opt[0]); fwd = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
        fd = (Vector((0, 0, 0)) - cam.location).dot(fwd)   # distância até o produto, medida no eixo da câmera
        cam.location = cam.location - fwd * fd * (m - 1); cam.data.dof.focus_distance = fd * m
    if opt[1] != "-": cam.data.shift_y = float(opt[1])
    if opt[2] != "-":
        if float(opt[2]) == 0: cam.data.dof.use_dof = False
        else: cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = float(opt[2])
    out = os.path.join(ROOT, "case", "renders", "posts"); os.makedirs(out, exist_ok=True)
    t0 = time.time(); scene.render.filepath = os.path.join(out, name + ".png")
    bpy.ops.render.render(write_still=True, scene=scene.name)
    print(f"[film] post {name} {time.time() - t0:.1f}s", flush=True)
    sys.exit(0)

if clip == "posts":
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("[film] GPU indisponível:", e)
    scene.render.engine = "CYCLES"; scene.cycles.samples = 256; scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1080, 1350
    out = os.path.join(ROOT, "case", "renders", "posts"); os.makedirs(out, exist_ok=True)
    only = argv[1:] or list(POSTS)
    for name in only:
        cam = still_cam("CAM_" + name); scene.camera = cam
        cam.data.dof.use_dof = False
        POSTS[name](cam)
        bpy.context.view_layer.update()
        t0 = time.time()
        scene.render.filepath = os.path.join(out, name + ".png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        print(f"[film] post {name} {time.time() - t0:.1f}s", flush=True)
    sys.exit(0)
if clip == "breakdown":
    # páginas do "3D breakdown" no /case: breakdown [stats wire mats lights stages]
    import math, bmesh, shutil
    what = argv[1:] or ["stats", "wire", "mats", "lights", "stages"]
    out = os.path.join(ROOT, "case", "renders", "breakdown"); os.makedirs(out, exist_ok=True)
    FMT = "45"
    ENGINE, VT = scene.render.engine, scene.view_settings.view_transform
    info = {}
    jpath = os.path.join(out, "breakdown.json")
    if os.path.exists(jpath): info = json.load(open(jpath))

    def gpu():
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "METAL"; prefs.get_devices()
            for d_ in prefs.devices: d_.use = True
            scene.cycles.device = "GPU"
        except Exception as e:
            print("[film] GPU indisponível:", e)

    def save(name):
        t0 = time.time(); scene.render.filepath = os.path.join(out, name + ".png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        print(f"[film] breakdown {name} {time.time() - t0:.1f}s", flush=True)

    def eevee(): scene.render.engine = ENGINE; scene.view_settings.view_transform = VT

    def clay_override(on, grey=0.32, rough=0.55):
        m = bpy.data.materials.get("MAT_breakdown_clay")
        if not m:
            m = bpy.data.materials.new("MAT_breakdown_clay"); m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (grey, grey, grey, 1); b.inputs["Roughness"].default_value = rough
        bpy.context.view_layer.material_override = m if on else None

    def hero():   # o ângulo do herói do site (post 1)
        cam = still_cam("CAM_p01"); scene.camera = cam; cam.data.dof.use_dof = False; p01(cam)
        bpy.context.view_layer.update(); return cam

    def bezel():  # a concha aberta em close (post 6: comercial 4, 4:5, quadro 200)
        cam = bpy.data.objects["CAM_c08"]; scene.camera = cam; scene.frame_set(200)
        CLIPS["c04f"][0](200, cam); bpy.context.view_layer.update(); return cam

    def workbench(color):
        scene.render.engine = "BLENDER_WORKBENCH"; scene.view_settings.view_transform = "Standard"
        sh = scene.display.shading; sh.light = "STUDIO"; sh.color_type = color; sh.single_color = (0.62, 0.62, 0.62)
        sh.show_cavity = True; sh.cavity_type = "BOTH"; sh.show_object_outline = True; sh.show_specular_highlight = True
        scene.display.render_aa = "8"

    if "stats" in what:
        set_layers(True); explode(0, 1, 1, 1); bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get(); tris = parts_n = 0; mats = set(); uv2 = 0; mods = {}
        for o in scene.objects:
            if o.type != "MESH" or o.name.startswith("CARD") or not o.visible_get(): continue
            eo = o.evaluated_get(dg); me = eo.to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); eo.to_mesh_clear()
            parts_n += 1; uv2 += len(o.data.uv_layers) > 1
            mats.update(m.name for m in o.data.materials if m)
            for md in o.modifiers: mods[md.type] = mods.get(md.type, 0) + 1
        info["stats"] = {"parts": parts_n, "triangles": tris, "materials": len(mats), "two_uv_sets": uv2, "modifiers": mods}
        print("[film] breakdown stats", info["stats"], flush=True)

    if "wire" in what:
        # argila com todas as arestas desenhadas pelo Freestyle: as do modelo (marcadas aqui, só na memória) e as do bevel (vinco)
        eevee(); clay_override(True, 0.012)
        for o in scene.objects:
            if o.type == "MESH":
                me_ = o.data; at = me_.attributes.get("freestyle_edge") or me_.attributes.new("freestyle_edge", "BOOLEAN", "EDGE")
                at.data.foreach_set("value", [True] * len(me_.edges))
        scene.render.use_freestyle = True; scene.render.line_thickness_mode = "ABSOLUTE"; scene.render.line_thickness = 0.7
        vl = bpy.context.view_layer; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(179)
        ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("wire")
        ls.select_by_visibility = True; ls.visibility = "VISIBLE"; ls.select_by_edge_types = True
        ls.select_crease = ls.select_silhouette = ls.select_border = ls.select_edge_mark = True
        ls.linestyle.color = (0.9, 0.9, 0.9); ls.linestyle.thickness = 0.7; ls.linestyle.alpha = 0.85
        hero(); save("wire_hero")
        bezel().data.dof.use_dof = False; save("wire_bezel")
        scene.render.use_freestyle = False; clay_override(False)

    if "mats" in what:
        # esferas de amostra com os materiais reais, na luz dos filmes, em Cycles
        gpu(); scene.render.engine = "CYCLES"; scene.cycles.samples = 256; scene.cycles.use_denoising = True
        scene.view_settings.view_transform = VT
        hidden = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
        for o in hidden: o.hide_render = True
        me = bpy.data.meshes.new("SWATCH"); bm = bmesh.new(); bm.loops.layers.uv.new("UVMap")
        bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=0.03, calc_uvs=True); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        sw = bpy.data.objects.new("SWATCH", me); scene.collection.objects.link(sw); sw.location = T0
        cam = still_cam("CAM_swatch"); scene.camera = cam; cam.data.dof.use_dof = False; cam.data.lens = 85; cam.data.shift_x = 0
        aim(cam, T0, (0.62, -0.74, 0.26), 0.25, (0, 0, 1), 0.0)
        scene.render.resolution_x = scene.render.resolution_y = 1000
        info["materials"] = []
        lin2hex = lambda c: "#" + "".join(f"{round(min(1, max(0, v)) ** (1 / 2.2) * 255):02x}" for v in c[:3])
        for key, label in (("MAT-alu_graphite_satin", "Graphite aluminium"), ("MAT-titanium_dark", "Dark titanium"),
                           ("MAT-leather_pu_black", "PU leather"), ("MAT-foam_gray", "Memory foam"),
                           ("MAT-fabric_black", "Acoustic fabric"), ("MAT-plastic_softtouch_dark", "Soft-touch plastic")):
            m = bpy.data.materials[key]; me.materials.clear(); me.materials.append(m)
            b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            val = lambda name: None if b.inputs[name].links else round(b.inputs[name].default_value, 2)
            rec = {"key": key, "label": label, "metallic": val("Metallic"), "roughness": val("Roughness") if val("Roughness") is not None else "map",
                   "sheen": round(b.inputs["Sheen Weight"].default_value, 2), "coat": round(b.inputs["Coat Weight"].default_value, 2),
                   "base": lin2hex(b.inputs["Base Color"].default_value) if not b.inputs["Base Color"].links else "map"}
            nl = b.inputs["Normal"].links
            if nl:
                nm = nl[0].from_node; tex = nm.inputs["Color"].links[0].from_node; mp = tex.inputs["Vector"].links[0].from_node
                rec["normal"] = {"map": tex.image.name.rsplit(".", 1)[0], "repeat": round(mp.inputs["Scale"].default_value[0], 2), "strength": round(nm.inputs["Strength"].default_value, 2)}
            info["materials"].append(rec)
            save("mat_" + key[4:])
        bpy.data.objects.remove(sw); scene.render.resolution_x, scene.render.resolution_y = 1080, 1350
        for o in hidden: o.hide_render = False

    if "lights" in what:
        # a luz real dos filmes, por grupo, sobre argila neutra (EEVEE, ângulo do herói):
        # só o HDRI do site, só as áreas de estúdio do .blend (LGT_* e o cartão), só as faixas do filme (FLM_*), tudo junto
        eevee(); clay_override(True, 0.16, 0.28); hero()   # argila escura e acetinada: o reflexo de cada luz aparece
        lamps = [o for o in scene.objects if (o.type == "LIGHT" or o.name.startswith("CARD")) and o.visible_get() and not o.hide_render]   # as que o filme desliga ficam fora
        group = lambda o: "strips" if o.name.startswith("FLM_") else "studio"
        def only(g, world):
            for o in lamps: o.hide_render = g != "all" and group(o) != g
            scene.world = W if world else None; bpy.context.view_layer.update()
        for name, g, world in (("hdri", "none", True), ("studio", "studio", False), ("strips", "strips", False), ("all", "all", True)):
            only(g, world); save("light_" + name)
        for o in lamps: o.hide_render = False
        scene.world = W; clay_override(False)
        info["lights"] = [{"name": o.name, "group": group(o), "type": o.data.type if o.type == "LIGHT" else "EMISSIVE_CARD",
                           "loc": [round(v, 3) for v in o.matrix_world.translation],
                           "size": [round(o.data.size, 3), round(getattr(o.data, "size_y", o.data.size), 3)] if o.type == "LIGHT" else [round(v, 3) for v in o.dimensions[:2]],
                           "energy": round(o.data.energy, 2) if o.type == "LIGHT" else None} for o in lamps]
        info["hdri"] = {"file": "web/env/studio.hdr", "strength": round(bg.inputs["Strength"].default_value, 2)}
        info["target"] = list(T0); info["camera_hero"] = [round(v, 3) for v in scene.camera.matrix_world.translation]

    if "stages" in what:
        # o mesmo quadro do comercial 1 (4:5, quadro 150) em quatro etapas
        HEAD = HEADS["c01"]; cam = bpy.data.objects["CAM_c08"]; scene.camera = cam
        scene.frame_set(150); CLIPS["c01f"][0](150, cam); bpy.context.view_layer.update()
        eevee(); clay_override(True); save("stage_3_light"); clay_override(False)
        workbench("SINGLE"); save("stage_1_clay")
        for m in bpy.data.materials:   # a cor de viewport recebe a cor base do material
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m.use_nodes and m.node_tree else None
            if b: m.diffuse_color = b.inputs["Base Color"].default_value
        workbench("MATERIAL"); save("stage_2_color")
        shutil.copy(os.path.join(ROOT, "case", "renders", "c01f", "0150.png"), os.path.join(out, "stage_4_final.png"))
        eevee()

    json.dump(info, open(jpath, "w"), indent=2); print("[film] breakdown pronto", flush=True)
    sys.exit(0)
fn, length = CLIPS[clip]
cam_name = "CAM_c08"
scene.render.resolution_x, scene.render.resolution_y = (1080, 1350) if clip.endswith("f") else (1080, 1920)
cam = bpy.data.objects[cam_name]
scene.camera = cam
last = last or length
out = os.path.join(ROOT, "case", "renders", clip)
os.makedirs(out, exist_ok=True)
t0 = time.time()
frames = [int(x) for x in argv[1].split(",")] if len(argv) > 1 and "," in argv[1] else range(first, last + 1, step)
out = os.path.join(ROOT, "case", "renders", "look", clip) if len(argv) > 1 and "," in argv[1] else out
WB = os.environ.get("FILM_ENGINE") == "WORKBENCH"   # versão "viewport": sólido cinza, como o Blender mostra o modelo
if WB:
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"; sh.color_type = "SINGLE"; sh.single_color = (0.62, 0.62, 0.62)
    sh.show_cavity = True; sh.cavity_type = "BOTH"; sh.show_object_outline = True; sh.show_specular_highlight = True
    scene.display.render_aa = "8"
    out = os.path.join(ROOT, "case", "renders", clip + "_wb")
os.makedirs(out, exist_ok=True)
for fr in frames:
    scene.frame_set(fr)
    fn(fr, cam)
    if WB: scene.view_settings.exposure = 0; scene.view_settings.view_transform = "Standard"
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(out, f"{fr:04d}.png")
    bpy.ops.render.render(write_still=True, scene=scene.name)
    print(f"[film] {clip} {fr}/{last}  {time.time() - t0:.1f}s", flush=True)
