import { getAllVocabWords } from '../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';
import { store } from '../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../components/gender.js';
import { resultsListHTML } from '../shared/resultsSummary.js';
import { renderMissesReview } from '../shared/missesReview.js';

const TIMED_DURATIONS = [30, 45, 60];
const WRONG_FLASH_MS = 950;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    const streakBest = bests['sorting-streak'];
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">der/die/das Sorting</h1>
        <p class="page-subtitle">Choose a mode.</p>
        <div class="card" style="padding:0;">
          ${TIMED_DURATIONS.map((s) => {
            const best = bests[`sorting-timed-${s}`];
            return `
            <button class="list-item-btn" data-timed="${s}">
              <span>${s}s</span>
              <span class="page-subtitle" style="margin:0;">${best ? `Best: ${best.score}` : 'No best yet'}</span>
            </button>`;
          }).join('')}
          <button class="list-item-btn" data-streak="1">
            <span>Streak (no timer)</span>
            <span class="page-subtitle" style="margin:0;">${streakBest ? `Best streak: ${streakBest.streak}` : 'No best yet'}</span>
          </button>
        </div>
      </div>`;
    container.querySelectorAll('[data-timed]').forEach((btn) => btn.addEventListener('click', () => startTimedGame(Number(btn.dataset.timed))));
    container.querySelector('[data-streak]').addEventListener('click', startStreakGame);
  }

  /** Shared question UI for both modes — differs only in the header line and what happens after an answer. */
  function paintWordPrompt(word, headerHTML, onPick) {
    container.innerHTML = `
      <div class="view">
        ${headerHTML}
        <div class="drill-card" id="drill-area">
          <div class="drill-prompt">${escapeHtml(word.lemma)}</div>
          <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
        </div>
        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-block" style="background:var(--der-bg); border-color:var(--der); color:var(--der);" data-g="der">der</button>
          <button class="btn btn-block" style="background:var(--die-bg); border-color:var(--die); color:var(--die);" data-g="die">die</button>
          <button class="btn btn-block" style="background:var(--das-bg); border-color:var(--das); color:var(--das);" data-g="das">das</button>
        </div>
        <button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">💡 Hint (shows meaning, not gender)</button>
      </div>`;
    let hintUsed = false;
    container.querySelectorAll('[data-g]').forEach((btn) => btn.addEventListener('click', () => onPick(btn.dataset.g, () => hintUsed), { once: true }));
    container.querySelector('#hint-btn').addEventListener(
      'click',
      (e) => {
        hintUsed = true;
        const panel = container.querySelector('#hint-panel');
        panel.textContent = word.meaning_en;
        panel.style.display = 'block';
        e.target.disabled = true;
      },
      { once: true }
    );
  }

  function notEnoughContent() {
    container.innerHTML = `<div class="view empty-state">Not enough nouns activated yet. Activate a vocab pack first.</div>`;
  }

  // --- Mode A: Timed ---
  function startTimedGame(seconds) {
    const nouns = shuffle(getAllVocabWords().filter((w) => w.pos === 'noun'));
    if (nouns.length < 5) return notEnoughContent();
    let idx = 0;
    let score = 0;
    let streak = 0;
    let bestStreak = 0;
    let timeLeft = seconds;
    let locked = false;
    const rounds = [];

    const currentWord = () => nouns[idx % nouns.length];

    function paint() {
      locked = false;
      const w = currentWord();
      paintWordPrompt(
        w,
        `<div class="card-row">
          <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
          <span class="page-subtitle" style="margin:0;">Score ${score} · Streak ${streak}</span>
        </div>`,
        (pick, getHintUsed) => onAnswer(pick, w, getHintUsed())
      );
    }

    function onAnswer(pick, word, hintUsed) {
      if (locked) return;
      const correct = pick === word.gender;
      submitGradeForCardId(vocabCardId(word.packId, word.id, 'gender'), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, correct });
      idx++;
      if (correct) {
        score++;
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        if (timeLeft > 0) paint();
      } else {
        streak = 0;
        locked = true;
        flashWrong(word);
      }
    }

    function flashWrong(word) {
      const area = container.querySelector('#drill-area');
      if (!area) return;
      area.innerHTML = `
        <div class="flash-wrong">
          <div class="flash-x">✗</div>
          <div class="correction-banner">${genderBadgeHTML(word.gender)} ${escapeHtml(word.lemma)}</div>
        </div>`;
      container.querySelectorAll('[data-g], #hint-btn').forEach((btn) => (btn.disabled = true));
      flashTimeoutId = setTimeout(() => {
        flashTimeoutId = null;
        if (timeLeft > 0) paint();
      }, WRONG_FLASH_MS);
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
      const bestKey = `sorting-timed-${seconds}`;
      const best = stats.gameBests[bestKey];
      const isNewBest = !best || score > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, [bestKey]: { score, streak: bestStreak } } });
      store.recordDailyActivity('gamesPlayed');
      renderRoundResults({
        title: "Time's up! ⏱️",
        statTiles: [
          { value: score, label: 'Correct' },
          { value: bestStreak, label: 'Best streak' },
        ],
        isNewBest,
        rounds,
        onPlayAgain: () => startTimedGame(seconds),
      });
    }
  }

  // --- Mode B: Streak (no timer, ends on first miss) ---
  function startStreakGame() {
    const nouns = shuffle(getAllVocabWords().filter((w) => w.pos === 'noun'));
    if (nouns.length < 5) return notEnoughContent();
    let idx = 0;
    let streak = 0;
    const rounds = [];

    const currentWord = () => nouns[idx % nouns.length];

    function paint() {
      const w = currentWord();
      paintWordPrompt(w, `<p class="page-subtitle">Streak: ${streak}</p>`, (pick, getHintUsed) => onAnswer(pick, w, getHintUsed()));
    }

    function onAnswer(pick, word, hintUsed) {
      const correct = pick === word.gender;
      submitGradeForCardId(vocabCardId(word.packId, word.id, 'gender'), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, correct });
      idx++;
      if (correct) {
        streak++;
        paint();
      } else {
        finish();
      }
    }

    paint();

    function finish() {
      const stats = store.getStats();
      const best = stats.gameBests['sorting-streak'];
      const isNewBest = !best || streak > best.streak;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, 'sorting-streak': { streak } } });
      store.recordDailyActivity('gamesPlayed');
      renderRoundResults({
        title: 'Streak ended',
        statTiles: [{ value: streak, label: 'Streak' }],
        isNewBest,
        rounds,
        onPlayAgain: startStreakGame,
      });
    }
  }

  // Shared end-of-round screen: every word in the round, right or wrong, with its correct gender.
  function renderRoundResults({ title, statTiles, isNewBest, rounds, onPlayAgain }) {
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
      correctLabel: `${genderBadgeHTML(r.word.gender)} ${escapeHtml(r.word.lemma)}`,
    }));

    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${title}</h1>
        <div class="stat-grid">
          ${statTiles.map((t) => `<div class="stat-tile"><div class="value">${t.value}</div><div class="label">${t.label}</div></div>`).join('')}
        </div>
        ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best!</p>` : ''}
        ${resultsListHTML(rows)}
        <div class="btn-row" style="margin-top:16px;">
          <a href="#/games" class="btn">Back to games</a>
          <button class="btn" id="again">Play again</button>
          ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Practice my misses (${misses.length})</button>` : ''}
        </div>
      </div>`;
    container.querySelector('#again').addEventListener('click', onPlayAgain);
    const missBtn = container.querySelector('#practice-misses');
    if (missBtn) {
      missBtn.addEventListener('click', () => {
        const items = misses.map((r) => ({
          type: 'vocab',
          facet: 'gender',
          sourceId: r.word.packId,
          itemId: r.word.id,
          cardId: vocabCardId(r.word.packId, r.word.id, 'gender'),
          content: r.word,
        }));
        renderMissesReview({ container, items, onDone: renderOptions });
      });
    }
  }

  renderOptions();

  return () => clearTimers();
}
