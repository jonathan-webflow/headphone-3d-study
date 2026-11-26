import type { FeatureProps } from "./Feature";

// Os comerciais de detalhe, na ordem do site. O 8 (teardown) tem composição própria.
export const CLIPS: (Omit<FeatureProps, "rendered"> & { id: string; frames: number })[] = [
  { id: "C01-Hero", seq: "c01", frames: 300, label: "OVERVIEW", title: ["HEADPHONE", "(1) PRO"], sub: "A teardown study, modelled from scratch in Blender.", detail: ["Every part,", "built by hand."], close: ["Studied in 3D.", "Layer by layer."] },
  { id: "C02-Controls", seq: "c02", frames: 240, label: "CONTROLS", title: ["ROLLER.", "PADDLE.", "BUTTON."], sub: "Learn them once, then use them blind.", detail: ["Every control,", "where your hand", "expects it."], close: ["No screen", "needed."] },
  { id: "C03-Glass", seq: "c03", frames: 240, label: "GLASS", title: ["IT STARTS", "WITH GLASS."], sub: "A 9H window keeps the inside on show.", stat: { value: "9H", label: "GLASS HARDNESS" }, close: ["Lifted away", "first."] },
  { id: "C04-Bezel", seq: "c04", frames: 240, label: "BEZEL", title: ["CUT FROM", "METAL."], sub: "An aluminium bezel holds the glass and the arm in one line.", detail: ["Graphite", "aluminium."], close: ["One frame.", "One line."] },
  { id: "C05-Plate", seq: "c05", frames: 240, label: "GRAPHIC PLATE", title: ["THE LAYER", "YOU SEE."], sub: "Graphics printed on the inner plate, right behind the glass.", detail: ["Red accent.", "Dot grid.", "Vertical type."], close: ["Meant to", "be seen."] },
  { id: "C06-Driver", seq: "c06", frames: 240, label: "DRIVER", title: ["THE", "DRIVER."], sub: "A dynamic driver with a PET dome, at the centre of everything.", stat: { value: 40, label: "MM DYNAMIC DRIVER" }, close: ["Where the", "sound starts."] },
  { id: "C07-Battery", seq: "c07", frames: 240, label: "BATTERY", title: ["TUCKED", "UNDER."], sub: "A lithium-ion cell, hidden below the driver.", stat: { value: 1060, label: "MAH BATTERY" }, close: ["Shaped to", "fit the cup."] },
  { id: "C09-Comfort", seq: "c09", frames: 240, label: "COMFORT", title: ["SOFT", "WHERE IT", "TOUCHES."], sub: "A foam core wrapped in synthetic leather.", detail: ["Foam core.", "Synthetic leather."], close: ["The part", "you feel."] },
  { id: "C10-Rebuild", seq: "c10", frames: 300, label: "REBUILD", title: ["BACK", "TOGETHER."], sub: "Eleven layers, back in one piece.", detail: ["Modelled in Blender.", "Rendered in 3D."], close: ["Headphone (1) Pro.", "3D study 01."], tag: "JONATHAN ROCHA", cut: 209 },
];
