// German words fall down the screen; tap the correct meaning from 3 choices
// before the word lands (direction is configurable — see the pre-game menu).
// Speed increases each correct answer; 3 misses ends the run. On a miss
// (wrong tap or the word landing), the round pauses briefly to show the
// correct answer before the next word falls, and remaining misses are shown
// as a prominent heart tracker.

import { vocabCardId, gradeGameWord } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';
import { store } from '../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../components/gender.js';
import { hintForFacet } from '../shared/itemRenderer.js';
import { englishPrompt } from '../shared/englishPrompt.js';
import { resultsListHTML } from '../shared/resultsSummary.js';
import { renderMissesReview } from '../shared/missesReview.js';
import { getGameWordPool, extraPacksPickerHTML, wireExtraPacksPicker, poolTooSmallHTML } from '../shared/gamePool.js';
import { t } from '../../i18n.js';

const START_FALL_MS = 4200;
const MIN_FALL_MS = 1500;
const FALL_STEP_MS = 180;
const MAX_MISSES = 3;
const CORRECTION_PAUSE_MS = 1400;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function missTrackerHTML(misses) {
  return `<div class="miss-tracker">${Array.from({ length: MAX_MISSES }, (_, i) => (i < misses ? '❌' : '❤️')).join('')}</div>`;
}

function normalizeDirection(dir) {
  return dir === 'en_de' ? 'en_de' : 'de_en';
}

/** What's shown as the falling prompt. */
function promptLabel(w, direction) {
  return direction === 'en_de' ? englishPrompt(w) : w.lemma;
}

/** What's shown on each tappable option. */
function optionLabel(w, direction) {
  return direction === 'en_de' ? w.lemma : w.meaning_en;
}

/**
 * SRS facet to grade: the word's real meaning facet. Only nouns have the
 * directional facets (meaning_de_en / meaning_en_de); every other part of
 * speech has the single 'meaning' facet in both directions (see FACETS in
 * srs/engine.js, same convention as Type it).
 */
function facetFor(word, direction) {
  if (word.pos !== 'noun') return 'meaning';
  return direction === 'en_de' ? 'meaning_en_de' : 'meaning_de_en';
}

