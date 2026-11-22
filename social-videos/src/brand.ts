import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";

// Anacan "Deck & Social" system (brand guidelines, section 09).
export const headlineFont = loadInterTight("normal", {
  weights: ["700", "800"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const textFont = loadInter("normal", {
  weights: ["500", "600"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const color = {
  mercan: "#F5404E",
  krem: "#FFF8F3",
  seftali: "#FCDAB0",
  alliq: "#FCE1DA",
  pembe: "#FBD0DF",
  kum: "#FBEAE0",
  cizgi: "#F0DED3",
  murekkep: "#262220",
  kahveGri: "#6B5E57",
  beyaz: "#FFFFFF",
} as const;

// Motion principles: gentle ease and soft spring.
export const gentleEase = [0.22, 1, 0.36, 1] as const;
export const softSpring = { damping: 18, stiffness: 240 } as const;
