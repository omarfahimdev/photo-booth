import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/presets";

export const metadata: Metadata = {
  title: `${SITE_NAME} – Photo sheet maker, compressor & converter`,
  description: "Add multiple photos, set a quantity for each, and tile them onto print-ready sheets with a multi-page PDF. Compress and batch-convert images. Free, private, runs in your browser.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
