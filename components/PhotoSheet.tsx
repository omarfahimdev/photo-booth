"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PAPERS, PHOTOS } from "@/lib/presets";
import { enhance, loadImage, whiten } from "@/lib/image";
import { layout, paginate, pos, renderSheet, type Orient, type SheetItem } from "@/lib/sheet";
import { saveBlob } from "@/lib/download";

type Crop = { x: number; y: number; w: number; h: number }; // fractions of the source image
type Rect = { x: number; y: number; w: number; h: number }; // pixels of the crop canvas
type Drag = { o: [number, number] } | { dx: number; dy: number } | null;
type Entry = {
  id: string;
  name: string;
  img: HTMLImageElement;
  crop: Crop;
  quantity: string;
  enh: boolean;
  wh: boolean;
  tol: number;
};
type Done = { key: string; canvas: HTMLCanvasElement; thumb: string };

const n = (v: string) => parseFloat(v) || 0;
const uid = () => Math.random().toString(36).slice(2, 10);
const qty = (v: string) => Math.max(0, Math.floor(n(v)));
const sizeOf = (ps: string, pw: string, ph: string): [number, number] =>
  ps === "Custom" ? [Math.max(5, n(pw)), Math.max(5, n(ph))] : PHOTOS[ps];

const defaultCrop = (img: HTMLImageElement, R: number): Crop => {
  const W = img.naturalWidth, H = img.naturalHeight;
  let w = W, h = w / R;
  if (h > H) { h = H; w = h * R; }
  w *= 0.9; h *= 0.9;
  return { x: (W - w) / 2 / W, y: (H - h) / 2 / H, w: w / W, h: h / H };
};
const toRect = (c: Crop, W: number, H: number): Rect => ({ x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H });
const toCrop = (r: Rect, W: number, H: number): Crop => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H });

