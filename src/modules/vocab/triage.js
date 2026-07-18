import { getPendingTriageWords, triageWord } from '../../srs/queue.js';
import { genderBadgeHTML, escapeHtml } from '../../components/gender.js';

export async function render(container, { packId }) {
  let words = getPendingTriageWords(packId);
  let i = 0;

  function paint() {
    if (i >= words.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Triage complete</h1>
          <p class="page-subtitle">Words marked "drill it" will trickle into your daily review queue.</p>
          <a href="#/vocab/pack/${packId}" class="btn btn-primary btn-block">Back to pack</a>
        </div>`;
      return;
    }
    const w = words[i];
    const head = w.pos === 'noun' ? `${genderBadgeHTML(w.gender)} ${escapeHtml(w.lemma)}` : `<strong>${escapeHtml(w.lemma)}</strong>`;
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${i + 1} / ${words.length} · Triage</p>
        <div class="drill-card">
          <div class="drill-prompt">${head}</div>
          <div class="drill-answer">${escapeHtml(w.meaning_en)}</div>
          ${w.pos === 'noun' ? `<div class="drill-sub">Plural: die ${escapeHtml(w.plural)}</div>` : ''}
          <div class="drill-example">${escapeHtml(w.example_de)}</div>
        </div>
        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-good btn-block" id="known">✓ Already know it</button>
          <button class="btn btn-warn btn-block" id="drill">Drill it</button>
        </div>
      </div>`;

    container.querySelector('#known').addEventListener('click', () => {
      triageWord(packId, w.id, 'known');
      i++;
      paint();
    });
    container.querySelector('#drill').addEventListener('click', () => {
      triageWord(packId, w.id, 'drill');
      i++;
      paint();
    });
  }

  paint();
}
