"use client";
import { useEffect, useState } from "react";
import PassportSheet from "@/components/PassportSheet";
import BatchTool from "@/components/BatchTool";
import { SITE_NAME, THEMES } from "@/lib/presets";

const TABS = [["sheet", "Passport sheet"], ["comp", "Compress"], ["conv", "Convert"]] as const;

export default function Home() {
  const [tab, setTab] = useState<string>("sheet");
  const [theme, setTheme] = useState<string>("auto");

  useEffect(() => {
    try { const v = localStorage.getItem("theme"); if (v && (THEMES as readonly string[]).includes(v)) setTheme(v); } catch {}
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  return (
    <>
      <header>
        <div className="logo"><i>▣</i> {SITE_NAME}</div>
        <nav>
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: "auto" }}>
          {THEMES.map((t) => <option key={t} value={t}>{t === "auto" ? "Theme: Auto" : t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
      </header>
      <main>
        <section className={tab === "sheet" ? "" : "hid"}><PassportSheet /></section>
        <section className={tab === "comp" ? "" : "hid"}>
          <BatchTool title="Compress images" sub="Shrink photos for forms and uploads. Set a quality or a target size and it finds the best fit." formats={["JPG", "WebP"]} compress button="Compress" zipName="compressed" />
        </section>
        <section className={tab === "conv" ? "" : "hid"}>
          <BatchTool title="Batch convert" sub="Change the file format of many images at once. Transparent areas become white for JPG." formats={["JPG", "PNG", "WebP"]} button="Convert" zipName="converted" />
        </section>
      </main>
    </>
  );
}