export default function PhotoSheet() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, Done>>({});
  const [busy, setBusy] = useState(false);
  const [cropVersion, setCropVersion] = useState(0);
  // shared photo size
  const [ps, setPs] = useState(Object.keys(PHOTOS)[0]);
  const [pw, setPw] = useState("43.2");
  const [ph, setPh] = useState("53.3");
  // sheet options
  const [pp, setPp] = useState(Object.keys(PAPERS)[0]);
  const [cw, setCw] = useState("210");
  const [ch, setCh] = useState("297");
  const [orient, setOrient] = useState<Orient>("a");
  const [margin, setMargin] = useState("8");
  const [gap, setGap] = useState("2");
  const [bw, setBw] = useState("0.2");
  const [page, setPage] = useState(0);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const photoSize = useMemo(() => sizeOf(ps, pw, ph), [ps, pw, ph]);
  const paperSize = useMemo<[number, number]>(() => pp === "Custom" ? [Math.max(30, n(cw)), Math.max(30, n(ch))] : PAPERS[pp], [pp, cw, ch]);
  const R = photoSize[0] / photoSize[1];
  const L = useMemo(() => layout({ paper: paperSize, photo: photoSize, margin: n(margin), gap: n(gap), orient }), [paperSize, photoSize, margin, gap, orient]);

  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLCanvasElement>(null);
  const cropRef = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<Drag>(null);
  const cache = useRef<Record<string, Done>>({});

  const draw = useCallback(() => {
    const c = cv.current, C = cropRef.current;
    if (!c || !selected) return;
    const x = c.getContext("2d")!, w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    x.drawImage(selected.img, 0, 0, w, h);
    x.fillStyle = "rgba(0,0,0,.55)";
    x.fillRect(0, 0, w, C.y); x.fillRect(0, C.y + C.h, w, h - C.y - C.h);
    x.fillRect(0, C.y, C.x, C.h); x.fillRect(C.x + C.w, C.y, w - C.x - C.w, C.h);
    x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(C.x, C.y, C.w, C.h);
    x.lineWidth = 1; x.globalAlpha = 0.45;
    for (let i = 1; i < 3; i++) {
      x.beginPath();
      x.moveTo(C.x + (C.w * i) / 3, C.y); x.lineTo(C.x + (C.w * i) / 3, C.y + C.h);
      x.moveTo(C.x, C.y + (C.h * i) / 3); x.lineTo(C.x + C.w, C.y + (C.h * i) / 3);
      x.stroke();
    }
    x.globalAlpha = 1; x.fillStyle = "#fff"; x.strokeStyle = "#4f46e5"; x.lineWidth = 2;
    corners().forEach(([a, b]) => { x.fillRect(a - 8, b - 8, 16, 16); x.strokeRect(a - 8, b - 8, 16, 16); });
  }, [selected]);

  const corners = (): [number, number][] => {
    const C = cropRef.current;
    return [[C.x, C.y], [C.x + C.w, C.y], [C.x, C.y + C.h], [C.x + C.w, C.y + C.h]];
  };

  useEffect(() => {
    const c = cv.current, wr = wrap.current;
    if (!selected || !c || !wr) return;
    const ww = wr.clientWidth - 16 || 600;
    const s = Math.min(ww / selected.img.naturalWidth, 460 / selected.img.naturalHeight, 1);
    c.width = Math.round(selected.img.naturalWidth * s);
    c.height = Math.round(selected.img.naturalHeight * s);
    cropRef.current = toRect(selected.crop, c.width, c.height);
    drag.current = null;
    draw();
  }, [selectedId, cropVersion, draw]);

  const makePhoto = (e: Entry, size: [number, number]): HTMLCanvasElement => {
    const W = e.img.naturalWidth, H = e.img.naturalHeight;
    const sx = e.crop.x * W, sy = e.crop.y * H;
    const sw = Math.max(1, e.crop.w * W), sh = Math.max(1, e.crop.h * H);
    const k = Math.min(1, ((size[0] / 25.4) * 600) / sw, ((size[1] / 25.4) * 600) / sh); // cap at 600 dpi
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(e.img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (e.enh) enhance(c);
    if (e.wh) whiten(c, e.tol);
    return c;
  };

  useEffect(() => {
    const next: Record<string, Done> = {};
    for (const e of entries) {
      const key = JSON.stringify([e.crop, e.enh, e.wh, e.tol, photoSize]);
      const hit = cache.current[e.id];
      if (hit && hit.key === key) { next[e.id] = hit; continue; }
      const canvas = makePhoto(e, photoSize);
      const t = document.createElement("canvas");
      t.width = 80; t.height = 100;
      const tx = t.getContext("2d")!;
      tx.imageSmoothingQuality = "high";
      tx.drawImage(canvas, 0, 0, t.width, t.height);
      const item: Done = { key, canvas, thumb: t.toDataURL("image/jpeg", 0.8) };
      cache.current[e.id] = item;
      next[e.id] = item;
    }
    for (const id of Object.keys(cache.current)) if (!next[id]) delete cache.current[id];
    setDone(next);
  }, [entries, photoSize]);

  const update = (id: string, patch: Partial<Entry>) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addPhotos = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setBusy(true);
    const added: Entry[] = [];
    for (const f of files) {
      try {
        const img = await loadImage(f);
        added.push({ id: uid(), name: f.name, img, crop: defaultCrop(img, R), quantity: "1", enh: false, wh: false, tol: 40 });
      } catch { /* skip unreadable images */ }
    }
    if (added.length) {
      setEntries((prev) => [...prev, ...added]);
      setSelectedId(added[0].id);
      setCropVersion((v) => v + 1);
    } else alert("Couldn’t read those images");
    setBusy(false);
  };

  const remove = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    if (id === selectedId) setSelectedId(next[0]?.id ?? null);
    setCropVersion((v) => v + 1);
  };

  const changeSize = (nextPs: string, nextPw: string, nextPh: string) => {
    const [w, h] = sizeOf(nextPs, nextPw, nextPh);
    setEntries((prev) => prev.map((e) => ({ ...e, crop: defaultCrop(e.img, w / h) })));
    setCropVersion((v) => v + 1);
  };

  const pt = (e: React.PointerEvent): [number, number] => {
    const c = cv.current!, r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selected) return;
    const [p, q] = pt(e), C = cropRef.current, cs = corners();
    const k = cs.findIndex(([a, b]) => Math.hypot(a - p, b - q) < 24);
    if (k >= 0) drag.current = { o: cs[3 - k] };
    else if (p > C.x && p < C.x + C.w && q > C.y && q < C.y + C.h) drag.current = { dx: p - C.x, dy: q - C.y };
    else return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current, c = cv.current;
    if (!d || !c) return;
    const [p, r] = pt(e), W = c.width, H = c.height, C = cropRef.current;
    if ("o" in d) {
      const [ox, oy] = d.o, sx = p >= ox ? 1 : -1, sy = r >= oy ? 1 : -1;
      let w = Math.abs(p - ox), h = Math.abs(r - oy);
      if (w / Math.max(h, 1e-6) > R) w = h * R; else h = w / R;
      const mw = sx > 0 ? W - ox : ox, mh = sy > 0 ? H - oy : oy;
      if (w > mw) { w = mw; h = w / R; }
      if (h > mh) { h = mh; w = h * R; }
      if (w < 30) { w = 30; h = w / R; }
      cropRef.current = { x: sx > 0 ? ox : ox - w, y: sy > 0 ? oy : oy - h, w, h };
    } else {
      C.x = Math.min(Math.max(0, p - d.dx), W - C.w);
      C.y = Math.min(Math.max(0, r - d.dy), H - C.h);
    }
    draw();
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && selected && cv.current) update(selected.id, { crop: toCrop(cropRef.current, cv.current.width, cv.current.height) });
  };

  const requested = entries.reduce((s, e) => s + qty(e.quantity), 0);
  const sheets = useMemo(() => {
    const items: SheetItem[] = [];
    for (const e of entries) {
      const canvas = done[e.id]?.canvas;
      if (!canvas) continue;
      for (let i = 0, q = qty(e.quantity); i < q; i++) items.push({ id: e.id, canvas });
    }
    return paginate(items, L.cnt);
  }, [entries, done, L.cnt]);
  const current = Math.min(page, Math.max(0, sheets.length - 1));

  useEffect(() => {
    if (sheet.current) renderSheet(L, 2.6, sheet.current, sheets[current] ?? [], n(bw));
  });

  const downloadPdf = async () => {
    if (!sheets.length) return;
    const { jsPDF } = await import("jspdf");
    const b = n(bw), landscape = L.W > L.H;
    const format: [number, number] = [Math.min(L.W, L.H), Math.max(L.W, L.H)];
    const doc = new jsPDF({ orientation: landscape ? "l" : "p", unit: "mm", format });
    const data = new Map<string, string>();
    for (const e of entries) {
      const c = done[e.id]?.canvas;
      if (c) data.set(e.id, c.toDataURL("image/jpeg", 0.95));
    }
    doc.setLineWidth(b || 0.1); doc.setDrawColor(0);
    sheets.forEach((items, pi) => {
      if (pi > 0) doc.addPage(format, landscape ? "l" : "p");
      items.forEach((item, i) => {
        const [a, y] = pos(L, i);
        doc.addImage(data.get(item.id)!, "JPEG", a, y, L.pw, L.ph, `photo-${item.id}`);
        if (b > 0) doc.rect(a, y, L.pw, L.ph);
      });
    });
    saveBlob(`photo-sheet-${L.W}x${L.H}mm.pdf`, doc.output("blob"));
  };

  const downloadJpg = () => {
    const items = sheets[current];
    if (!items?.length) return;
    const c = document.createElement("canvas");
    renderSheet(L, 300 / 25.4, c, items, n(bw));
    const name = sheets.length > 1 ? `photo-sheet-300dpi-sheet-${current + 1}.jpg` : "photo-sheet-300dpi.jpg";
    c.toBlob((b) => b && saveBlob(name, b), "image/jpeg", 0.95);
  };

  return (
    <>
      <div className="card">
        <h2>Photos</h2>
        <p className="mu">Add as many photos as you want. Pick a photo to crop it, then set how many copies of it go on the sheet. Everything stays on your device.</p>
        <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}>
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          <b>{busy ? "Adding photos…" : entries.length ? "Add more photos" : "Drop your photos here"}</b>
          <span>or tap to choose · select as many as you like</span>
        </label>

        {entries.length > 0 && (
          <>
            <div className="photos">
              {entries.map((e) => (
                <div key={e.id} className={"photo-item" + (e.id === selectedId ? " on" : "")} onClick={() => setSelectedId(e.id)}>
                  <img src={done[e.id]?.thumb} alt="" />
                  <div className="pi-body">
                    <span className="pi-name" title={e.name}>{e.name}</span>
                    <label className="pi-qty">Quantity
                      <input type="number" min={0} value={e.quantity} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => update(e.id, { quantity: ev.target.value })} />
                    </label>
                  </div>
                  <button type="button" className="pi-del" title="Remove photo" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>×</button>
                </div>
              ))}
            </div>

            <div className="grid">
              <label>Photo size
                <select value={ps} onChange={(e) => { setPs(e.target.value); changeSize(e.target.value, pw, ph); }}>
                  {[...Object.keys(PHOTOS), "Custom"].map((k) => <option key={k}>{k}</option>)}
                </select>
              </label>
              {ps === "Custom" && (
                <>
                  <label>Width (mm)<input type="number" step="0.1" value={pw} onChange={(e) => { setPw(e.target.value); changeSize(ps, e.target.value, ph); }} /></label>
                  <label>Height (mm)<input type="number" step="0.1" value={ph} onChange={(e) => { setPh(e.target.value); changeSize(ps, pw, e.target.value); }} /></label>
                </>
              )}
              <label className="chk"><input type="checkbox" disabled={!selected} checked={!!selected?.enh} onChange={(e) => selected && update(selected.id, { enh: e.target.checked })} /> Auto-enhance light &amp; contrast</label>
              <label className="chk"><input type="checkbox" disabled={!selected} checked={!!selected?.wh} onChange={(e) => selected && update(selected.id, { wh: e.target.checked })} /> Clean to white background</label>
              <label>Background tolerance<input type="range" min={10} max={90} disabled={!selected} value={selected?.tol ?? 40} onChange={(e) => selected && update(selected.id, { tol: +e.target.value })} /></label>
            </div>
            <p className="mu">Editing: <b>{selected?.name ?? "—"}</b> · Drag the corner handles to crop, or drag inside the box to move it. The ratio matches your photo size.</p>
            <div id="cvWrap" ref={wrap}>
              <canvas id="cv" ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            </div>
            <div className="row">
              <button disabled={!selected} onClick={() => selected && update(selected.id, { crop: defaultCrop(selected.img, R) })}>Reset crop</button>
              <button disabled={!selected} onClick={() => selected && remove(selected.id)}>Remove selected photo</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Sheet layout</h2>
        <p className="mu">Each photo keeps its own quantity. Extra copies flow onto the next sheet automatically.</p>
        <div className="grid">
          <label>Paper size
            <select value={pp} onChange={(e) => setPp(e.target.value)}>
              {[...Object.keys(PAPERS), "Custom"].map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          {pp === "Custom" && (
            <>
              <label>Paper width (mm)<input type="number" value={cw} onChange={(e) => setCw(e.target.value)} /></label>
              <label>Paper height (mm)<input type="number" value={ch} onChange={(e) => setCh(e.target.value)} /></label>
            </>
          )}
          <label>Orientation
            <select value={orient} onChange={(e) => setOrient(e.target.value as Orient)}>
              <option value="a">Auto (fit most)</option><option value="p">Portrait</option><option value="l">Landscape</option>
            </select>
          </label>
          <label>Page margin (mm)<input type="number" min={0} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} /></label>
          <label>Gap between photos (mm)<input type="number" min={0} step={0.5} value={gap} onChange={(e) => setGap(e.target.value)} /></label>
          <label>Border width (mm, 0 = none)<input type="number" min={0} step={0.1} value={bw} onChange={(e) => setBw(e.target.value)} /></label>
        </div>
        <p className="mu">
          {!entries.length
            ? "Add a photo above to start building your sheet."
            : !L.cnt
              ? "The photo doesn’t fit on this paper — reduce the margin or choose a bigger paper."
              : !requested
                ? "Set a quantity above to build your sheet."
                : `${requested} photo${requested === 1 ? "" : "s"} requested · ${L.cnt} per sheet (${L.c} × ${L.r} grid) · ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} on ${L.W} × ${L.H} mm paper · photo ${L.pw} × ${L.ph} mm`}
        </p>
        <div id="shw"><canvas id="sh" ref={sheet} /></div>
        <div className="row sheet-nav">
          {sheets.length > 1 && (
            <>
              <button disabled={current === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Previous sheet</button>
              <span className="sheet-count">Sheet {current + 1} of {sheets.length}</span>
              <button disabled={current >= sheets.length - 1} onClick={() => setPage((p) => Math.min(sheets.length - 1, p + 1))}>Next sheet →</button>
            </>
          )}
          <button className="pri" disabled={!sheets.length} onClick={downloadPdf}>Download PDF{sheets.length > 1 ? ` (${sheets.length} pages)` : ""}</button>
          <button disabled={!sheets.length} onClick={downloadJpg}>Download JPG (current sheet)</button>
        </div>
      </div>
    </>
  );
}
