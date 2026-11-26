// Marca do case: as mesmas cores e fontes do site.
import { loadFont as loadDoto } from "@remotion/google-fonts/Doto";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { Easing } from "remotion";

export const dot = loadDoto("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily;
export const sans = loadGeist("normal", { weights: ["300", "400", "500"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

export const C = { black: "#000", white: "#fff", grey: "#c9c9c9", red: "#d71921" };
export const out = Easing.bezier(0.22, 1, 0.36, 1);   // a mesma curva de saída do site
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
