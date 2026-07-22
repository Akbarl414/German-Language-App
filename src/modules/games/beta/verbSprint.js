// BETA — Shown an infinitive, race to build the correct Perfekt: choose the
// auxiliary (hat/ist) then the participle from options. Timed rounds with
// best scores, like the sorting game's timed mode. Naturally includes the
// classic traps (sein verbs, separable prefixes, irregular participles)
// since it draws straight from the verbs' authored `perfekt`/`auxiliary`.

import { getAllVocabWords } from '../../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../../srs/queue.js';
import { gradeFromCorrectness } from '../../../srs/engine.js';
import { store } from '../../../db/storage.js';
import { escapeHtml } from '../../../components/gender.js';
import { hintForFacet } from '../../shared/itemRenderer.js';
import { resultsListHTML } from '../../shared/resultsSummary.js';
import { renderMissesReview } from '../../shared/missesReview.js';

const TIMED_DURATIONS = [30, 45, 60];
const WRONG_FLASH_MS = 1100;
const CORRECT_FLASH_MS = 500;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** { aux: 'hat'|'ist', participle } split off the authored `perfekt` field, e.g. "ist gefahren" -> { aux: 'ist', participle: 'gefahren' }. */
function splitPerfekt(word) {
  const [aux, ...rest] = word.perfekt.trim().split(/\s+/);
  return { aux, participle: rest.join(' ') };
}

