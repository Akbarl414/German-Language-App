import { store } from '../../db/storage.js';
import { UPDATE_NOTES } from '../../updateNotes.js';
import { t } from '../../i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function render(container) {
  store.markUpdatesSeen();
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('updatesTitle')}</h1>
      ${UPDATE_NOTES.map(
        (n) => `
        <div class="card">
          <div class="page-subtitle" style="margin:0 0 6px;">${escapeHtml(n.date)}</div>
          <ul style="margin:0; padding-left:20px;">
            ${n.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
        </div>`
      ).join('')}
    </div>`;
}
