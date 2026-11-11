export const SITE_NAME = "PhotoBooth"; // change the brand name here

export const PAPERS: Record<string, [number, number]> = {
  "A4 (210×297 mm)": [210, 297],
  A5: [148, 210],
  A3: [297, 420],
  Letter: [215.9, 279.4],
  "4×6 in": [101.6, 152.4],
  "5×7 in": [127, 177.8],
  "6×8 in": [152.4, 203.2],
};

export const PHOTOS: Record<string, [number, number]> = {
  "Passport 1.7×2.1 in (43.2×53.3 mm)": [43.2, 53.3],
  "35×45 mm (UK/EU/AU)": [35, 45],
  "2×2 in (US visa)": [50.8, 50.8],
  "40×50 mm": [40, 50],
  "33×48 mm": [33, 48],
  "25×35 mm (stamp)": [25, 35],
};

export const THEMES = [
  "auto",
  "light",
  "dark",
  "midnight",
  "ocean",
  "forest",
  "sunset",
] as const;
