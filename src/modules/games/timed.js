import { getAllVocabWords } from '../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';
import { store } from '../../db/storage.js';
import { nounHTML, escapeHtml } from '../../components/gender.js';

const ROUND_SECONDS = 60;

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
        <h1 class="page-title">Timed Challenge</h1>
        <p class="page-subtitle">${ROUND_SECONDS}s. Pick the right meaning as fast as you can.</p>
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
    let streak = 0;
    let bestStreak = 0;
    let timeLeft = ROUND_SECONDS;

    function nextQuestion() {
      const [target, ...rest] = shuffle(words);
      const distractors = shuffle(rest.filter((w) => w.meaning_en !== target.meaning_en)).slice(0, 3);
      const options = shuffle([target, ...distractors]);
      return { target, options };
    }

    function paint() {
      const { target, options } = nextQuestion();
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
            <span class="page-subtitle" style="margin:0;">Score ${score} · Streak ${streak}</span>
          </div>
          <div class="drill-card">
            <div class="drill-prompt">${target.pos === 'noun' ? nounHTML(target) : escapeHtml(target.lemma)}</div>
          </div>
          <div class="option-list">
            ${options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(o.meaning_en)}</button>`).join('')}
          </div>
        </div>`;
      container.querySelectorAll('[data-i]').forEach((btn) =>
        btn.addEventListener(
          'click',
          () => {
            const opt = options[Number(btn.dataset.i)];
            const correct = opt.id === target.id && opt.packId === target.packId;
            submitGradeForCardId(vocabCardId(target.packId, target.id, 'meaning_de_en'), gradeFromCorrectness(correct));
            if (correct) {
              score++;
              streak++;
              bestStreak = Math.max(bestStreak, streak);
            } else {
              streak = 0;
            }
            if (timeLeft > 0) paint();
          },
          { once: true }
        )
      );
    }

    timerId = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timerId);
        timerId = null;
        finish(score, bestStreak);
      } else {
        const timeEl = container.querySelector('.time');
        if (timeEl) timeEl.textContent = `⏱️ ${timeLeft}s`;
      }
    }, 1000);

    paint();

    function finish(finalScore, finalBestStreak) {
      const stats = store.getStats();
      const best = stats.gameBests.timed;
      const isNewBest = !best || finalScore > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, timed: { score: finalScore, streak: finalBestStreak } } });
      store.recordDailyActivity('gamesPlayed');
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Time's up! ⏱️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${finalScore}</div><div class="label">Correct</div></div>
            <div class="stat-tile"><div class="value">${finalBestStreak}</div><div class="label">Best streak</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">New best score!</p>` : ''}
          <div class="btn-row">
            <a href="#/games" class="btn">Back to games</a>
            <button class="btn btn-primary" id="again">Play again</button>
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', startGame);
    }
  }

  renderIntro();

  return () => {
    if (timerId) clearInterval(timerId);
  };
}
