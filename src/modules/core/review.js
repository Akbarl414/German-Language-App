// Core 1000 review session: each word's due meaning card (stage one German to
// English, or English to German once switched in stage two; most urgent first)
// plus new ones and stage-two introductions up to settings.coreNewPerDay, served in chunks of
// settings.reviewSessionSize. Same flip card and four grades as daily review.

import { store } from '../../db/storage.js';
import { buildCoreReviewSession, submitCoreReview } from '../../srs/queue.js';
import { renderQueueItem } from '../shared/itemRenderer.js';
import { t } from '../../i18n.js';

export async function render(container) {
  runRound();

  // Each round re-fetches the session so grades from the round just finished count.
  function runRound() {
    const sessionSize = Math.max(1, store.getSettings().reviewSessionSize || 30);
    const full = buildCoreReviewSession();

    if (full.length === 0) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${t('coreTitle')}</h1>
          <div class="empty-state">${t('coreNothingDue')}</div>
          <a href="#/core" class="btn btn-primary btn-block">${t('coreBackToCore')}</a>
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
          <div class="card-row" style="margin-bottom:10px;">
            <span class="page-subtitle" style="margin:0;">${index + 1} / ${chunk.length} · ${t('coreTitle')} · #${item.content.rank}${item.isNew ? ' · new' : ''}</span>
          </div>
          <div id="item-slot"></div>
        </div>`;
      renderQueueItem(item, container.querySelector('#item-slot'), (gradeValue) => {
        if (gradeValue >= 2) correctCount++;
        submitCoreReview(item, gradeValue);
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
              ? `<div class="btn-row">
                   <a href="#/core" class="btn btn-block">${t('coreBackToCore')}</a>
                   <button class="btn btn-primary btn-block" id="another-round">${t('anotherRound', Math.min(sessionSize, remaining))}</button>
                 </div>`
              : `<a href="#/core" class="btn btn-primary btn-block">${t('coreBackToCore')}</a>`
          }
        </div>`;
      container.querySelector('#another-round')?.addEventListener('click', runRound);
    }

    paint();
  }
}
