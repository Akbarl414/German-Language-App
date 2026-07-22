import { getAllVocabWords } from '../../db/contentLoader.js';
import { vocabCardId, submitGradeForCardId } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';
import { store } from '../../db/storage.js';
import { escapeHtml, genderBadgeHTML } from '../../components/gender.js';
import { resultsListHTML } from '../shared/resultsSummary.js';
import { renderMissesReview } from '../shared/missesReview.js';

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
    const rounds = []; // { word, correct }
    let hintUsed = false;

    function nextQuestion() {
      const [target, ...rest] = shuffle(words);
      const distractors = shuffle(rest.filter((w) => w.meaning_en !== target.meaning_en)).slice(0, 3);
      const options = shuffle([target, ...distractors]);
      return { target, options };
    }

    function paint() {
      const { target, options } = nextQuestion();
      hintUsed = false;
      container.innerHTML = `
        <div class="view">
          <div class="card-row">
            <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
            <span class="page-subtitle" style="margin:0;">Punkte ${score} · Serie ${streak}</span>
          </div>
          <div class="drill-card">
            <div class="drill-prompt">${escapeHtml(target.lemma)}</div>
            <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>
          </div>
          <div class="option-list">
            ${options.map((o, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(o.meaning_en)}</button>`).join('')}
          </div>
          ${target.pos === 'noun' || target.pos === 'verb' ? `<button class="btn btn-sm" id="hint-btn" style="margin-top:10px;">💡 Tipp</button>` : ''}
        </div>`;
      container.querySelectorAll('[data-i]').forEach((btn) =>
        btn.addEventListener(
          'click',
          () => {
            const opt = options[Number(btn.dataset.i)];
            const correct = opt.id === target.id && opt.packId === target.packId;
            submitGradeForCardId(vocabCardId(target.packId, target.id, 'meaning_de_en'), gradeFromCorrectness(correct, hintUsed));
            rounds.push({ word: target, correct });
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
      const hintBtn = container.querySelector('#hint-btn');
      if (hintBtn) {
        hintBtn.addEventListener(
          'click',
          (e) => {
            hintUsed = true;
            const panel = container.querySelector('#hint-panel');
            panel.innerHTML = target.pos === 'noun' ? `${genderBadgeHTML(target.gender)} plural: ${escapeHtml(target.plural)}` : escapeHtml(target.present_3sg);
            panel.style.display = 'block';
            e.target.disabled = true;
          },
          { once: true }
        );
      }
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
      const best = stats.gameBests.timed;
      const isNewBest = !best || finalScore > best.score;
      if (isNewBest) store.updateStats({ gameBests: { ...stats.gameBests, timed: { score: finalScore, streak: finalBestStreak } } });
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
        label: r.word.pos === 'noun' ? `${genderBadgeHTML(r.word.gender)} ${escapeHtml(r.word.lemma)}` : escapeHtml(r.word.lemma),
        ok: r.correct,
        correctLabel: escapeHtml(r.word.meaning_en), // shown for every row, right or wrong
      }));

      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Zeit abgelaufen! ⏱️</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${finalScore}</div><div class="label">Richtig</div></div>
            <div class="stat-tile"><div class="value">${finalBestStreak}</div><div class="label">Beste Serie</div></div>
          </div>
          ${isNewBest ? `<p style="color:var(--good); text-align:center;">Neue Bestpunktzahl!</p>` : ''}
          ${resultsListHTML(rows)}
          <div class="btn-row" style="margin-top:16px;">
            <a href="#/games" class="btn">Zurück zu den Spielen</a>
            <button class="btn" id="again">Nochmal spielen</button>
            ${misses.length > 0 ? `<button class="btn btn-primary" id="practice-misses">Meine Fehler üben (${misses.length})</button>` : ''}
          </div>
        </div>`;
      container.querySelector('#again').addEventListener('click', startGame);
      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          const items = misses.map((r) => ({
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

  return () => {
    if (timerId) clearInterval(timerId);
  };
}
