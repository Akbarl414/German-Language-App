// The word pool every vocab game draws from, plus the shared "extra packs"
// picker shown under Advanced settings on each game's start screen.
//
// Pool = every word from vocab packs in the user's reviews, plus words from
// the extra packs chosen in settings.gameExtraPackIds. Each word carries
// `graded`: true only for words already in the user's reviews (pack active and
// the word has a card). Games grade through gradeGameWord() in queue.js, which
// ignores practice-only words, so playing never adds words to daily review.
// Decision logic lives in src/srs/vocabScope.js (pure, unit-tested).

import { getVocabPacks } from '../../db/contentLoader.js';
import { store } from '../../db/storage.js';
import { buildGamePool, isSourceInReview, wordKeysWithCards } from '../../srs/vocabScope.js';
import { escapeHtml } from '../../components/gender.js';
import { t } from '../../i18n.js';

export function getGameWordPool() {
  return buildGamePool(
    getVocabPacks(),
    store.allPackStates(),
    store.getSettings().gameExtraPackIds || [],
    wordKeysWithCards(Object.keys(store.allCards()))
  );
}

/** Packs offered as extras: the ones not already in the user's reviews. */
function extraPackChoices() {
  const states = store.allPackStates();
  return getVocabPacks().filter((p) => !isSourceInReview('vocab', p.id, states));
}

/** Advanced-settings disclosure with a checkbox per non-active pack. `open` expands it (used when the pool is too small). */
export function extraPacksPickerHTML({ open = false } = {}) {
  const selected = new Set(store.getSettings().gameExtraPackIds || []);
  const packs = extraPackChoices();
  return `
    <details class="card" id="extra-packs" ${open ? 'open' : ''}>
      <summary>${t('advancedSettings')}</summary>
      <p class="page-subtitle" style="margin:10px 0 8px;">${t('extraPacksHelp')}</p>
      ${
        packs.length === 0
          ? `<p class="page-subtitle" style="margin:0;">${t('extraPacksNone')}</p>`
          : `<div>
              ${packs
                .map(
                  (p) => `
                <label class="switch-row">
                  <span>${escapeHtml(p.title)} <span class="page-subtitle">(${p.words.length})</span></span>
                  <input type="checkbox" data-extra-pack="${escapeHtml(p.id)}" ${selected.has(p.id) ? 'checked' : ''} />
                </label>`
                )
                .join('')}
            </div>`
      }
    </details>`;
}

/** Saves the picker's selection to settings.gameExtraPackIds on every change; calls onChange afterwards if given. */
export function wireExtraPacksPicker(container, onChange) {
  container.querySelectorAll('[data-extra-pack]').forEach((el) =>
    el.addEventListener('change', () => {
      const checked = Array.from(container.querySelectorAll('[data-extra-pack]:checked')).map((c) => c.dataset.extraPack);
      store.updateSettings({ gameExtraPackIds: checked });
      if (onChange) onChange();
    })
  );
}

/** Warning card for a start screen when the pool is too small to play. */
export function poolTooSmallHTML() {
  return `
    <div class="card" style="border-color:var(--warn);">
      <p style="margin:0 0 6px; color:var(--warn); font-weight:700;">${t('notEnoughWordsToPlay')}</p>
      <p class="page-subtitle" style="margin:0 0 10px;">${t('poolTooSmallHelp')}</p>
      <a href="#/vocab" class="btn btn-sm">${t('activatePacksLink')}</a>
    </div>`;
}
