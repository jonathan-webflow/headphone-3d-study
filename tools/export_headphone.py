"""
Headphone study — Blender export helper.

Run inside Blender (Scripting tab → Open → Run Script) or via the MCP.
It checks the scene against the names the web page expects, goes to frame 1
(assembled), selects only the product meshes and exports web/models/headphone.glb.

Contract (must match PARTS in web/main.js):
  Exploded layers (right cup, each with custom props explode_dx_mm / explode_start_frame):
    CupR_01_Glass, CupR_02_Rim, CupR_03_FacePlate (+ CupR_03a..k children),
    CupR_04_Driver, CupR_05_DriverFrame, CupR_06_PCB, CupR_07_Battery,
    CupR_08_Chassis, CupR_09b_Tray (+ CupR_09a_InnerFabric), CupR_10_CushionFoam,
    CupR_11_CushionCover
  Anchor: CupR_09_Shell (stays attached to the arm, which enters the window module)
  Rest: Band, BandPad, Slider_R/L, Arm_R/L, CupL_* (left cup)

Notes
- Explosion runs along Blender X, which stays X in glTF (Y-up conversion only swaps Y/Z).
- Modifiers (Bevel, WeightedNormal) are applied on export.
- The procedural leather bump does not export; the web page compensates in code.
"""

import os
import bpy

EXPLODED = [
    "CupR_01_Glass", "CupR_02_Rim", "CupR_03_FacePlate", "CupR_04_Driver",
    "CupR_05_DriverFrame", "CupR_06_PCB", "CupR_07_Battery", "CupR_08_Chassis",
    "CupR_09b_Tray", "CupR_10_CushionFoam", "CupR_11_CushionCover",
]
REQUIRED = EXPLODED + [
    "CupR_09_Shell", "Band", "BandPad", "Slider_R", "Slider_L", "Arm_R", "Arm_L",
    "CupL_09_Shell", "CupL_11_CushionCover",
]
COLLECTIONS = ["Cup_R", "Cup_L", "Headband"]

BLEND_DIR = os.path.dirname(bpy.data.filepath) or os.path.expanduser("~")
OUT = os.path.join(BLEND_DIR, "web", "models", "headphone.glb")


def check():
    problems = []
    names = {o.name for o in bpy.context.scene.objects}
    for n in REQUIRED:
        if n not in names:
            problems.append(f"missing object '{n}'")
    for n in EXPLODED:
        o = bpy.data.objects.get(n)
        if o and "explode_dx_mm" not in o.keys():
            problems.append(f"'{n}' has no explode_dx_mm")
    return problems


def select_product():
    bpy.ops.object.select_all(action="DESELECT")
    picked = []
    for cname in COLLECTIONS:
        for o in bpy.data.collections[cname].all_objects:
            if o.type != "MESH" or o.name.startswith("CUT") or o.hide_get() or o.hide_render:
                continue
            o.select_set(True)
            picked.append(o)
    return picked


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    scene = bpy.context.scene
    scene.frame_set(1)
    picked = select_product()
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
    )
    size = os.path.getsize(OUT) / 1e6
    print(f"Exported {len(picked)} objects → {OUT} ({size:.1f} MB)")
    print("Next: npx @gltf-transform/cli draco headphone.glb headphone.draco.glb")


problems = check()
if problems:
    print("\n✗ Fix these before exporting:")
    for p in problems:
        print("  -", p)
else:
    print("✓ Scene matches the web page contract")
    export()
