// BETA — Shown the English meaning, type the German spelling using the
// umlaut buttons. Structured like the sorting game: a Timed mode (30/45/60s)
// and a Streak mode (ends on first mistake), each with its own best score.
// Grading requires an exact match, including noun capitalization. Correct
// answers get a quick green confirmation and move straight on; wrong
// answers show the typed vs. correct German side by side before continuing
// (a near-miss — only capitalization or a missing umlaut/ß — gets its own
// "so close" message instead).

import { getAllVocabWords } from '../../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../../srs/queue.js';
import { gradeFromCorrectness } from '../../../srs/engine.js';
import { store } from '../../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../../components/gender.js';
import { umlautFieldHTML, wireUmlautButtons } from '../../../components/umlaut.js';
import { resultsListHTML } from '../../shared/resultsSummary.js';
import { renderMissesReview } from '../../shared/missesReview.js';

const TIMED_DURATIONS = [30, 45, 60];
const CORRECT_FLASH_MS = 500;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Facet to grade against: nouns get the dedicated EN->DE recall facet; other parts of speech fall back to their single 'meaning' facet. */
function facetFor(word) {
  return word.pos === 'noun' ? 'meaning_en_de' : 'meaning';
}

function deumlaut(s) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** null if not a near-miss; otherwise a message pinpointing what differed, without ever just showing "wrong". */
function describeNearMiss(typed, answer) {
  if (typed === answer) return null;
  if (deumlaut(typed) !== deumlaut(answer)) return null;
  if (typed.toLowerCase() === answer.toLowerCase()) {
    return `Just the capitalization — German nouns (and words at the start of a sentence) are always capitalized: “${escapeHtml(answer)}”.`;
  }
  return `So close — check the umlaut/ß: you wrote “${escapeHtml(typed)}”, it should be “${escapeHtml(answer)}”.`;
}

