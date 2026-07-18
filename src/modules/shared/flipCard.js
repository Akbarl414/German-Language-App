// Generic "tap to reveal, then self-grade" flashcard interaction, shared by
// every vocab/phrase SRS facet that isn't auto-gradable multiple choice.

import { Grade } from '../../srs/engine.js';

export function renderFlipCard({ container, frontHTML, backHTML, onGrade }) {
  container.innerHTML = `
    <div class="drill-card">
      <div class="drill-prompt">${frontHTML}</div>
      <button class="btn btn-primary" id="reveal">Show answer</button>
    </div>`;
  container.querySelector('#reveal').addEventListener('click', () => {
    container.innerHTML = `
      <div class="drill-card">
        <div class="drill-prompt">${frontHTML}</div>
        <div class="drill-answer">${backHTML}</div>
      </div>
      <div class="btn-row" style="margin-top:14px; justify-content:center;">
        <button class="btn btn-bad" data-g="${Grade.AGAIN}">Again</button>
        <button class="btn" data-g="${Grade.HARD}">Hard</button>
        <button class="btn btn-good" data-g="${Grade.GOOD}">Good</button>
        <button class="btn btn-primary" data-g="${Grade.EASY}">Easy</button>
      </div>`;
    container.querySelectorAll('[data-g]').forEach((btn) =>
      btn.addEventListener('click', () => onGrade(Number(btn.dataset.g)), { once: true })
    );
  });
}
