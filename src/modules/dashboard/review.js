import { buildReviewSession, submitReview } from '../../srs/queue.js';
import { renderQueueItem } from '../shared/itemRenderer.js';
import { moduleLabel } from '../shared/labels.js';

export async function render(container) {
  const session = buildReviewSession();
  let index = 0;
  let correctCount = 0;

  function paint() {
    if (index >= session.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Session complete 🎉</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${session.length}</div><div class="label">Reviewed</div></div>
            <div class="stat-tile"><div class="value">${session.length ? Math.round((correctCount / session.length) * 100) : 0}%</div><div class="label">Remembered</div></div>
          </div>
          <a href="#/" class="btn btn-primary btn-block">Back to dashboard</a>
        </div>`;
      return;
    }
    const item = session[index];
    container.innerHTML = `
      <div class="view">
        <div class="card-row" style="margin-bottom:10px;">
          <span class="page-subtitle" style="margin:0;">${index + 1} / ${session.length} · ${moduleLabel(item.type)}${item.isNew ? ' · new' : ''}</span>
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

  if (session.length === 0) {
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Review</h1>
        <div class="empty-state">
          Nothing due right now.<br>Activate a vocab pack or raise your daily new-card limit in Settings.
        </div>
        <a href="#/vocab" class="btn btn-primary btn-block">Browse vocab packs</a>
      </div>`;
    return;
  }

  paint();
}
