// BETA — Real A2-B1 sentences with a blank article or adjective ending;
// pick from the given options. After answering, a one-tap "Why?" reveals a
// short explanation of the case rule (hidden by default, unlike the regular
// grammar exercise flow, which always shows it). Pulls straight from the
// grammar units so it reinforces what's already being studied there.

import { getGrammarUnits } from '../../../db/contentLoader.js';
import { grammarCardId, submitGradeForCardId } from '../../../srs/queue.js';
import { gradeFromCorrectness } from '../../../srs/engine.js';
import { store } from '../../../db/storage.js';
import { escapeHtml } from '../../../components/gender.js';
import { resultsListHTML } from '../../shared/resultsSummary.js';
import { renderMissesReview } from '../../shared/missesReview.js';

const CASE_UNIT_IDS = ['adjective-endings', 'wechselpraepositionen'];
const ROUND_SIZE = 15;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool() {
  const pool = [];
  for (const unit of getGrammarUnits()) {
    if (!CASE_UNIT_IDS.includes(unit.id)) continue;
    for (const ex of unit.exercises) {
      if ((ex.type === 'multiple-choice' || ex.type === 'choose-form') && ex.prompt.includes('___')) {
        pool.push({ ...ex, unitId: unit.id });
      }
    }
  }
  return pool;
}

export async function render(container) {
  function renderIntro() {
    const pool = buildPool();
    const best = store.getStats().gameBests.caseDetective;
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Case detective <span class="tag">beta</span></h1>
        <p class="page-subtitle">Pick the article or ending that fits. Tap "Why?" any time you want the rule spelled out.</p>
        ${best ? `<p class="page-subtitle" style="margin-top:-12px;">Best: ${best.score}/${best.total}</p>` : ''}
        ${
          pool.length < 3
            ? `<div class="empty-state">Not enough case exercises available yet.</div>`
            : `<button class="btn btn-primary btn-block" id="start">Start (${Math.min(ROUND_SIZE, pool.length)} questions)</button>`
        }
      </div>`;
    const startBtn = container.querySelector('#start');
    if (startBtn) startBtn.addEventListener('click', () => startGame(pool));
  }

  function startGame(pool) {
    const queue = shuffle(pool).slice(0, ROUND_SIZE);
    let index = 0;
    let score = 0;
    let streak = 0;
    const rounds = []; // { exercise, correct }

    function paint() {
      const ex = queue[index];
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle" style="margin:0;">Score ${score} · Streak ${streak}</span>
            <span class="page-subtitle" style="margin:0;">${index + 1} / ${queue.length}</span>
          </div>
          <div class="drill-card" style="text-align:left; align-items:stretch;">
            <div class="drill-prompt" style="font-size:1.15rem;">${escapeHtml(ex.prompt)}</div>
            <div class="option-list">
              ${ex.options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(o)}</button>`).join('')}
            </div>
          </div>
          <div id="after"></div>
        </div>`;

      container.querySelectorAll('[data-i]').forEach((btn) =>
        btn.addEventListener('click', () => onAnswer(Number(btn.dataset.i), ex), { once: true })
      );
    }

    function onAnswer(i, ex) {
      const correct = i === ex.answerIndex;
      const buttons = [...container.querySelectorAll('.option-btn')];
      buttons.forEach((b) => (b.disabled = true));
      buttons[i].classList.add(correct ? 'correct' : 'incorrect');
      if (!correct) buttons[ex.answerIndex].classList.add('correct');

      submitGradeForCardId(grammarCardId(ex.unitId, ex.id), gradeFromCorrectness(correct, false));
      rounds.push({ exercise: ex, correct });
      if (correct) {
        score++;
        streak++;
      } else {
        streak = 0;
      }

      container.querySelector('#after').innerHTML = `
        <div class="btn-row" style="margin-top:14px;">
          <button type="button" class="btn btn-sm" id="why-btn">🔍 Why?</button>
          <button class="btn btn-primary" id="next-btn">${index + 1 >= queue.length ? 'See results' : 'Next'}</button>
        </div>
        <p class="drill-sub" id="why-text" style="display:none; margin-top:10px;"></p>`;

      container.querySelector('#why-btn').addEventListener(
        'click',
        (e) => {
          const p = container.querySelector('#why-text');
          p.textContent = ex.explanation;
          p.style.display = 'block';
          e.target.disabled = true;
        },
        { once: true }
      );
      container.querySelector('#next-btn').addEventListener(
        'click',
        () => {
          index++;
          if (index >= queue.length) finish();
          else paint();
        },
        { once: true }
      );
    }

    paint();

    function finish() {
      const stats = store.getStats();
      const best = stats.gameBests.caseDetective;
      const isNewBest = !best || score > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, caseDetective: { score, total: rounds.length } } });
      store.recordDailyActivity('gamesPlayed');

      const seenMissIds = new Set();
      const misses = rounds.filter((r) => {
        if (r.correct) return false;
        const key = `${r.exercise.unitId}::${r.exercise.id}`;
        if (seenMissIds.has(key)) return false;
        seenMissIds.add(key);
        return true;
      });
      const rows = rounds.map((r) => ({
        label: escapeHtml(r.exercise.prompt.length > 60 ? r.exercise.prompt.slice(0, 57) + '…' : r.exercise.prompt),
        ok: r.correct,
        correctLabel: escapeHtml(r.exercise.options[r.exercise.answerIndex]),
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Case closed 🕵️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${score}/${rounds.length}</div><div class="label">Correct</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Back to games</a>
            <button class="btn" id="again">Play again</button>
            ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Practice my misses (${misses.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', renderIntro);
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          const items = misses.map((r) => ({
            type: 'grammar',
            facet: 'default',
            sourceId: r.exercise.unitId,
            itemId: r.exercise.id,
            cardId: grammarCardId(r.exercise.unitId, r.exercise.id),
            content: r.exercise,
          }));
          renderMissesReview({ container, items, onDone: renderIntro });
        });
      }
    }
  }

  renderIntro();
}