export async function render(container) {
  let timerId = null;

  function clearTimers() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function renderOptions() {
    clearTimers();
    const bests = store.getStats().gameBests;
    const streakBest = bests.typeit;
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Type it <span class="tag">beta</span></h1>
        <p class="page-subtitle">You see the English, type the German. Exact spelling counts — nouns need capital letters.</p>
        <div class="card" style="padding:0;">
          ${TIMED_DURATIONS.map((s) => {
            const best = bests[`typeit-timed-${s}`];
            return `
            <button class="list-item-btn" data-timed="${s}">
              <span>${s}s</span>
              <span class="page-subtitle" style="margin:0;">${best ? `Bestwert: ${best.score}` : 'Noch kein Bestwert'}</span>
            </button>`;
          }).join('')}
          <button class="list-item-btn" data-streak="1">
            <span>Serie (ohne Timer)</span>
            <span class="page-subtitle" style="margin:0;">${streakBest ? `Beste Serie: ${streakBest.streak}` : 'Noch kein Bestwert'}</span>
          </button>
        </div>
      </div>`;
    container.querySelectorAll('[data-timed]').forEach((btn) => btn.addEventListener('click', () => startTimedGame(Number(btn.dataset.timed))));
    container.querySelector('[data-streak]').addEventListener('click', startStreakGame);
  }

  function notEnoughContent() {
    container.innerHTML = `<div class="view empty-state">Not enough vocab activated yet. Activate a pack first.</div>`;
  }

  /** Shared question UI for both modes — differs only in the header line and what happens after an answer. */
  function paintPrompt(word, headerHTML, onSubmit) {
    let hintUsed = false;
    const first = word.lemma.trim()[0] || '?';
    const hintText = `Starts with "${first}" · ${word.lemma.trim().length} letters${word.pos === 'noun' ? ' · nouns are always capitalized' : ''}`;

    container.innerHTML = `
      <div class="view">
        ${headerHTML}
        <div class="drill-card">
          <div class="drill-prompt">${escapeHtml(word.meaning_en)}</div>
          <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
        </div>
        ${umlautFieldHTML('type-input', { label: 'Type the German word', placeholder: '…' })}
        <div class="btn-row" style="margin-top:12px;">
          <button type="button" class="btn btn-sm" id="hint-btn">💡 Tipp</button>
          <button class="btn btn-primary" id="check">Prüfen</button>
        </div>
      </div>`;
    wireUmlautButtons(container);

    const input = container.querySelector('#type-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') container.querySelector('#check').click();
    });

    container.querySelector('#hint-btn').addEventListener(
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

    container.querySelector('#check').addEventListener(
      'click',
      () => {
        const typed = input.value.trim();
        onSubmit(typed, hintUsed);
      },
      { once: true }
    );
  }

  function renderCorrectFlash(onContinue) {
    const input = container.querySelector('#type-input');
    if (input) {
      input.style.borderColor = 'var(--good)';
      input.disabled = true;
    }
    const checkBtn = container.querySelector('#check');
    if (checkBtn) checkBtn.disabled = true;
    const hintBtn = container.querySelector('#hint-btn');
    if (hintBtn) hintBtn.disabled = true;
    const panel = container.querySelector('#hint-panel');
    if (panel) {
      panel.textContent = '✓ Richtig!';
      panel.style.color = 'var(--good)';
      panel.style.fontWeight = '700';
      panel.style.display = 'block';
    }
    setTimeout(onContinue, CORRECT_FLASH_MS);
  }

  function renderWrongFeedback(word, typed, nearMiss, onContinue) {
    container.innerHTML = `
      <div class="view">
        <div class="drill-card">
          <div class="drill-prompt">${nearMiss ? 'So close! 🤏' : 'Not quite'}</div>
          ${
            nearMiss
              ? `<p class="drill-sub" style="margin-top:10px;">${nearMiss}</p>`
              : `<div style="display:flex; gap:24px; justify-content:center; margin-top:14px;">
                   <div><div class="drill-sub">You wrote</div><div style="font-size:1.2rem; font-weight:700; color:var(--bad);">${escapeHtml(typed) || '—'}</div></div>
                   <div><div class="drill-sub">Correct</div><div style="font-size:1.2rem; font-weight:700; color:var(--good);">${escapeHtml(word.lemma)}</div></div>
                 </div>`
          }
        </div>
        <button class="btn btn-primary btn-block" id="continue" style="margin-top:16px;">Weiter</button>
      </div>`;
    container.querySelector('#continue').addEventListener('click', onContinue, { once: true });
  }

  // --- Mode A: Timed ---
  function startTimedGame(seconds) {
    const words = shuffle(getAllVocabWords());
    if (words.length < 5) return notEnoughContent();
    let idx = 0;
    let score = 0;
    let timeLeft = seconds;
    const rounds = []; // { word, correct }

    const currentWord = () => words[idx % words.length];

    function paint() {
      const w = currentWord();
      paintPrompt(
        w,
        `<div class="card-row">
          <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
          <span class="page-subtitle" style="margin:0;">Punkte ${score}</span>
        </div>`,
        (typed, hintUsed) => onAnswer(typed, w, hintUsed)
      );
    }

    function onAnswer(typed, word, hintUsed) {
      const correct = typed === word.lemma;
      submitGradeForCardId(vocabCardId(word.packId, word.id, facetFor(word)), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, correct });
      idx++;
      if (correct) {
        score++;
        renderCorrectFlash(() => {
          if (timeLeft > 0) paint();
        });
      } else {
        renderWrongFeedback(word, typed, describeNearMiss(typed, word.lemma), () => {
          if (timeLeft > 0) paint();
        });
      }
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
      const bestKey = `typeit-timed-${seconds}`;
      const best = stats.gameBests[bestKey];
      const isNewBest = !best || score > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, [bestKey]: { score } } });
      finishRound({ title: 'Zeit abgelaufen! ⏱️', statValue: score, statLabel: 'Punkte', isNewBest, rounds, onPlayAgain: () => startTimedGame(seconds) });
    }
  }

  // --- Mode B: Streak (no timer, ends on first mistake) ---
  function startStreakGame() {
    const words = shuffle(getAllVocabWords());
    if (words.length < 5) return notEnoughContent();
    let idx = 0;
    let streak = 0;
    const rounds = []; // { word, correct }

    const currentWord = () => words[idx % words.length];

    function paint() {
      const w = currentWord();
      paintPrompt(w, `<p class="page-subtitle">Serie: ${streak}</p>`, (typed, hintUsed) => onAnswer(typed, w, hintUsed));
    }

    function onAnswer(typed, word, hintUsed) {
      const correct = typed === word.lemma;
      submitGradeForCardId(vocabCardId(word.packId, word.id, facetFor(word)), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, correct });
      idx++;
      if (correct) {
        streak++;
        renderCorrectFlash(() => paint());
      } else {
        renderWrongFeedback(word, typed, describeNearMiss(typed, word.lemma), () => finish());
      }
    }

    paint();

    function finish() {
      const stats = store.getStats();
      const best = stats.gameBests.typeit;
      const isNewBest = !best || streak > best.streak;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, typeit: { streak } } });
      finishRound({ title: 'Serie beendet', statValue: streak, statLabel: 'Serie', isNewBest, rounds, onPlayAgain: startStreakGame });
    }
  }

  // Shared end-of-round screen for both modes.
  function finishRound({ title, statValue, statLabel, isNewBest, rounds, onPlayAgain }) {
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
      label: escapeHtml(r.word.meaning_en),
      ok: r.correct,
      correctLabel: r.word.pos === 'noun' ? `${genderBadgeHTML(r.word.gender)} ${escapeHtml(r.word.lemma)}` : escapeHtml(r.word.lemma),
    }));

    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${title}</h1>
        <div class="stat-grid">
          <div class="stat-tile"><div class="value">${statValue}</div><div class="label">${statLabel}</div></div>
        </div>
        ${isNewBest ? `<p style="color:var(--good); text-align:center;">Neuer Bestwert!</p>` : ''}
        ${resultsListHTML(rows)}
        <div class="btn-row" style="margin-top:16px;">
          <a href="#/games" class="btn">Zurück zu den Spielen</a>
          <button class="btn" id="again">Nochmal spielen</button>
          ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Meine Fehler üben (${misses.length})</button>` : ''}
        </div>
      </div>`;
    container.querySelector('#again').addEventListener('click', onPlayAgain);
    const missBtn = container.querySelector('#practice-misses');
    if (missBtn) {
      missBtn.addEventListener('click', () => {
        const items = misses.map((r) => ({
          type: 'vocab',
          facet: facetFor(r.word),
          sourceId: r.word.packId,
          itemId: r.word.id,
          cardId: vocabCardId(r.word.packId, r.word.id, facetFor(r.word)),
          content: r.word,
        }));
        renderMissesReview({ container, items, onDone: renderOptions });
      });
    }
  }

  renderOptions();

  return () => clearTimers();
}
