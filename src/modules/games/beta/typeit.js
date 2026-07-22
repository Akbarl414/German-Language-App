// BETA — Shown the English meaning, type the German spelling using the
// umlaut buttons. Streak-based (like the sorting game's streak mode): one
// miss ends the run. Grading requires an exact match, including noun
// capitalization; a near-miss (only capitalization or a missing umlaut/ß)
// gets its own "so close" screen highlighting exactly what differed.

import { getAllVocabWords } from '../../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../../srs/queue.js';
import { gradeFromCorrectness } from '../../../srs/engine.js';
import { store } from '../../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../../components/gender.js';
import { umlautFieldHTML, wireUmlautButtons } from '../../../components/umlaut.js';
import { resultsListHTML } from '../../shared/resultsSummary.js';
import { renderMissesReview } from '../../shared/missesReview.js';

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
  function renderIntro() {
    const best = store.getStats().gameBests.typeit;
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Type it <span class="tag">beta</span></h1>
        <p class="page-subtitle">You see the English, type the German. Exact spelling counts — nouns need capital letters.</p>
        ${best ? `<p class="page-subtitle" style="margin-top:-12px;">Best streak: ${best.streak}</p>` : ''}
        <button class="btn btn-primary btn-block" id="start">Start</button>
      </div>`;
    container.querySelector('#start').addEventListener('click', startGame);
  }

  function startGame() {
    const words = shuffle(getAllVocabWords());
    if (words.length < 5) {
      container.innerHTML = `<div class="view empty-state">Not enough vocab activated yet. Activate a pack first.</div>`;
      return;
    }
    let idx = 0;
    let streak = 0;
    const rounds = []; // { word, correct }

    const currentWord = () => words[idx % words.length];

    function paint() {
      const w = currentWord();
      let hintUsed = false;
      const first = w.lemma.trim()[0] || '?';
      const hintText = `Starts with "${first}" · ${w.lemma.trim().length} letters${w.pos === 'noun' ? ' · nouns are always capitalized' : ''}`;

      container.innerHTML = `
        <div class="view">
          <p class="page-subtitle">Streak: ${streak}</p>
          <div class="drill-card">
            <div class="drill-prompt">${escapeHtml(w.meaning_en)}</div>
            <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
          </div>
          ${umlautFieldHTML('type-input', { label: 'Type the German word', placeholder: '…' })}
          <div class="btn-row" style="margin-top:12px;">
            <button type="button" class="btn btn-sm" id="hint-btn">💡 Hint</button>
            <button class="btn btn-primary" id="check">Check</button>
          </div>
          <div id="result"></div>
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
          onAnswer(typed, w, hintUsed);
        },
        { once: true }
      );
    }

    function onAnswer(typed, word, hintUsed) {
      const correct = typed === word.lemma;
      submitGradeForCardId(vocabCardId(word.packId, word.id, facetFor(word)), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, correct });
      if (correct) {
        streak++;
        idx++;
        paint();
      } else {
        const nearMiss = describeNearMiss(typed, word.lemma);
        showMissScreen(typed, word, nearMiss);
      }
    }

    function showMissScreen(typed, word, nearMiss) {
      container.innerHTML = `
        <div class="view">
          <div class="drill-card">
            <div class="drill-prompt">${nearMiss ? 'So close! 🤏' : 'Not quite'}</div>
            <p class="drill-sub" style="margin-top:10px;">
              ${nearMiss || `You wrote “${escapeHtml(typed) || '(nothing)'}” — the correct spelling is “${escapeHtml(word.lemma)}”.`}
            </p>
          </div>
          <button class="btn btn-primary btn-block" id="continue" style="margin-top:16px;">Continue</button>
        </div>`;
      container.querySelector('#continue').addEventListener('click', finish, { once: true });
    }

    paint();

    function finish() {
      const stats = store.getStats();
      const best = stats.gameBests.typeit;
      const isNewBest = !best || streak > best.streak;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, typeit: { streak } } });
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
          <h1 class="page-title">Streak ended</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${streak}</div><div class="label">Streak</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best streak!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Back to games</a>
            <button class="btn" id="again">Play again</button>
            ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Practice my misses (${misses.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', startGame);
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
          renderMissesReview({ container, items, onDone: renderIntro });
        });
      }
    }
  }

  renderIntro();
}