export async function render(container) {
  let timerId = null;
  let flashTimeoutId = null;

  function clearTimers() {
    if (timerId) clearInterval(timerId);
    if (flashTimeoutId) clearTimeout(flashTimeoutId);
    timerId = null;
    flashTimeoutId = null;
  }

  function renderOptions() {
    clearTimers();
    const bests = store.getStats().gameBests;
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Verb forms sprint <span class="tag">beta</span></h1>
        <p class="page-subtitle">Build the Perfekt: pick hat/ist, then the participle.</p>
        <div class="card" style="padding:0;">
          ${TIMED_DURATIONS.map((s) => {
            const best = bests[`verbSprint-timed-${s}`];
            return `
            <button class="list-item-btn" data-timed="${s}">
              <span>${s}s</span>
              <span class="page-subtitle" style="margin:0;">${best ? `Bestwert: ${best.score}` : 'Noch kein Bestwert'}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    container.querySelectorAll('[data-timed]').forEach((btn) => btn.addEventListener('click', () => startTimedGame(Number(btn.dataset.timed))));
  }

  function notEnoughContent() {
    container.innerHTML = `<div class="view empty-state">Not enough verbs activated yet. Activate a vocab pack with verbs first.</div>`;
  }

  function startTimedGame(seconds) {
    const verbs = shuffle(getAllVocabWords().filter((w) => w.pos === 'verb' && w.perfekt && w.auxiliary));
    if (verbs.length < 5) return notEnoughContent();
    let idx = 0;
    let score = 0;
    let streak = 0;
    let bestStreak = 0;
    let timeLeft = seconds;
    let locked = false;
    const rounds = []; // { word, correct }

    const currentWord = () => verbs[idx % verbs.length];

    function buildParticipleOptions(word, correctParticiple) {
      const distractors = shuffle(
        verbs.filter((w) => w !== word).map((w) => splitPerfekt(w).participle).filter((p) => p && p !== correctParticiple)
      );
      const unique = [...new Set(distractors)].slice(0, 3);
      return shuffle([correctParticiple, ...unique]);
    }

    function paint() {
      locked = false;
      const w = currentWord();
      const { aux, participle } = splitPerfekt(w);
      let auxPick = null;
      let hintUsed = false;
      const hintText = hintForFacet(w, 'principal_parts');

      function paintAuxStep() {
        container.innerHTML = `
          <div class="view">
            <div class="card-row">
              <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
              <span class="page-subtitle" style="margin:0;">Punkte ${score} · Serie ${streak}</span>
            </div>
            <div class="drill-card" id="drill-area">
              <div class="drill-prompt">${escapeHtml(w.lemma)}</div>
              <div class="drill-sub">Perfekt: Hilfsverb?</div>
              <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
            </div>
            <div class="btn-row" style="margin-top:16px;">
              <button class="btn btn-block" data-aux="hat">hat</button>
              <button class="btn btn-block" data-aux="ist">ist</button>
            </div>
            ${hintText ? `<button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">💡 Tipp</button>` : ''}
          </div>`;
        container.querySelectorAll('[data-aux]').forEach((btn) =>
          btn.addEventListener(
            'click',
            () => {
              auxPick = btn.dataset.aux;
              paintParticipleStep();
            },
            { once: true }
          )
        );
        const hintBtn = container.querySelector('#hint-btn');
        if (hintBtn) {
          hintBtn.addEventListener(
            'click',
            (e) => {
              hintUsed = true;
              const panel = container.querySelector('#hint-panel');
              panel.textContent = hintText;
              panel.style.display = 'block';
              e.target.disabled = true;
            },
            { once: true }
          );
        }
      }

      function paintParticipleStep() {
        const options = buildParticipleOptions(w, participle);
        container.innerHTML = `
          <div class="view">
            <div class="card-row">
              <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
              <span class="page-subtitle" style="margin:0;">Punkte ${score} · Serie ${streak}</span>
            </div>
            <div class="drill-card" id="drill-area">
              <div class="drill-prompt">${escapeHtml(w.lemma)}</div>
              <div class="drill-sub">${escapeHtml(auxPick)} ___?</div>
            </div>
            <div class="option-list">
              ${options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(o)}</button>`).join('')}
            </div>
          </div>`;
        container.querySelectorAll('[data-i]').forEach((btn) =>
          btn.addEventListener('click', () => onAnswer(options[Number(btn.dataset.i)]), { once: true })
        );
      }

      function onAnswer(participlePick) {
        if (locked) return;
        locked = true;
        const correct = auxPick === aux && participlePick === participle;
        submitGradeForCardId(vocabCardId(w.packId, w.id, 'principal_parts'), gradeFromCorrectness(correct, hintUsed));
        rounds.push({ word: w, correct });
        idx++;
        if (correct) {
          score++;
          streak++;
          bestStreak = Math.max(bestStreak, streak);
          flashCorrect();
        } else {
          streak = 0;
          flashWrong(w);
        }
      }

      function flashCorrect() {
        container.innerHTML = `
          <div class="view">
            <div class="flash-wrong">
              <div class="flash-check">✓</div>
            </div>
          </div>`;
        flashTimeoutId = setTimeout(() => {
          flashTimeoutId = null;
          if (timeLeft > 0) paint();
        }, CORRECT_FLASH_MS);
      }

      function flashWrong(word) {
        const area = container.querySelector('.drill-card');
        if (!area) return;
        container.innerHTML = `
          <div class="view">
            <div class="flash-wrong">
              <div class="flash-x">✗</div>
              <div class="correction-banner">${escapeHtml(word.perfekt)} ${escapeHtml(word.lemma)}</div>
            </div>
          </div>`;
        flashTimeoutId = setTimeout(() => {
          flashTimeoutId = null;
          if (timeLeft > 0) paint();
        }, WRONG_FLASH_MS);
      }

      paintAuxStep();
    }

    timerId = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearTimers();
        finish();
      } else {
        const timeEl = container.querySelector('.time');
        if (timeEl) timeEl.textContent = `⏱️ ${timeLeft}s`;
      }
    }, 1000);

    paint();

    function finish() {
      const stats = store.getStats();
      const bestKey = `verbSprint-timed-${seconds}`;
      const best = stats.gameBests[bestKey];
      const isNewBest = !best || score > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, [bestKey]: { score, streak: bestStreak } } });
      store.recordDailyActivity('gamesPlayed');

      const seenMissIds = new Set();
      const misses = rounds.filter((r) => {
        if (r.correct) return false;
        const key = `${r.word.packId}::${r.word.id}`;
        if (seenMissIds.has(key)) return false;
        seenMissIds.add(key);
        return true;
      });
      const rows = rounds.map((r) => ({
        label: escapeHtml(r.word.lemma),
        ok: r.correct,
        correctLabel: escapeHtml(r.word.perfekt),
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Zeit abgelaufen! ⏱️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${score}</div><div class="label">Richtig</div></div>
            <div class="stat-tile"><div class="value">${bestStreak}</div><div class="label">Beste Serie</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">Neuer Bestwert!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Zurück zu den Spielen</a>
            <button class="btn" id="again">Nochmal spielen</button>
            ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Meine Fehler üben (${misses.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', () => startTimedGame(seconds));
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          const items = misses.map((r) => ({
            type: 'vocab',
            facet: 'principal_parts',
            sourceId: r.word.packId,
            itemId: r.word.id,
            cardId: vocabCardId(r.word.packId, r.word.id, 'principal_parts'),
            content: r.word,
          }));
          renderMissesReview({ container, items, onDone: renderOptions });
        });
      }
    }
  }

  renderOptions();

  return () => clearTimers();
}
