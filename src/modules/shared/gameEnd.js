// Shared end-of-round screen for new games: stat tiles, "new best", the full
// round list (resultsListHTML), and back / play again / practice-my-misses.
// Game-agnostic: the game supplies the rows and what "practice my misses" does
// (pass missCount 0 or omit onPracticeMisses to hide the button).

import { resultsListHTML } from './resultsSummary.js';
import { t } from '../../i18n.js';

/** rows: [{ label, ok, correctLabel }] as for resultsListHTML (the HTML must already be escaped). */
export function renderGameEnd({ container, title, statTiles = [], isNewBest = false, rows, onPlayAgain, missCount = 0, onPracticeMisses }) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${title}</h1>
      <div class="stat-grid">
        ${statTiles.map((s) => `<div class="stat-tile"><div class="value">${s.value}</div><div class="label">${s.label}</div></div>`).join('')}
      </div>
      ${isNewBest ? `<p style="color:var(--good); text-align:center;">${t('newBest')}</p>` : ''}
      ${resultsListHTML(rows)}
      <div class="btn-row" style="margin-top:16px;">
        <a href="#/games" class="btn">${t('backToGames')}</a>
        <button class="btn" id="again">${t('playAgain')}</button>
        ${missCount > 0 && onPracticeMisses ? `<button class="btn btn-primary" id="practice-misses">${t('practiceMyMisses', missCount)}</button>` : ''}
      </div>
    </div>`;
  container.querySelector('#again').addEventListener('click', onPlayAgain);
  const missBtn = container.querySelector('#practice-misses');
  if (missBtn) missBtn.addEventListener('click', onPracticeMisses);
}
