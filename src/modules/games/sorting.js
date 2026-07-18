import { getAllVocabWords } from '../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';
import { store } from '../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../components/gender.js';
import { resultsListHTML } from '../shared/resultsSummary.js';
import { renderMissesReview } from '../shared/missesReview.js';

const ROUND_SECONDS = 45;

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

  function renderIntro() {
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">der/die/das Sorting</h1>
        <p class="page-subtitle">${ROUND_SECONDS}s. Tap the right bucket as fast as you can.</p>
        <button class="btn btn-primary btn-block" id="start">Start</button>
      </div>`;
    container.querySelector('#start').addEventListener('click', startGame);
  }

  function startGame() {
    const nouns = shuffle(getAllVocabWords().filter((w) => w.pos === 'noun'));
    if (nouns.length < 5) {
      container.innerHTML = `<div class="view empty-state">Not enough nouns activated yet. Activate a vocab pack first.</div>`;
      return;
    }
    let idx = 0;
    let score = 0;
    let streak = 0;
    let bestStreak = 0;
    let timeLeft = ROUND_SECONDS;
    const rounds = []; // { word, chosenGender, correct }
    let hintUsed = false;

    function currentWord() {
      return nouns[idx % nouns.length];
    }

    function paint() {
      const w = currentWord();
      hintUsed = false;
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
            <span class="page-subtitle" style="margin:0;">Score ${score} · Streak ${streak}</span>
          </div>
          <div class="drill-card">
            <div class="drill-prompt">${escapeHtml(w.lemma)}</div>
            <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
          </div>
          <div class="btn-row" style="margin-top:16px;">
            <button class="btn btn-block" style="background:var(--der-bg); border-color:var(--der); color:var(--der);" data-g="der">der</button>
            <button class="btn btn-block" style="background:var(--die-bg); border-color:var(--die); color:var(--die);" data-g="die">die</button>
            <button class="btn btn-block" style="background:var(--das-bg); border-color:var(--das); color:var(--das);" data-g="das">das</button>
          </div>
          <button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">💡 Hint (shows meaning, not gender)</button>
        </div>`;
      container.querySelectorAll('[data-g]').forEach((btn) => btn.addEventListener('click', () => onAnswer(btn.dataset.g, w), { once: true }));
      container.querySelector('#hint-btn').addEventListener(
        'click',
        (e) => {
          hintUsed = true;
          const panel = container.querySelector('#hint-panel');
          panel.textContent = w.meaning_en;
          panel.style.display = 'block';
          e.target.disabled = true;
        },
        { once: true }
      );
    }

    function onAnswer(pick, word) {
      const correct = pick === word.gender;
      submitGradeForCardId(vocabCardId(word.packId, word.id, 'gender'), gradeFromCorrectness(correct, hintUsed));
      rounds.push({ word, chosenGender: pick, correct });
      if (correct) {
        score++;
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
      idx++;
      if (timeLeft > 0) paint();
    }

    timerId = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timerId);
        timerId = null;
        finish(score, bestStreak, rounds);
      } else {
        const timeEl = container.querySelector('.time');
        if (timeEl) timeEl.textContent = `⏱️ ${timeLeft}s`;
      }
    }, 1000);

    paint();

    function finish(finalScore, finalBestStreak, finalRounds) {
      const stats = store.getStats();
      const best = stats.gameBests.sorting;
      const isNewBest = !best || finalScore > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, sorting: { score: finalScore, streak: finalBestStreak } } });
      store.recordDailyActivity('gamesPlayed');

      const seenMissIds = new Set();
      const misses = finalRounds.filter((r) => {
        if (r.correct) return false;
        const key = `${r.word.packId}::${r.word.id}`;
        if (seenMissIds.has(key)) return false;
        seenMissIds.add(key);
        return true;
      });
      const rows = finalRounds.map((r) => ({
        label: escapeHtml(r.word.lemma),
        ok: r.correct,
        correctLabel: r.correct ? '' : `${genderBadgeHTML(r.word.gender)} ${escapeHtml(r.word.lemma)}`,
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Time's up! ⏱️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${finalScore}</div><div class="label">Correct</div></div>
            <div class="stat-tile"><div class="value">${finalBestStreak}</div><div class="label">Best streak</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best score!</p>` : ''}
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
            facet: 'gender',
            sourceId: r.word.packId,
            itemId: r.word.id,
            cardId: vocabCardId(r.word.packId, r.word.id, 'gender'),
            content: r.word,
          }));
          renderMissesReview({ container, items, onDone: renderIntro });
        });
      }
    }
  }

  renderIntro();

  return () => {
    if (timerId) clearInterval(timerId);
  };
}
