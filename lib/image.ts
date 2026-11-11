export const MIME: Record<string, string> = { JPG: "image/jpeg", PNG: "image/png", WebP: "image/webp" };
export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const fmt = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : Math.round(b / 1024) + " KB");

export const loadImage = (f: File | Blob) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read image"));
    i.src = url;
  });

/** Stretches levels (1%–99%) for better light and contrast. Local processing, no AI. */
export function enhance(c: HTMLCanvasElement) {
  const x = c.getContext("2d")!;
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data, h = new Uint32Array(256), n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) h[(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) | 0]++;
  let s = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { s += h[i]; if (s > n * 0.01) { lo = i; break; } }
  s = 0;
  for (let i = 255; i >= 0; i--) { s += h[i]; if (s > n * 0.01) { hi = i; break; } }
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < p.length; i += 4)
    for (let j = 0; j < 3; j++) p[i + j] = Math.max(0, Math.min(255, (p[i + j] - lo) * k));
  x.putImageData(d, 0, 0);
}

/** Flood-fills from the top/left/right edges and turns similar-coloured background white. Best on plain walls. */
export function whiten(c: HTMLCanvasElement, tol: number) {
  const W = c.width, H = c.height, x = c.getContext("2d")!;
  const d = x.getImageData(0, 0, W, H), p = d.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < W; i += 3) { const o = i * 4; r += p[o]; g += p[o + 1]; b += p[o + 2]; n++; }
  r /= n; g /= n; b /= n;
  const T = tol * tol * 3, seen = new Uint8Array(W * H), st: number[] = [];
  const push = (i: number) => {
    if (seen[i]) return;
    const o = i * 4, a = p[o] - r, e = p[o + 1] - g, f = p[o + 2] - b;
    if (a * a + e * e + f * f <= T) { seen[i] = 1; st.push(i); }
  };
  for (let i = 0; i < W; i++) push(i);
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  while (st.length) {
    const i = st.pop()!, cx = i % W, cy = (i / W) | 0;
    if (cx > 0) push(i - 1);
    if (cx < W - 1) push(i + 1);
    if (cy > 0) push(i - W);
    if (cy < H - 1) push(i + W);
  }
  for (let i = 0; i < W * H; i++) if (seen[i]) { const o = i * 4; p[o] = p[o + 1] = p[o + 2] = 255; }
  x.putImageData(d, 0, 0);
}

/** Re-encode an image. If targetKB > 0 it searches for the best quality under that size. */
export async function encode(i: HTMLImageElement, type: string, q: number, maxDim: number, targetKB: number) {
  let w = i.naturalWidth, h = i.naturalHeight;
  if (maxDim > 0 && Math.max(w, h) > maxDim) {
    const k = maxDim / Math.max(w, h);
    w = Math.round(w * k); h = Math.round(h * k);
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  if (type !== "image/png") { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
  x.drawImage(i, 0, 0, w, h);
  const tb = (v?: number) =>
    new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), type, v));
  if (targetKB > 0 && type !== "image/png") {
    let lo = 0.05, hi = 0.95, best = await tb(lo);
    for (let n = 0; n < 7; n++) {
      const m = (lo + hi) / 2, b = await tb(m);
      if (b.size <= targetKB * 1024) { best = b; lo = m; } else hi = m;
    }
    return best;
  }
  return tb(q / 100);
}
