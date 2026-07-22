import { getRefsByType, weightedSample, submitReview } from '../../srs/queue.js';
import { renderQueueItem } from '../shared/itemRenderer.js';
import { labelForItem, moduleLabel } from '../shared/labels.js';
// Aliased to avoid shadowing the local `t` (module type) variable used below.
import { t as translate } from '../../i18n.js';

export async function render(container, { modules = 'vocab,phrase,grammar', length = '20' }) {
  const types = modules.split(',');
  const pool = types.flatMap((t) => getRefsByType(t));
  if (pool.length === 0) {
    container.innerHTML = `<div class="view empty-state">No content available for the selected modules yet. <a href="#/testme">Back</a></div>`;
    return;
  }
  const picked = weightedSample(pool, Math.min(Number(length), pool.length));
  const missed = [];
  let index = 0;
  let correctCount = 0;

  function paint() {
    if (index >= picked.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${translate('testComplete')}</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${picked.length}</div><div class="label">${translate('questions')}</div></div>
            <div class="stat-tile"><div class="value">${Math.round((correctCount / picked.length) * 100)}%</div><div class="label">${translate('correct')}</div></div>
          </div>
          <div class="section-heading">${translate('whatToReview')}</div>
          <div class="card" style="padding:0;">
            ${
              missed.length === 0
                ? `<p class="page-subtitle" style="padding:16px;">Nothing missed — great job!</p>`
                : missed.map((m) => `<div class="list-item"><span>${labelForItem(m)}</span><span class="tag">${moduleLabel(m.type)}</span></div>`).join('')
            }
          </div>
          <a href="#/testme" class="btn btn-primary btn-block">${translate('testMeAgain')}</a>
        </div>`;
      return;
    }
    const item = picked[index];
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${index + 1} / ${picked.length} · ${moduleLabel(item.type)}</p>
        <div id="slot"></div>
      </div>`;
    renderQueueItem(item, container.querySelector('#slot'), (gradeValue) => {
      if (gradeValue >= 2) correctCount++;
      else missed.push(item);
      submitReview(item, gradeValue);
      index++;
      paint();
    });
  }

  paint();
}
