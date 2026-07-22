// BETA — German words fall down the screen; tap the correct English meaning
// from 3 choices before the word lands. Speed increases each correct answer;
// 3 misses ends the run.

import { getAllVocabWords } from '../../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../../srs/queue.js';
import { gradeFromCorrectness } from '../../../srs/engine.js';
import { store } from '../../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../../components/gender.js';
import { hintForFacet } from '../../shared/itemRenderer.js';
import { resultsListHTML } from '../../shared/resultsSummary.js';
import { renderMissesReview } from '../../shared/missesReview.js';

const START_FALL_MS = 4200;
const MIN_FALL_MS = 1500;
const FALL_STEP_MS = 180;
const MAX_MISSES = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function render(container) {
  let landTimeoutId = null;

  function clearTimers() {
    if (landTimeoutId) clearTimeout(landTimeoutId);
    landTimeoutId = null;
  }

  function renderIntro() {
    clearTimers();
    const best = store.getStats().gameBests.wordfall;
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Wordfall <span class="tag">beta</span></h1>
        <p class="page-subtitle">Tap the right meaning before the word lands. Speed ramps up. 3 misses ends the run.</p>
        ${best ? `<p class="page-subtitle" style="margin-top:-12px;">Best score: ${best.score}</p>` : ''}
        <button class="btn btn-primary btn-block" id="start">Start</button>
      </div>`;
    container.querySelector('#start').addEventListener('click', startGame);
  }

  function startGame() {
    const words = getAllVocabWords();
    if (words.length < 6) {
      container.innerHTML = `<div class="view empty-state">Not enough vocab activated yet. Activate a pack first.</div>`;
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
      const distractors = shuffle(rest.filter((w) => w.meaning_en !== target.meaning_en)).slice(0, 2);
      const options = shuffle([target, ...distractors]);
      return { target, options };
    }

    let current = nextQuestion();

    function paint() {
      locked = false;
      hintUsed = false;
      const { target, options } = current;
      const hintText = hintForFacet(target, 'meaning_de_en');
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle" style="margin:0;">Score ${score}</span>
            <span class="page-subtitle" style="margin:0;">Misses ${misses}/${MAX_MISSES}</span>
          </div>
          <div class="wordfall-track" id="track">
            <div class="wordfall-word" id="falling">${escapeHtml(target.lemma)}</div>
          </div>
          <div id="hint-panel" class="drill-sub" style="display:none; margin:-8px 0 10px;"></div>
          <div class="option-list">
            ${options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(o.meaning_en)}</button>`).join('')}
          </div>
          ${hintText ? `<button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">💡 Hint</button>` : ''}
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
      submitGradeForCardId(vocabCardId(target.packId, target.id, 'meaning_de_en'), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word: target, correct });
      if (correct) {
        score++;
        fallMs = Math.max(MIN_FALL_MS, fallMs - FALL_STEP_MS);
      } else {
        misses++;
      }
      if (misses >= MAX_MISSES) {
        finish();
      } else {
        current = nextQuestion();
        paint();
      }
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
          <h1 class="page-title">Wordfall over 🌧️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${score}</div><div class="label">Score</div></div>
            <div class="stat-tile"><div class="value">${rounds.length}</div><div class="label">Words seen</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best score!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Back to games</a>
            <button class="btn" id="again">Play again</button>
            ${misses_.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Practice my misses (${misses_.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', startGame);
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          const items = misses_.map((r) => ({
            type: 'vocab',
            facet: 'meaning_de_en',
            sourceId: r.word.packId,
            itemId: r.word.id,
            cardId: vocabCardId(r.word.packId, r.word.id, 'meaning_de_en'),
            content: r.word,
          }));
          renderMissesReview({ container, items, onDone: renderIntro });
        });
      }
    }
  }

  renderIntro();

  return () => clearTimers();
}
