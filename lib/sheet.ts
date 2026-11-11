export type Orient = "a" | "p" | "l";
export type SheetOpts = { paper: [number, number]; photo: [number, number]; margin: number; gap: number; orient: Orient; copies: number };
export type Layout = { W: number; H: number; c: number; r: number; pw: number; ph: number; g: number; cnt: number; ox: number; oy: number };

export function layout(o: SheetOpts): Layout {
  const [W0, H0] = o.paper, [pw, ph] = o.photo, m = o.margin, g = o.gap;
  const fit = (W: number, H: number) => ({
    W, H,
    c: Math.max(0, Math.floor((W - 2 * m + g + 1e-6) / (pw + g))),
    r: Math.max(0, Math.floor((H - 2 * m + g + 1e-6) / (ph + g))),
  });
  const a = fit(Math.min(W0, H0), Math.max(W0, H0)), b = fit(Math.max(W0, H0), Math.min(W0, H0));
  const L = o.orient === "p" ? a : o.orient === "l" ? b : b.c * b.r > a.c * a.r ? b : a;
  const tot = L.c * L.r, cp = Math.floor(o.copies);
  const cnt = cp > 0 ? Math.min(cp, tot) : tot;
  return { ...L, pw, ph, g, cnt, ox: (L.W - (L.c * pw + (L.c - 1) * g)) / 2, oy: (L.H - (L.r * ph + (L.r - 1) * g)) / 2 };
}

export const pos = (L: Layout, i: number): [number, number] => [
  L.ox + (i % L.c) * (L.pw + L.g),
  L.oy + Math.floor(i / L.c) * (L.ph + L.g),
];

/** Draw the sheet at k pixels per mm. */
export function renderSheet(L: Layout, k: number, c: HTMLCanvasElement, photo: HTMLCanvasElement, bw: number) {
  c.width = Math.round(L.W * k);
  c.height = Math.round(L.H * k);
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = "high";
  for (let i = 0; i < L.cnt; i++) {
    const [a, b] = pos(L, i);
    x.drawImage(photo, a * k, b * k, L.pw * k, L.ph * k);
    if (bw > 0) { x.strokeStyle = "#000"; x.lineWidth = bw * k; x.strokeRect(a * k, b * k, L.pw * k, L.ph * k); }
  }
}
