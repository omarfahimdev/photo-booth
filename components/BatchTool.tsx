"use client";
import { useState } from "react";
import { encode, EXT, fmt, loadImage, MIME } from "@/lib/image";
import { saveBlob } from "@/lib/download";

type Out = { name: string; blob: Blob; before: number };
type Props = { title: string; sub: string; formats: string[]; compress?: boolean; button: string; zipName: string };

export default function BatchTool({ title, sub, formats, compress, button, zipName }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [out, setOut] = useState<Out[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [fm, setFm] = useState(formats[0]);
  const [q, setQ] = useState(80);
  const [tg, setTg] = useState("0");
  const [mx, setMx] = useState("0");
  const [busy, setBusy] = useState<string | null>(null);
  const [hv, setHv] = useState(false);

  const pick = (l: FileList | null) => {
    setFiles(Array.from(l ?? []).filter((f) => f.type.startsWith("image/")));
    setOut([]); setFailed([]);
  };

  const run = async () => {
    const res: Out[] = [], bad: string[] = [], used = new Set<string>();
    setOut([]); setFailed([]);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`Working… ${i + 1}/${files.length}`);
      try {
        const im = await loadImage(f);
        const blob = await encode(im, MIME[fm], q, Number(mx) || 0, Number(tg) || 0);
        const base = f.name.replace(/\.[^.]+$/, "");
        let nm = base, k = 1;
        while (used.has(nm)) nm = `${base}-${++k}`;
        used.add(nm);
        res.push({ name: `${nm}.${EXT[blob.type] ?? "img"}`, blob, before: f.size });
      } catch { bad.push(f.name); }
      setOut([...res]); setFailed([...bad]);
    }
    setBusy(null);
  };

  const download = async () => {
    if (out.length === 1) return saveBlob(out[0].name, out[0].blob);
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    out.forEach((r) => z.file(r.name, r.blob));
    saveBlob(`${zipName}-images.zip`, await z.generateAsync({ type: "blob" }));
  };

  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="mu">{sub}</p>
      <label
        className={"drop" + (hv ? " hv" : "")}
        onDragOver={(e) => { e.preventDefault(); setHv(true); }}
        onDragLeave={() => setHv(false)}
        onDrop={(e) => { e.preventDefault(); setHv(false); pick(e.dataTransfer.files); }}
      >
        <input type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        <b>Drop images here</b>
        <span>or tap to choose · select as many as you like</span>
      </label>
      <div className="grid">
        <label>Output format
          <select value={fm} onChange={(e) => setFm(e.target.value)}>{formats.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
        <label>Quality: {q}%
          <input type="range" min={10} max={100} value={q} onChange={(e) => setQ(+e.target.value)} />
        </label>
        {compress && (
          <>
            <label>Target size per image (KB, 0 = off)
              <input type="number" min={0} value={tg} onChange={(e) => setTg(e.target.value)} />
            </label>
            <label>Max width/height (px, 0 = original)
              <input type="number" min={0} value={mx} onChange={(e) => setMx(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {files.length > 0 && <p className="mu">{files.length} image(s) ready</p>}
      <div className="row">
        <button className="pri" disabled={!files.length || !!busy} onClick={run}>{busy ?? button}</button>
        <button disabled={!out.length || !!busy} onClick={download}>{out.length > 1 ? "Download all (.zip)" : "Download"}</button>
      </div>
      <div className="res">
        {out.map((r) => {
          const pc = Math.round((r.blob.size / r.before - 1) * 100);
          return (
            <div key={r.name}>
              <span>{r.name} · {fmt(r.before)} → {fmt(r.blob.size)}</span>
              <span>{pc > 0 ? "+" : ""}{pc}%</span>
            </div>
          );
        })}
        {failed.map((n) => <div key={n}><span>{n}</span><span>failed</span></div>)}
      </div>
    </div>
  );
}
