import { defineConfig } from 'vite';

// Dev only (apply: 'serve'; never runs in `vite build`). An earlier version of
// the app registered the service worker in dev too, which then served stale
// /src files cache-first. A browser that already has it can't recover through
// main.js (the worker serves the OLD cached main.js), but index.html is
// network-first, so this inline script is always fresh. It removes any worker
// for this origin and our own `deutsch-trainer-*` caches only (Cache Storage
// is shared with other apps on github.io-style origins), then reloads once if
// the page was still controlled. The sessionStorage flag caps it at one
// reload per tab.
const devServiceWorkerCleanup = {
  name: 'dev-service-worker-cleanup',
  apply: 'serve',
  transformIndexHtml() {
    const script = `
(function () {
  var FLAG = 'sw-dev-cleanup-reloaded';
  var wasControlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var tasks = [];
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      })
    );
  }
  if (window.caches && caches.keys) {
    tasks.push(
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k.indexOf('deutsch-trainer-') === 0; })
              .map(function (k) { return caches.delete(k); })
        );
      })
    );
  }
  Promise.all(tasks).then(function () {
    if (!wasControlled) return;
    var already = false;
    try { already = sessionStorage.getItem(FLAG) === '1'; } catch (e) { already = true; }
    if (already) return;
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) { return; }
    location.reload();
  }).catch(function (e) { console.warn('Dev service worker cleanup failed', e); });
})();`;
    return [{ tag: 'script', children: script, injectTo: 'head-prepend' }];
  },
};

export default defineConfig({
  plugins: [devServiceWorkerCleanup],
  // Relative base so the build works from any GitHub Pages project path
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  build: {
    outDir: 'dist',
  },
});