export async function render(container) {
  let landTimeoutId = null;
  let pauseTimeoutId = null;

  function clearTimers() {
    if (landTimeoutId) clearTimeout(landTimeoutId);
    if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
    landTimeoutId = null;
    pauseTimeoutId = null;
  }

  function renderIntro({ tooSmall = false } = {}) {
    clearTimers();
    const best = store.getStats().gameBests.wordfall;
    const settings = store.getSettings();
    const direction = normalizeDirection(settings.wordfallDirection);

    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${t('gameWordfallName')} 🌧️</h1>
        <p class="page-subtitle">${t('wordfallIntro')}</p>
        ${best ? `<p class="page-subtitle" style="margin-top:-12px;">${t('bestScoreValue', best.score)}</p>` : ''}
        ${tooSmall ? poolTooSmallHTML() : ''}

        <div class="section-heading">${t('direction')}</div>
        <div class="card">
          <div class="btn-row">
            <button class="btn ${direction === 'de_en' ? 'btn-primary' : ''}" data-direction="de_en">${t('directionDeToEn')}</button>
            <button class="btn ${direction === 'en_de' ? 'btn-primary' : ''}" data-direction="en_de">${t('directionEnToDe')}</button>
          </div>
        </div>

        ${extraPacksPickerHTML({ open: tooSmall })}

        <button class="btn btn-primary btn-block" id="start" style="margin-top:16px;">${t('startGame')}</button>
      </div>`;

    container.querySelector('#start').addEventListener('click', startGame);
    container.querySelectorAll('[data-direction]').forEach((btn) =>
      btn.addEventListener('click', () => {
        store.updateSettings({ wordfallDirection: btn.dataset.direction });
        renderIntro();
      })
    );
    wireExtraPacksPicker(container);
  }

  function startGame() {
    const settings = store.getSettings();
    const direction = normalizeDirection(settings.wordfallDirection);
    const words = getGameWordPool();
    if (words.length < 6) {
      renderIntro({ tooSmall: true });
      return;
    }
    let score = 0;
    let misses = 0;
    let fallMs = START_FALL_MS;
    const rounds = []; // { word, correct }
    let hintUsed = false;
    let locked = false;

    function nextQuestion() {
      const [target, ...rest] = shuffle(words);
      // Wrong options share the target's part of speech whenever the pool has
      // enough of them, so the answer can't be guessed from word type.
      const candidates = shuffle(rest.filter((w) => optionLabel(w, direction) !== optionLabel(target, direction)));
      const samePos = candidates.filter((w) => w.pos === target.pos);
      const otherPos = candidates.filter((w) => w.pos !== target.pos);
      const distractors = [...samePos, ...otherPos].slice(0, 2);
      const options = shuffle([target, ...distractors]);
      return { target, options };
    }

    let current = nextQuestion();

    function paint() {
      locked = false;
      hintUsed = false;
      const { target, options } = current;
      const hintText = hintForFacet(target, facetFor(target, direction));
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle" style="margin:0;">${t('score')} ${score}</span>
          </div>
          ${missTrackerHTML(misses)}
          <div class="wordfall-track" id="track">
            <div class="wordfall-word" id="falling">${escapeHtml(promptLabel(target, direction))}</div>
          </div>
          <div id="hint-panel" class="drill-sub" style="display:none; margin:-8px 0 10px;"></div>
          <div class="option-list">
            ${options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(optionLabel(o, direction))}</button>`).join('')}
          </div>
          ${hintText ? `<button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">${t('hintBtn')}</button>` : ''}
        </div>`;

      const falling = container.querySelector('#falling');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!falling.isConnected) return;
          falling.style.transition = `top ${fallMs}ms linear`;
          falling.style.top = 'calc(100% - 42px)';
        });
      });

      container.querySelectorAll('[data-i]').forEach((btn) =>
        btn.addEventListener('click', () => onAnswer(options[Number(btn.dataset.i)], target), { once: true })
      );
      const hintBtn = container.querySelector('#hint-btn');
      if (hintBtn) {
        hintBtn.addEventListener(
          'click',
          (e) => {
            hintUsed = true;
            const panel = container.querySelector('#hint-panel');
            panel.innerHTML = hintText;
            panel.style.display = 'block';
            e.target.disabled = true;
          },
          { once: true }
        );
      }

      landTimeoutId = setTimeout(() => onLand(target), fallMs + 60);
    }

    function onAnswer(picked, target) {
      if (locked) return;
      locked = true;
      clearTimers();
      resolveRound(picked.id === target.id && picked.packId === target.packId, target);
    }

    function onLand(target) {
      if (locked) return;
      locked = true;
      resolveRound(false, target);
    }

    function resolveRound(correct, target) {
      gradeGameWord(target, facetFor(target, direction), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word: target, correct });
      if (correct) {
        score++;
        fallMs = Math.max(MIN_FALL_MS, fallMs - FALL_STEP_MS);
        current = nextQuestion();
        paint();
      } else {
        misses++;
        showCorrection(target);
      }
    }

    function showCorrection(target) {
      const label = target.pos === 'noun' ? `${genderBadgeHTML(target.gender)} ${escapeHtml(target.lemma)}` : escapeHtml(target.lemma);
      container.innerHTML = `
        <div class="view">
          ${missTrackerHTML(misses)}
          <div class="flash-wrong">
            <div class="flash-x">✗</div>
            <div class="correction-banner">${label} = ${escapeHtml(target.meaning_en)}</div>
          </div>
        </div>`;
      pauseTimeoutId = setTimeout(() => {
        pauseTimeoutId = null;
        if (misses >= MAX_MISSES) {
          finish();
        } else {
          current = nextQuestion();
          paint();
        }
      }, CORRECTION_PAUSE_MS);
    }

    paint();

    function finish() {
      clearTimers();
      const stats = store.getStats();
      const best = stats.gameBests.wordfall;
      const isNewBest = !best || score > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, wordfall: { score } } });
      store.recordDailyActivity('gamesPlayed');

      const seenMissIds = new Set();
      const misses_ = rounds.filter((r) => {
        if (r.correct) return false;
        const key = `${r.word.packId}::${r.word.id}`;
        if (seenMissIds.has(key)) return false;
        seenMissIds.add(key);
        return true;
      });
      const rows = rounds.map((r) => ({
        label: r.word.pos === 'noun' ? `${genderBadgeHTML(r.word.gender)} ${escapeHtml(r.word.lemma)}` : escapeHtml(r.word.lemma),
        ok: r.correct,
        correctLabel: escapeHtml(r.word.meaning_en),
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">${t('wordfallOver')} 🌧️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${score}</div><div class="label">${t('score')}</div></div>
            <div class="stat-tile"><div class="value">${rounds.length}</div><div class="label">${t('wordsSeen')}</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">${t('wordfallNewBest')}</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">${t('backToGames')}</a>
            <button class="btn" id="again">${t('playAgain')}</button>
            ${misses_.length > 0 ? `<button class="btn btn-primary" id="practice-misses">${t('practiceMyMisses', misses_.length)}</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', startGame);
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          const items = misses_.map((r) => ({
            type: 'vocab',
            facet: facetFor(r.word, direction),
            sourceId: r.word.packId,
            itemId: r.word.id,
            cardId: vocabCardId(r.word.packId, r.word.id, facetFor(r.word, direction)),
            content: r.word,
            graded: r.word.graded,
          }));
          renderMissesReview({ container, items, onDone: renderIntro });
        });
      }
    }
  }

  renderIntro();

  return () => clearTimers();
}
