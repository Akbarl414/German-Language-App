import { store } from '../../db/storage.js';
import { buildReviewSession, submitReview, throttleStatus } from '../../srs/queue.js';
import { renderQueueItem } from '../shared/itemRenderer.js';
import { moduleLabel, throttleNoteHTML } from '../shared/labels.js';
import { t } from '../../i18n.js';

export async function render(container) {
  runRound();

  // Reviews are served in session-sized chunks (Settings > review session
  // size) rather than all at once, so a big backlog stays approachable. Each
  // call re-fetches the full prioritized queue (most overdue/weakest first)
  // so grades from the round just finished are reflected immediately.
  function runRound() {
    const settings = store.getSettings();
    const sessionSize = Math.max(1, settings.reviewSessionSize || 30);
    const full = buildReviewSession();
    const throttle = throttleStatus();

    if (full.length === 0) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${t('reviewTitle')}</h1>
          ${throttleNoteHTML(throttle.level)}
          <div class="empty-state">
            Nothing due right now.<br>Activate a vocab pack or raise your daily new-card limit in Settings.
          </div>
          <a href="#/vocab" class="btn btn-primary btn-block">Browse vocab packs</a>
        </div>`;
      return;
    }

    const chunk = full.slice(0, sessionSize);
    const remaining = full.length - chunk.length;
    let index = 0;
    let correctCount = 0;

    function paint() {
      if (index >= chunk.length) {
        showCompletion();
        return;
      }
      const item = chunk[index];
      container.innerHTML = `
        <div class="view">
          ${throttleNoteHTML(throttle.level)}
          <div class="card-row" style="margin-bottom:10px;">
            <span class="page-subtitle" style="margin:0;">${index + 1} / ${chunk.length} · ${moduleLabel(item.type)}${item.isNew ? ' · new' : ''}</span>
          </div>
          <div id="item-slot"></div>
        </div>`;
      const slot = container.querySelector('#item-slot');
      renderQueueItem(item, slot, (gradeValue) => {
        if (gradeValue >= 2) correctCount++;
        submitReview(item, gradeValue);
        index++;
        paint();
      });
    }

    function showCompletion() {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${t('sessionDone')}</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${chunk.length}</div><div class="label">${t('reviewed')}</div></div>
            <div class="stat-tile"><div class="value">${chunk.length ? Math.round((correctCount / chunk.length) * 100) : 0}%</div><div class="label">${t('remembered')}</div></div>
          </div>
          ${
            remaining > 0
              ? `<p class="page-subtitle" style="text-align:center;">${remaining} more still due — no rush, come back whenever.</p>
                 <div class="btn-row">
                   <a href="#/" class="btn btn-block">${t('backToDashboard')}</a>
                   <button class="btn btn-primary btn-block" id="another-round">${t('anotherRound', Math.min(sessionSize, remaining))}</button>
                 </div>`
              : `<a href="#/" class="btn btn-primary btn-block">${t('backToDashboard')}</a>`
          }
        </div>`;
      const again = container.querySelector('#another-round');
      if (again) again.addEventListener('click', runRound);
    }

    paint();
  }
}
