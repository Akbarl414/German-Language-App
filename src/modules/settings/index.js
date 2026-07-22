import { store } from '../../db/storage.js';
import { getVocabPacks, getPhraseSets, getGrammarUnits } from '../../db/contentLoader.js';
import { activateVocabPack, deactivateVocabPack } from '../../srs/queue.js';
import { applyTheme } from '../../theme.js';
import { t, getUiLanguage, setUiLanguage } from '../../i18n.js';

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
  { value: 'system', labelKey: 'themeSystem' },
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
    const uiLang = getUiLanguage();

    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${t('settingsTitle')}</h1>

        <div class="section-heading">${t('appearance')}</div>
        <div class="card">
          <div class="btn-row">
            ${THEME_OPTIONS.map(
              (o) => `<button class="btn ${settings.theme === o.value ? 'btn-primary' : ''}" data-theme-choice="${o.value}">${t(o.labelKey)}</button>`
            ).join('')}
          </div>
        </div>

        <div class="section-heading">Sprache der Oberfläche / Interface language</div>
        <div class="card">
          <div class="btn-row">
            <button class="btn ${uiLang === 'de' ? 'btn-primary' : ''}" data-lang-choice="de">Deutsch</button>
            <button class="btn ${uiLang === 'en' ? 'btn-primary' : ''}" data-lang-choice="en">English</button>
          </div>
        </div>

        <div class="section-heading">${t('dailyNewCards')}</div>
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 8px;">How many brand-new items trickle into your review queue per day, across all modules.</p>
          <input type="number" id="daily-limit" min="0" max="200" value="${settings.dailyNewLimit}" />
        </div>

        <div class="section-heading">${t('reviewSessions')}</div>
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 8px;">Reviews are served in chunks so a big backlog stays approachable, most overdue and weakest cards first.</p>
          <label for="session-size">Reviews per session</label>
          <input type="number" id="session-size" min="5" max="200" value="${settings.reviewSessionSize}" />
        </div>

        <div class="section-heading">${t('autoThrottle')}</div>
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 8px;">When your due queue grows past these sizes, new-card intake automatically slows down (then pauses), so it can't snowball.</p>
          <label for="throttle-reduce">Slow down new cards when due queue exceeds</label>
          <input type="number" id="throttle-reduce" min="1" max="1000" value="${settings.throttleQueueThreshold}" />
          <label for="throttle-pause">Pause new cards entirely when due queue exceeds</label>
          <input type="number" id="throttle-pause" min="1" max="1000" value="${settings.throttlePauseThreshold}" />
        </div>

        <div class="section-heading">${t('vocabPacksHeading')}</div>
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
                <button class="btn btn-sm" id="request-persist">${t('tryAgain')}</button>
              </div>`
            : ''
        }
        <div class="card">
          <p class="page-subtitle" style="margin:0 0 10px;">Your progress lives only on this device. Export regularly, especially before switching phone/computer.</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="export">${t('exportBackup')}</button>
            <button class="btn" id="import-btn">${t('importBackup')}</button>
          </div>
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
          <div id="backup-msg"></div>
        </div>

        <div class="section-heading">${t('automaticSnapshots')}</div>
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
                  <button class="btn btn-sm" data-restore-snapshot="${date}">${t('restore')}</button>
                </div>`
                  )
                  .join('')
          }
        </div>

        <div class="section-heading">${t('dangerZone')}</div>
        <div class="card">
          <button class="btn btn-bad btn-block" id="reset">${t('eraseAllProgress')}</button>
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

    container.querySelectorAll('[data-lang-choice]').forEach((btn) =>
      btn.addEventListener('click', () => {
        setUiLanguage(btn.dataset.langChoice);
        // Global language-change listener (see main.js) repaints nav + this screen.
      })
    );

    container.querySelector('#daily-limit').addEventListener('change', (e) => {
      store.updateSettings({ dailyNewLimit: Math.max(0, Number(e.target.value) || 0) });
    });

    container.querySelector('#session-size').addEventListener('change', (e) => {
      store.updateSettings({ reviewSessionSize: Math.max(5, Number(e.target.value) || 30) });
    });

    container.querySelector('#throttle-reduce').addEventListener('change', (e) => {
      store.updateSettings({ throttleQueueThreshold: Math.max(1, Number(e.target.value) || 60) });
    });

    container.querySelector('#throttle-pause').addEventListener('change', (e) => {
      store.updateSettings({ throttlePauseThreshold: Math.max(1, Number(e.target.value) || 100) });
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
