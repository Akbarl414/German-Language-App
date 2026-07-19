// Applies the persisted theme choice ("light" | "dark" | "system") to the
// document. CSS in style.css reacts to the `data-theme` attribute this sets
// on <html> (see the comment there for how it interacts with
// prefers-color-scheme). Also keeps the PWA's status-bar color in sync.

import { store } from './db/storage.js';

const THEME_COLOR = { dark: '#12181f', light: '#f5f7fa' };

function systemPrefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function applyTheme() {
  const { theme } = store.getSettings(); // 'light' | 'dark' | 'system'
  const root = document.documentElement;

  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }

  const effective = theme === 'light' || theme === 'dark' ? theme : systemPrefersLight() ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[effective]);
}

export function initTheme() {
  applyTheme();
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (store.getSettings().theme === 'system') applyTheme();
    });
  }
}
