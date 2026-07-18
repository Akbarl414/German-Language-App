import { getAllVocabWords, getAllPhrases } from '../../db/contentLoader.js';
import { vocabCardId, phraseCardId, submitGradeForCardId } from '../../srs/queue.js';
import { Grade } from '../../srs/engine.js';
import { nounHTML, escapeHtml } from '../../components/gender.js';
import { store } from '../../db/storage.js';
import { resultsListHTML } from '../shared/resultsSummary.js';

const PAIR_COUNT = 6;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPairs(mode) {
  if (mode === 'words') {
    const words = shuffle(getAllVocabWords()).slice(0, PAIR_COUNT);
    return words.map((w) => ({
      id: `${w.packId}::${w.id}`,
      left: w.pos === 'noun' ? nounHTML(w) : escapeHtml(w.lemma),
      right: escapeHtml(w.meaning_en),
      cardId: vocabCardId(w.packId, w.id, 'meaning_de_en'),
    }));
  }
  if (mode === 'verbs') {
    const verbs = shuffle(getAllVocabWords().filter((w) => w.pos === 'verb')).slice(0, PAIR_COUNT);
    return verbs.map((w) => ({
      id: `${w.packId}::${w.id}`,
      left: escapeHtml(w.lemma),
      right: escapeHtml(w.perfekt),
      cardId: vocabCardId(w.packId, w.id, 'principal_parts'),
    }));
  }
  // idioms
  const phrases = shuffle(getAllPhrases()).slice(0, PAIR_COUNT);
  return phrases.map((p) => ({
    id: `${p.setId}::${p.id}`,
    left: escapeHtml(p.phrase),
    right: escapeHtml(p.situation.length > 70 ? p.situation.slice(0, 67) + '…' : p.situation),
    cardId: phraseCardId(p.setId, p.id, 'situation_to_phrase'),
  }));
}

export async function render(container) {
  let pendingTimeout = null;

  function renderModeSelect() {
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Matching</h1>
        <p class="page-subtitle">Flip two cards to find a pair.</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-mode="words">Word ↔ Meaning</button>
          <button class="btn btn-primary" data-mode="verbs">Verb ↔ Perfekt</button>
          <button class="btn btn-primary" data-mode="idioms">Idiom ↔ Situation</button>
        </div>
      </div>`;
    container.querySelectorAll('[data-mode]').forEach((btn) =>
      btn.addEventListener('click', () => startGame(btn.dataset.mode))
    );
  }

  function startGame(mode, customPairs) {
    const pairs = customPairs || buildPairs(mode);
    if (pairs.length < 3) {
      container.innerHTML = `<div class="view empty-state">Not enough content for this mode yet.</div>`;
      setTimeout(renderModeSelect, 1500);
      return;
    }
    const tiles = shuffle(
      pairs.flatMap((p) => [
        { tileId: `${p.id}-L`, pairId: p.id, label: p.left },
        { tileId: `${p.id}-R`, pairId: p.id, label: p.right },
      ])
    );
    const struggled = new Set();
    let flipped = [];
    let matchedCount = 0;
    let moves = 0;
    const startTime = Date.now();

    function paintGrid() {
      container.innerHTML = `
        <div class="view">
          <p class="page-subtitle">${matchedCount} / ${pairs.length} pairs · ${moves} moves</p>
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
            ${tiles
              .map(
                (t) => `
              <button class="option-btn tile" data-tile="${t.tileId}" style="min-height:64px; ${t.matched ? 'background:rgba(67,160,71,0.22); border-color:var(--good); pointer-events:none;' : ''} ${t.shown || t.matched ? '' : 'font-size:1.3rem; text-align:center;'}">
                ${t.shown || t.matched ? t.label : '🂠'}
              </button>`
              )
              .join('')}
          </div>
        </div>`;
      container.querySelectorAll('[data-tile]').forEach((btn) =>
        btn.addEventListener('click', () => onFlip(btn.dataset.tile))
      );
    }

    function onFlip(tileId) {
      if (pendingTimeout) return; // resolving a mismatch, ignore taps
      const tile = tiles.find((t) => t.tileId === tileId);
      if (!tile || tile.shown || tile.matched) return;
      tile.shown = true;
      flipped.push(tile);
      paintGrid();
      if (flipped.length === 2) {
        moves++;
        const [a, b] = flipped;
        if (a.pairId === b.pairId) {
          a.matched = b.matched = true;
          matchedCount++;
          const grade = struggled.has(a.pairId) ? Grade.AGAIN : Grade.GOOD;
          const pair = pairs.find((p) => p.id === a.pairId);
          submitGradeForCardId(pair.cardId, grade);
          flipped = [];
          if (matchedCount === pairs.length) {
            pendingTimeout = setTimeout(() => finish(moves, Date.now() - startTime), 400);
          } else {
            paintGrid();
          }
        } else {
          struggled.add(a.pairId);
          struggled.add(b.pairId);
          pendingTimeout = setTimeout(() => {
            a.shown = b.shown = false;
            flipped = [];
            pendingTimeout = null;
            paintGrid();
          }, 700);
        }
      }
    }

    paintGrid();

    function finish(moveCount, ms) {
      pendingTimeout = null;
      const seconds = Math.round(ms / 1000);
      const isPracticeRound = !!customPairs;
      let isNewBest = false;
      if (!isPracticeRound) {
        const stats = store.getStats();
        const bestKey = `matching-${mode}`;
        const best = stats.gameBests[bestKey];
        isNewBest = !best || moveCount < best.moves;
        if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, [bestKey]: { moves: moveCount, seconds } } });
      }
      store.recordDailyActivity('gamesPlayed');

      const missedPairs = pairs.filter((p) => struggled.has(p.id));
      const rows = pairs.map((p) => ({
        label: `${p.left} ↔ ${p.right}`,
        ok: !struggled.has(p.id),
        correctLabel: '',
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Matched! 🎉</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${moveCount}</div><div class="label">Moves</div></div>
            <div class="stat-tile"><div class="value">${seconds}s</div><div class="label">Time</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Back to games</a>
            <button class="btn" id="again">Play again</button>
            ${missedPairs.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Practice my misses (${missedPairs.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', renderModeSelect);
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) missBtn.addEventListener('click', () => startGame(mode, missedPairs));
    }
  }

  renderModeSelect();

  return () => {
    if (pendingTimeout) clearTimeout(pendingTimeout);
  };
}
