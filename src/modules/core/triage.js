// Core 1000 triage: for words in unlocked bands with no stage-one card yet.
// German only first; tap to reveal the meaning, then "Kenne ich" (card
// scheduled 21 days out) or "Üben" (new card). Never overwrites a card.
// The queue is computed live from the cards, so leaving and coming back resumes.

import { getPendingCoreTriage, triageCoreWord } from '../../srs/queue.js';
import { bandOf } from '../../srs/coreScope.js';
import { fullInfoHTML } from '../shared/itemRenderer.js';
import { escapeHtml } from '../../components/gender.js';
import { t } from '../../i18n.js';

export async function render(container) {
  const words = getPendingCoreTriage();
  let i = 0;

  function paint() {
    if (i >= words.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${t('coreTriageDone')}</h1>
          <p class="page-subtitle">${t('coreTriageDoneText')}</p>
          <a href="#/core" class="btn btn-primary btn-block">${t('coreBackToCore')}</a>
        </div>`;
      return;
    }
    const w = words[i];
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${t('coreTriageProgress', i + 1, words.length, bandOf(w.rank))}</p>
        <div class="drill-card">
          <div class="drill-prompt"><strong>${escapeHtml(w.lemma)}</strong></div>
          <div id="core-meaning"></div>
        </div>
        <div class="btn-row" id="core-actions" style="margin-top:16px;">
          <button class="btn btn-primary btn-block" id="reveal">${t('coreShowMeaning')}</button>
        </div>
      </div>`;

    container.querySelector('#reveal').addEventListener(
      'click',
      () => {
        container.querySelector('#core-meaning').innerHTML = `<div class="drill-answer">${fullInfoHTML(w)}</div>`;
        container.querySelector('#core-actions').innerHTML = `
          <button class="btn btn-good btn-block" id="known">${t('coreKnowIt')}</button>
          <button class="btn btn-warn btn-block" id="drill">${t('corePractise')}</button>`;
        container.querySelector('#known').addEventListener('click', () => decide('known'), { once: true });
        container.querySelector('#drill').addEventListener('click', () => decide('drill'), { once: true });
      },
      { once: true }
    );

    function decide(decision) {
      triageCoreWord(w, decision);
      i++;
      paint();
    }
  }

  paint();
}
