# PhotoBooth (Next.js)

Passport photo sheet maker + image compressor + batch converter. Runs fully in the browser; no uploads, no backend.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

- Rename the brand: `SITE_NAME` in `lib/presets.ts`
- Add paper or photo sizes: `PAPERS` / `PHOTOS` in `lib/presets.ts`
- Themes: CSS variables in `app/globals.css` (`[data-theme=...]`)
- Layout math: `lib/sheet.ts` · image processing: `lib/image.ts`
- Deploy: push to GitHub and import into Vercel (zero config)
