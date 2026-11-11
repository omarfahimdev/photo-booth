"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAPERS, PHOTOS } from "@/lib/presets";
import { enhance, loadImage, whiten } from "@/lib/image";
import { layout, pos, renderSheet, type Orient } from "@/lib/sheet";
import { saveBlob } from "@/lib/download";

type Rect = { x: number; y: number; w: number; h: number };
type Drag = { o: [number, number] } | { dx: number; dy: number } | null;
const n = (v: string) => parseFloat(v) || 0;

export default function PassportSheet() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  // photo options
  const [ps, setPs] = useState(Object.keys(PHOTOS)[0]);
  const [pw, setPw] = useState("43.2");
  const [ph, setPh] = useState("53.3");
  const [enh, setEnh] = useState(false);
  const [wh, setWh] = useState(false);
  const [tol, setTol] = useState(40);
  // sheet options
  const [pp, setPp] = useState(Object.keys(PAPERS)[0]);
  const [cw, setCw] = useState("210");
  const [ch, setCh] = useState("297");
  const [orient, setOrient] = useState<Orient>("a");
  const [margin, setMargin] = useState("8");
  const [gap, setGap] = useState("2");
  const [bw, setBw] = useState("0.2");
  const [copies, setCopies] = useState("0");

  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLCanvasElement>(null);
  const crop = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const scale = useRef(1);
  const drag = useRef<Drag>(null);

  const photoSize: [number, number] = ps === "Custom" ? [Math.max(5, n(pw)), Math.max(5, n(ph))] : PHOTOS[ps];
  const paperSize: [number, number] = pp === "Custom" ? [Math.max(30, n(cw)), Math.max(30, n(ch))] : PAPERS[pp];
  const R = photoSize[0] / photoSize[1];
  const L = layout({ paper: paperSize, photo: photoSize, margin: n(margin), gap: n(gap), orient, copies: n(copies) });

  const draw = useCallback(() => {
    const c = cv.current, C = crop.current;
    if (!c || !img) return;
    const x = c.getContext("2d")!, w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    x.drawImage(img, 0, 0, w, h);
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
  }, [img]);

  const corners = (): [number, number][] => {
    const C = crop.current;
    return [[C.x, C.y], [C.x + C.w, C.y], [C.x, C.y + C.h], [C.x + C.w, C.y + C.h]];
  };

  const initCrop = useCallback(() => {
    const c = cv.current, wr = wrap.current;
    if (!img || !c || !wr) return;
    const ww = wr.clientWidth - 16 || 600;
    const s = Math.min(ww / img.naturalWidth, 460 / img.naturalHeight, 1);
    scale.current = s;
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    let w = c.width, h = w / R;
    if (h > c.height) { h = c.height; w = h * R; }
    w *= 0.9; h *= 0.9;
    crop.current = { x: (c.width - w) / 2, y: (c.height - h) / 2, w, h };
    draw();
  }, [img, R, draw]);

  useEffect(() => { initCrop(); }, [initCrop]);

  useEffect(() => {
    if (step === 2 && photo && sheet.current) renderSheet(L, 2.6, sheet.current, photo, n(bw));
  });

  const pt = (e: React.PointerEvent): [number, number] => {
    const c = cv.current!, r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img) return;
    const [p, q] = pt(e), C = crop.current, cs = corners();
    const k = cs.findIndex(([a, b]) => Math.hypot(a - p, b - q) < 24);
    if (k >= 0) drag.current = { o: cs[3 - k] };
    else if (p > C.x && p < C.x + C.w && q > C.y && q < C.y + C.h) drag.current = { dx: p - C.x, dy: q - C.y };
    else return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current, c = cv.current;
    if (!d || !c) return;
    const [p, q] = pt(e), W = c.width, H = c.height, C = crop.current;
    if ("o" in d) {
      const [ox, oy] = d.o, sx = p >= ox ? 1 : -1, sy = q >= oy ? 1 : -1;
      let w = Math.abs(p - ox), h = Math.abs(q - oy);
      if (w / Math.max(h, 1e-6) > R) w = h * R; else h = w / R;
      const mw = sx > 0 ? W - ox : ox, mh = sy > 0 ? H - oy : oy;
      if (w > mw) { w = mw; h = w / R; }
      if (h > mh) { h = mh; w = h * R; }
      if (w < 30) { w = 30; h = w / R; }
      crop.current = { x: sx > 0 ? ox : ox - w, y: sy > 0 ? oy : oy - h, w, h };
    } else {
      C.x = Math.min(Math.max(0, p - d.dx), W - C.w);
      C.y = Math.min(Math.max(0, q - d.dy), H - C.h);
    }
    draw();
  };

  const pick = async (f?: File) => {
    if (!f) return;
    try { setImg(await loadImage(f)); setStep(1); } catch { alert("Couldn’t read that image"); }
  };

  const makePhoto = () => {
    if (!img) return null;
    const C = crop.current, s = scale.current, [mw, mh] = photoSize;
    const sx = C.x / s, sy = C.y / s, sw = C.w / s, sh = C.h / s;
    const k = Math.min(1, ((mw / 25.4) * 600) / sw, ((mh / 25.4) * 600) / sh); // cap at 600 dpi
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (enh) enhance(c);
    if (wh) whiten(c, tol);
    return c;
  };

  const next = () => {
    setBusy(true);
    setTimeout(() => { setPhoto(makePhoto()); setStep(2); setBusy(false); }, 30);
  };

  const downloadPdf = async () => {
    if (!photo) return;
    const { jsPDF } = await import("jspdf");
    const b = n(bw);
    const doc = new jsPDF({ orientation: L.W > L.H ? "l" : "p", unit: "mm", format: [Math.min(L.W, L.H), Math.max(L.W, L.H)] });
    const data = photo.toDataURL("image/jpeg", 0.95);
    doc.setLineWidth(b || 0.1); doc.setDrawColor(0);
    for (let i = 0; i < L.cnt; i++) {
      const [a, y] = pos(L, i);
      doc.addImage(data, "JPEG", a, y, L.pw, L.ph, "photo");
      if (b > 0) doc.rect(a, y, L.pw, L.ph);
    }
    saveBlob(`passport-photos-${L.W}x${L.H}mm.pdf`, doc.output("blob"));
  };

  const downloadJpg = () => {
    if (!photo) return;
    const c = document.createElement("canvas");
    renderSheet(L, 300 / 25.4, c, photo, n(bw));
    c.toBlob((b) => b && saveBlob("passport-photos-300dpi.jpg", b), "image/jpeg", 0.95);
  };

  return (
    <>
      <div className="steps">
        <span className={step === 1 ? "on" : ""}>1 · Upload &amp; crop</span>
        <span className={step === 2 ? "on" : ""}>2 · Layout &amp; download</span>
      </div>

      <div className={step === 1 ? "card" : "card hid"}>
        {!img && (
          <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <b>Drop your photo here</b>
            <span>or tap to choose · everything stays on your device</span>
          </label>
        )}
        <div className={img ? "" : "hid"}>
          <div className="grid">
            <label>Photo size
              <select value={ps} onChange={(e) => setPs(e.target.value)}>
                {[...Object.keys(PHOTOS), "Custom"].map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            {ps === "Custom" && (
              <>
                <label>Width (mm)<input type="number" step="0.1" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
                <label>Height (mm)<input type="number" step="0.1" value={ph} onChange={(e) => setPh(e.target.value)} /></label>
              </>
            )}
            <label className="chk"><input type="checkbox" checked={enh} onChange={(e) => setEnh(e.target.checked)} /> Auto-enhance light &amp; contrast</label>
            <label className="chk"><input type="checkbox" checked={wh} onChange={(e) => setWh(e.target.checked)} /> Clean to white background</label>
            <label>Background tolerance<input type="range" min={10} max={90} value={tol} onChange={(e) => setTol(+e.target.value)} /></label>
          </div>
          <p className="mu">Drag the square corner handles to crop. Drag inside the box to move it. The ratio matches your photo size.</p>
          <div id="cvWrap" ref={wrap}>
            <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)} />
          </div>
          <div className="row">
            <label className="btn">Choose another<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
            <button onClick={initCrop}>Reset crop</button>
            <button className="pri" onClick={next} disabled={busy}>{busy ? "Processing…" : "Next →"}</button>
          </div>
        </div>
      </div>

      <div className={step === 2 ? "card" : "card hid"}>
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
          <label>Copies (0 = fill page)<input type="number" min={0} value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
        </div>
        <p className="mu">
          {L.cnt
            ? `${L.cnt} photos (${L.c} × ${L.r} grid) on ${L.W} × ${L.H} mm paper · photo ${L.pw} × ${L.ph} mm`
            : "The photo doesn’t fit on this paper — reduce the margin or choose a bigger paper."}
        </p>
        <div id="shw"><canvas id="sh" ref={sheet} /></div>
        <div className="row">
          <button onClick={() => setStep(1)}>← Back</button>
          <button className="pri" disabled={!L.cnt} onClick={downloadPdf}>Download PDF</button>
          <button disabled={!L.cnt} onClick={downloadJpg}>Download JPG (300 dpi)</button>
        </div>
      </div>
    </>
  );
}
