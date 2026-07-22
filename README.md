# Deutsch Trainer

A personal, offline-capable PWA for German vocabulary, grammar, and phrases — built to supplement in-person lessons. Pure static site (Vite + vanilla JS), no backend. All learning content is versioned JSON in this repo; all progress lives in the browser's localStorage on your device.

See [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) for how to add vocab packs, grammar units, phrase sets, and stories (the Path B content pipeline for Claude Code sessions).

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run validate   # check all content JSON against its schema
npm run test       # run unit tests (node's built-in test runner, no extra deps)
npm run build      # validate + production build to dist/
npm run preview    # preview the production build locally
```

## Deploying to GitHub Pages

1. Create a GitHub repo (if you haven't already) and push this project:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**. That's it — `.github/workflows/deploy.yml` builds and deploys on every push to `main` (and can be triggered manually from the Actions tab).
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/`. The build uses a relative base path, so it works at any repo path without configuration.

## Installing on your phone

**iPhone (Safari):** open the Pages URL → tap the Share icon → **Add to Home Screen**.

**Android (Chrome):** open the Pages URL → tap the ⋮ menu → **Install app** (or **Add to Home screen**).

Once installed, it works fully offline (a service worker caches everything after the first visit) and opens full-screen like a native app.

## Backup

Progress lives only on-device (localStorage). Use **Settings → Export backup** regularly, and **Settings → Import backup** to restore or move progress between your phone and computer.
