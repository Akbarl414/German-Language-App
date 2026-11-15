// Recovery screen, shown by main.js INSTEAD of the normal router whenever
// store.loadFailed is true (saved data exists but couldn't be parsed or
// validated). The store is read-only in that state, so nothing here can
// overwrite the original blob until the user explicitly picks a way out:
// restore a snapshot, import a backup, or (after confirmation) start fresh.
// The raw unloadable string is kept under the recovery key regardless.

import { store } from '../../db/storage.js';
import { t } from '../../i18n.js';

export function render(container) {
  const snapshots = store.listSnapshots();
  const copySaved = store.recoveryCopySaved;

  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('recoveryTitle')}</h1>
      <div class="card" style="border-color:var(--warn);">
        <p style="margin:0 0 8px;">Your saved progress on this device couldn't be read, so the app has stopped saving to avoid overwriting it. Nothing has been deleted.</p>
        <p class="page-subtitle" style="margin:0;">${
          copySaved
            ? 'A raw copy has also been set aside separately. Download it first if you want to keep it safe, then restore a snapshot, import a backup, or start fresh.'
            : "A separate raw copy could NOT be saved (storage may be full). Download the raw data before doing anything else — restoring, importing, or starting fresh will replace it."
        }</p>
      </div>

      <div class="card">
        <button class="btn btn-primary btn-block" id="download-raw">${t('recoveryDownloadRaw')}</button>
      </div>

      <div class="section-heading">${t('automaticSnapshots')}</div>
      <div class="card">
        ${
          snapshots.length === 0
            ? `<p class="page-subtitle" style="margin:0;">${t('recoveryNoSnapshots')}</p>`
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

      <div class="section-heading">${t('importBackup')}</div>
      <div class="card">
        <button class="btn btn-block" id="import-btn">${t('importBackup')}</button>
        <input type="file" id="import-file" accept="application/json" style="display:none;" />
      </div>

      <div class="section-heading">${t('dangerZone')}</div>
      <div class="card">
        <button class="btn btn-bad btn-block" id="start-fresh">${t('recoveryStartFresh')}</button>
      </div>

      <div id="recovery-msg"></div>
    </div>`;

  const msg = (html) => (container.querySelector('#recovery-msg').innerHTML = html);

  /** Extra warning before any action that overwrites the main key when no recovery copy exists. */
  const confirmUnsavedCopy = () =>
    copySaved || confirm('No separate copy of your unreadable data could be saved. If you continue, it will be replaced. Did you already download it?');

  container.querySelector('#download-raw').addEventListener('click', () => {
    const raw = store.getRawSavedData();
    if (raw == null) {
      msg(`<p style="color:var(--bad);">No raw saved data found.</p>`);
      return;
    }
    const blob = new Blob([raw], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `german-app-raw-data-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelectorAll('[data-restore-snapshot]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const date = btn.dataset.restoreSnapshot;
      if (!confirm(`Restore your progress to the snapshot from ${date}?`)) return;
      if (!confirmUnsavedCopy()) return;
      try {
        store.restoreSnapshot(date);
        location.reload();
      } catch (e) {
        msg(`<p style="color:var(--bad);">Restore failed: ${e.message}</p>`);
      }
    })
  );

  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (!confirmUnsavedCopy()) return;
    try {
      store.importBackup(await file.text());
      msg(`<p style="color:var(--good);">Backup imported. Reloading…</p>`);
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      msg(`<p style="color:var(--bad);">Import failed: ${e.message}</p>`);
    }
  });

  container.querySelector('#start-fresh').addEventListener('click', () => {
    const note = copySaved ? ' The unreadable data stays set aside in a separate recovery copy, but the app will no longer use it.' : '';
    if (!confirm(`Start fresh with empty progress?${note}`)) return;
    if (!confirmUnsavedCopy()) return;
    store.startFreshAfterFailedLoad();
    location.reload();
  });
}
