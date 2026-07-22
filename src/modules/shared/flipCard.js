// Generic "tap to reveal, then self-grade" flashcard interaction, shared by
// every vocab/phrase SRS facet that isn't auto-gradable multiple choice.
//
// German-first mode: `hintHTML` (optional) is whatever contextual info is
// safe to show WITHOUT giving away the fact this card is testing (e.g. for
// a meaning card, gender+plural are fair game but the meaning itself isn't).
// Omit it and no Hint button renders. Using the hint caps the eventual
// grade at Hard, since needing it means the item isn't fully known yet.

import { Grade } from '../../srs/engine.js';
import { t } from '../../i18n.js';

export function renderFlipCard({ container, frontHTML, backHTML, hintHTML, onGrade }) {
  let hintUsed = false;

  function paintFront() {
    container.innerHTML = `
      <div class="drill-card">
        <div class="drill-prompt">${frontHTML}</div>
        <div id="hint-panel" class="drill-sub" style="display:none; margin-top:10px;"></div>
      </div>
      <div class="btn-row" style="margin-top:14px; justify-content:center;">
        ${hintHTML ? `<button class="btn btn-sm" id="hint-btn">${t('hintBtn')}</button>` : ''}
        <button class="btn btn-primary" id="reveal">${t('showAnswer')}</button>
      </div>`;

    const hintBtn = container.querySelector('#hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener(
        'click',
        () => {
          hintUsed = true;
          const panel = container.querySelector('#hint-panel');
          panel.innerHTML = hintHTML;
          panel.style.display = 'block';
          hintBtn.disabled = true;
        },
        { once: true }
      );
    }

    container.querySelector('#reveal').addEventListener('click', paintBack, { once: true });
  }

  function paintBack() {
    container.innerHTML = `
      <div class="drill-card">
        <div class="drill-prompt">${frontHTML}</div>
        <div class="drill-answer">${backHTML}</div>
      </div>
      <div class="btn-row" style="margin-top:14px; justify-content:center;">
        <button class="btn btn-bad" data-g="${Grade.AGAIN}">${t('gradeAgain')}</button>
        <button class="btn" data-g="${Grade.HARD}">${t('gradeHard')}</button>
        <button class="btn btn-good" data-g="${Grade.GOOD}">${t('gradeGood')}</button>
        <button class="btn btn-primary" data-g="${Grade.EASY}">${t('gradeEasy')}</button>
      </div>`;
    container.querySelectorAll('[data-g]').forEach((btn) =>
      btn.addEventListener(
        'click',
        () => {
          const raw = Number(btn.dataset.g);
          onGrade(hintUsed ? Math.min(raw, Grade.HARD) : raw);
        },
        { once: true }
      )
    );
  }

  paintFront();
}
