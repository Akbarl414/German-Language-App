import { getRefsByType, weightedSample, submitReview } from '../../srs/queue.js';
import { renderQueueItem } from '../shared/itemRenderer.js';

const QUIZ_LENGTH = 15;

export async function render(container) {
  const refs = getRefsByType('phrase');
  if (refs.length === 0) {
    container.innerHTML = `<div class="view empty-state">No phrases yet. <a href="#/phrases">Back to phrases</a></div>`;
    return;
  }
  const picked = weightedSample(refs, Math.min(QUIZ_LENGTH, refs.length));
  let i = 0;
  let correct = 0;

  function paint() {
    if (i >= picked.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Quiz complete 🎉</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${picked.length}</div><div class="label">Questions</div></div>
            <div class="stat-tile"><div class="value">${Math.round((correct / picked.length) * 100)}%</div><div class="label">Remembered</div></div>
          </div>
          <a href="#/phrases" class="btn btn-primary btn-block">Back to phrases</a>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${i + 1} / ${picked.length} · Phrase quiz</p>
        <div id="slot"></div>
      </div>`;
    const item = picked[i];
    renderQueueItem(item, container.querySelector('#slot'), (gradeValue) => {
      if (gradeValue >= 2) correct++;
      submitReview(item, gradeValue);
      i++;
      paint();
    });
  }

  paint();
}
