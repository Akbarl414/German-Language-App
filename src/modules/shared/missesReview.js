// Small ad-hoc review loop for a game's "practice my misses" button: steps
// through a fixed list of vocab queue-items (one specific facet each) using
// the same flip-card/multiple-choice UI as the daily review queue.

import { renderQueueItem } from './itemRenderer.js';
import { submitReview } from '../../srs/queue.js';
import { store } from '../../db/storage.js';
import { newCard } from '../../srs/engine.js';

/** items: [{ cardId, type: 'vocab', sourceId, itemId, facet, content }] */
export function renderMissesReview({ container, items, onDone }) {
  let i = 0;

  function paint() {
    if (i >= items.length) {
      onDone();
      return;
    }
    const raw = items[i];
    const card = store.getCard(raw.cardId) || newCard();
    const item = { ...raw, card };
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${i + 1} / ${items.length} · Du übst deine Fehler</p>
        <div id="miss-slot"></div>
      </div>`;
    renderQueueItem(item, container.querySelector('#miss-slot'), (gradeValue) => {
      submitReview(item, gradeValue);
      i++;
      paint();
    });
  }

  paint();
}
