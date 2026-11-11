import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/presets";

export const metadata: Metadata = {
  title: `${SITE_NAME} – Passport photo maker, compressor & converter`,
  description: "Crop a photo, tile it on A4 or any paper size as passport photos, export a print-ready PDF. Compress and batch-convert images. Free, private, runs in your browser.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
