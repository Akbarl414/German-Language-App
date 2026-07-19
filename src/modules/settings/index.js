import { store } from '../../db/storage.js';
import { getVocabPacks, getPhraseSets, getGrammarUnits } from '../../db/contentLoader.js';
import { activateVocabPack, deactivateVocabPack } from '../../srs/queue.js';
import { applyTheme } from '../../theme.js';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Follow system' },
];

export async function render(container) {
  let persisted = null; // null = unknown/unsupported, true/false once checked
  if (navigator.storage?.persisted) {
    persisted = await navigator.storage.persisted().catch(() => null);
  }

  paint();

  function paint() {
    const settings = store.getSettings();
    const vocabPacks = getVocabPacks();
    const snapshots = store.listSnapshots();

    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Settings</h1>

        <div class="section-heading">Appearance</div>
        <div class="card">
          <div class="btn-row">
            ${THEME_OPTIONS.map(
              (o) => `<button class="btn ${settings.theme === o.value ? 'btn-primary' : ''}" data-theme-choice="${o.value}">${o.label}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section-heading">Daily new cards</div>
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 8px;">How many brand-new items trickle into your review queue per day, across all modules.</p>
          <input type="number" id="daily-limit" min="0" max="200" value="${settings.dailyNewLimit}" />
        </div>

        <div class="section-heading">Vocabulary packs</div>
        <div class="card" style="padding:0;">
          ${vocabPacks
            .map((p) => {
              const state = store.getPackState(`vocab:${p.id}`);
              return `
              <div class="switch-row" style="padding:12px 16px;">
                <span>${p.title} <span class="page-subtitle">(${p.words.length})</span></span>
                <input type="checkbox" data-pack="${p.id}" ${state.active ? 'checked' : ''} />
              </div>`;
            })
            .join('')}
        </div>

        <div class="section-heading">Backup</div>
        ${
          store.shouldPromptBackup()
            ? `<div class="card" style="border-color:var(--warn);">
                <p style="margin:0; color:var(--warn);">It's been a while since your last export — back up now so you don't risk losing progress.</p>
              </div>`
            : ''
        }
        ${
          persisted === false
            ? `<div class="card" style="border-color:var(--warn);">
                <p style="margin:0 0 8px; color:var(--warn);">Persistent storage wasn't granted — the browser could clear your progress under storage pressure. Exporting backups regularly is the safest guard.</p>
                <button class="btn btn-sm" id="request-persist">Try again</button>
              </div>`
            : ''
        }
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 10px;">Your progress lives only on this device. Export regularly, especially before switching phone/computer.</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="export">Export backup</button>
            <button class="btn" id="import-btn">Import backup</button>
          </div>
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
          <div id="backup-msg"></div>
        </div>

        <div class="section-heading">Automatic snapshots</div>
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 10px;">A checkpoint of your progress is kept automatically for each of the last ${snapshots.length ? 'few' : '7'} days, in case something goes wrong between exports.</p>
          ${
            snapshots.length === 0
              ? `<p class="page-subtitle" style="margin:0;">No snapshots yet — check back after a day of use.</p>`
              : snapshots
                  .map(
                    (date) => `
                <div class="switch-row">
                  <span>${date}</span>
                  <button class="btn btn-sm" data-restore-snapshot="${date}">Restore</button>
                </div>`
                  )
                  .join('')
          }
        </div>

        <div class="section-heading">Danger zone</div>
        <div class="card">
          <button class="btn btn-bad btn-block" id="reset">Erase all progress on this device</button>
        </div>

        <p class="page-subtitle" style="text-align:center;">
          Vocab: ${vocabPacks.reduce((n, p) => n + p.words.length, 0)} words ·
          Phrases: ${getPhraseSets().reduce((n, s) => n + s.phrases.length, 0)} ·
          Grammar: ${getGrammarUnits().length} units
        </p>
      </div>`;

    container.querySelectorAll('[data-theme-choice]').forEach((btn) =>
      btn.addEventListener('click', () => {
        store.updateSettings({ theme: btn.dataset.themeChoice });
        applyTheme();
        paint();
      })
    );

    container.querySelector('#daily-limit').addEventListener('change', (e) => {
      store.updateSettings({ dailyNewLimit: Math.max(0, Number(e.target.value) || 0) });
    });

    container.querySelectorAll('[data-pack]').forEach((el) =>
      el.addEventListener('change', () => {
        if (el.checked) activateVocabPack(el.dataset.pack);
        else deactivateVocabPack(el.dataset.pack);
        paint();
      })
    );

    container.querySelector('#export').addEventListener('click', () => {
      const json = store.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `german-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      container.querySelector('#backup-msg').innerHTML = `<p style="color:var(--good);">Backup downloaded.</p>`;
    });

    const fileInput = container.querySelector('#import-file');
    container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        store.importBackup(text);
        container.querySelector('#backup-msg').innerHTML = `<p style="color:var(--good);">Backup imported. Reloading…</p>`;
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        container.querySelector('#backup-msg').innerHTML = `<p style="color:var(--bad);">Import failed: ${e.message}</p>`;
      }
    });

    container.querySelector('#reset').addEventListener('click', () => {
      if (confirm('This erases all progress, activated packs, and added content on this device. This cannot be undone. Continue?')) {
        store.resetAll();
        location.reload();
      }
    });

    const requestPersistBtn = container.querySelector('#request-persist');
    if (requestPersistBtn) {
      requestPersistBtn.addEventListener('click', async () => {
        persisted = await navigator.storage.persist().catch(() => false);
        paint();
      });
    }

    container.querySelectorAll('[data-restore-snapshot]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const date = btn.dataset.restoreSnapshot;
        if (confirm(`Restore your progress to how it was on ${date}? Anything changed since then will be lost.`)) {
          store.restoreSnapshot(date);
          location.reload();
        }
      })
    );
  }
}
