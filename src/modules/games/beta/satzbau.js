// Satzbau (beta): build the sentence by tapping word tiles. Modes: Timed (60s, 90s) and Streak.
// Content: content/sentences/*.json. Checking: grammar/reorderChecker.js.
// Practice only: nothing here grades a card or touches SRS state. A finished
// round records one "game played" for the streak and, maybe, a best score.

import { t } from '../../../i18n.js';
import { getAllSentences } from '../../../db/contentLoader.js';
import { store } from '../../../db/storage.js';
import { escapeHtml } from '../../../components/gender.js';
import { checkReorderAnswer } from '../../grammar/reorderChecker.js';
import { createRoundTimer } from '../../shared/roundTimer.js';
import { getBest, recordBest } from '../../shared/gameBests.js';
import { renderGameEnd } from '../../shared/gameEnd.js';

const TIMED_DURATIONS = [60, 90];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EDGE_PUNCTUATION = /^[.,!?;:„"'()]+|[.,!?;:„"'()]+$/g;
const bare = (tok) => tok.replace(EDGE_PUNCTUATION, '').toLowerCase();

/** Tiles in random order, never already in an accepted order. */
function scrambledTiles(sentence) {
  const solved = new Set(sentence.answerOrders.map((o) => o.map(bare).join('\u0001')));
  let tiles = shuffle(sentence.tokens);
  for (let i = 0; i < 20 && solved.has(tiles.map(bare).join('\u0001')); i++) tiles = shuffle(sentence.tokens);
  return tiles;
}

/** The accepted order to show: the one the player built if correct, else the first. */
function orderToShow(sentence, submitted, correct) {
  if (correct) {
    const match = sentence.answerOrders.find((o) => checkReorderAnswer(submitted, { answerOrders: [o] }));
    if (match) return match.join(' ');
  }
  return sentence.answerOrders[0].join(' ');
}

export async function render(container) {
  let timer = null;
  let alive = true;

  function stopTimer() {
    if (timer) timer.stop();
    timer = null;
  }

  // --- Start screen ---
  function renderStart() {
    stopTimer();
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${t('gameSatzbauName')}</h1>
        <p class="page-subtitle">${t('sortingChooseMode')}</p>
        <div class="card" style="padding:0;">
          ${TIMED_DURATIONS.map((s) => {
            const best = getBest(`satzbau-timed-${s}`);
            return `
            <button class="list-item-btn" data-timed="${s}">
              <span>${s}s</span>
              <span class="page-subtitle" style="margin:0;">${best ? t('bestValue', best.score) : t('noBestYet')}</span>
            </button>`;
          }).join('')}
          <button class="list-item-btn" data-streak="1">
            <span>${t('streakNoTimer')}</span>
            <span class="page-subtitle" style="margin:0;">${getBest('satzbau-streak') ? t('bestStreakValue', getBest('satzbau-streak').streak) : t('noBestYet')}</span>
          </button>
        </div>
      </div>`;
    container.querySelectorAll('[data-timed]').forEach((btn) => btn.addEventListener('click', () => startTimed(Number(btn.dataset.timed))));
    container.querySelector('[data-streak]').addEventListener('click', startStreak);
  }

  /**
   * One sentence: tiles, Hint, Check, then the feedback panel (correct order + English) and a continue button.
   * onDone({ correct, hinted, shown }) runs when the player taps the continue button.
   */
  function playSentence({ sentence, headerHTML, continueLabel, onFeedback, onDone }) {
    const pool = scrambledTiles(sentence).map((text, id) => ({ text, id }));
    const answer = []; // { text, id, locked }
    let hinted = false;
    let checked = false;

    container.innerHTML = `
      <div class="view satzbau">
        ${headerHTML}
        <div class="drill-card" style="text-align:left; align-items:stretch;">
          <div class="drill-sub">${t('satzbauInstruction')}</div>
          <div class="token-answer" id="sb-answer"></div>
          <div class="token-pool" id="sb-pool"></div>
          <div class="btn-row" id="sb-actions">
            <button class="btn" id="sb-hint">${t('hintBtn')}</button>
            <button class="btn btn-primary" id="sb-check" disabled>${t('checkBtn')}</button>
          </div>
          <div id="sb-feedback"></div>
        </div>
      </div>`;

    const answerEl = container.querySelector('#sb-answer');
    const poolEl = container.querySelector('#sb-pool');
    const checkBtn = container.querySelector('#sb-check');
    const hintBtn = container.querySelector('#sb-hint');

    function paint() {
      poolEl.innerHTML = pool.map((tile, i) => `<button type="button" class="token" data-pool-i="${i}">${escapeHtml(tile.text)}</button>`).join('');
      answerEl.innerHTML = answer
        .map((tile, i) =>
          tile.locked
            ? `<span class="token locked">${escapeHtml(tile.text)}</span>`
            : `<button type="button" class="token" data-ans-i="${i}">${escapeHtml(tile.text)}</button>`
        )
        .join('');
      checkBtn.disabled = pool.length > 0 || checked;
      if (checked) return;
      poolEl.querySelectorAll('[data-pool-i]').forEach((el) =>
        el.addEventListener('click', () => {
          answer.push(pool.splice(Number(el.dataset.poolI), 1)[0]);
          paint();
        })
      );
      answerEl.querySelectorAll('[data-ans-i]').forEach((el) =>
        el.addEventListener('click', () => {
          pool.push(answer.splice(Number(el.dataset.ansI), 1)[0]);
          paint();
        })
      );
    }
    paint();

    // Hint: put the first word of the first accepted order at the start of the answer, locked.
    hintBtn.addEventListener('click', () => {
      if (hinted || checked) return;
      hinted = true;
      hintBtn.disabled = true;
      const first = bare(sentence.answerOrders[0][0]);
      let tile = null;
      let i = pool.findIndex((p) => bare(p.text) === first);
      if (i >= 0) tile = pool.splice(i, 1)[0];
      else {
        i = answer.findIndex((a) => bare(a.text) === first);
        if (i >= 0) tile = answer.splice(i, 1)[0];
      }
      if (tile) answer.unshift({ ...tile, locked: true });
      paint();
    });

    checkBtn.addEventListener('click', () => {
      if (checked || pool.length > 0) return;
      checked = true;
      const submitted = answer.map((a) => a.text);
      const correct = checkReorderAnswer(submitted, sentence);
      const shown = orderToShow(sentence, submitted, correct);
      paint();
      container.querySelector('#sb-actions').style.display = 'none';
      container.querySelector('#sb-feedback').innerHTML = `
        <p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; font-weight:700; margin:8px 0 4px;">${correct ? '✅ ' + t('correctExclaim') : '❌ ' + t('correctOrderValue', escapeHtml(shown))}</p>
        ${correct ? `<p style="margin:0 0 4px;">${escapeHtml(shown)}</p>` : ''}
        <p class="drill-sub" style="margin:0 0 12px;">${escapeHtml(sentence.translation_en)}</p>
        <button class="btn btn-primary btn-block" id="sb-continue">${continueLabel(correct)}</button>`;
      if (onFeedback) onFeedback(correct);
      container.querySelector('#sb-continue').addEventListener('click', () => onDone({ correct, hinted, shown }), { once: true });
    });
  }

  function endRows(rounds) {
    return rounds.map((r) => ({
      label: `${escapeHtml(r.shown)}${r.hinted ? ' 💡' : ''}`,
      ok: r.correct,
      correctLabel: '',
    }));
  }

  /** Round list in play order; the same sentence missed twice is practised once. */
  function uniqueMisses(rounds) {
    const seen = new Set();
    return rounds.filter((r) => {
      if (r.correct || seen.has(r.sentence.id)) return false;
      seen.add(r.sentence.id);
      return true;
    });
  }

  function practiceMisses(misses) {
    let i = 0;
    function next() {
      if (!alive) return;
      if (i >= misses.length) return renderStart();
      const { sentence } = misses[i];
      playSentence({
        sentence,
        headerHTML: `<p class="page-subtitle">${t('practicingYourMisses', i + 1, misses.length)}</p>`,
        continueLabel: () => (i + 1 >= misses.length ? t('backToGames') : t('nextBtn')),
        onDone: () => {
          i++;
          next();
        },
      });
    }
    next();
  }

  function sentenceQueue() {
    let queue = [];
    return () => {
      if (queue.length === 0) queue = shuffle(getAllSentences());
      return queue.pop();
    };
  }

  // --- Timed ---
  function startTimed(seconds) {
    stopTimer();
    const nextSentence = sentenceQueue();
    const rounds = [];
    let score = 0;
    let timeLeft = seconds;

    timer = createRoundTimer({
      seconds,
      onTick: (s) => {
        timeLeft = s;
        const el = container.querySelector('.time');
        if (el) el.textContent = `⏱️ ${s}s`;
      },
      onEnd: finish,
    });

    function nextRound() {
      if (!alive) return;
      const sentence = nextSentence();
      playSentence({
        sentence,
        headerHTML: `<div class="card-row">
          <span class="page-subtitle time" style="margin:0;">⏱️ ${timeLeft}s</span>
          <span class="page-subtitle" style="margin:0;">${t('correct')}: ${score}</span>
        </div>`,
        continueLabel: () => t('nextBtn'),
        onFeedback: () => timer && timer.pause(), // reading the answer and the English doesn't cost time
        onDone: ({ correct, hinted, shown }) => {
          rounds.push({ sentence, correct, hinted, shown });
          if (correct) score++;
          if (timer) timer.resume();
          nextRound();
        },
      });
    }

    function finish() {
      stopTimer();
      const isNewBest = recordBest(`satzbau-timed-${seconds}`, { score }, (e, prev) => e.score > 0 && (!prev || e.score > prev.score));
      store.recordDailyActivity('gamesPlayed');
      const misses = uniqueMisses(rounds);
      renderGameEnd({
        container,
        title: t('timesUp'),
        statTiles: [
          { value: score, label: t('correct') },
          { value: rounds.length - score, label: t('satzbauMissed') },
        ],
        isNewBest,
        rows: endRows(rounds),
        onPlayAgain: () => startTimed(seconds),
        missCount: misses.length,
        onPracticeMisses: () => practiceMisses(misses),
      });
    }

    timer.start();
    nextRound();
  }

  // --- Streak (no timer, ends on the first miss) ---
  function startStreak() {
    stopTimer();
    const nextSentence = sentenceQueue();
    const rounds = [];
    let streak = 0;

    function nextRound() {
      if (!alive) return;
      const sentence = nextSentence();
      playSentence({
        sentence,
        headerHTML: `<p class="page-subtitle">${t('streakColon', streak)}</p>`,
        continueLabel: (correct) => (correct ? t('nextBtn') : t('seeResultsBtn')),
        onDone: ({ correct, hinted, shown }) => {
          rounds.push({ sentence, correct, hinted, shown });
          if (correct) {
            streak++;
            nextRound();
          } else {
            finish();
          }
        },
      });
    }

    function finish() {
      const isNewBest = recordBest('satzbau-streak', { streak }, (e, prev) => e.streak > 0 && (!prev || e.streak > prev.streak));
      store.recordDailyActivity('gamesPlayed');
      const misses = uniqueMisses(rounds);
      renderGameEnd({
        container,
        title: t('streakEnded'),
        statTiles: [{ value: streak, label: t('streak') }],
        isNewBest,
        rows: endRows(rounds),
        onPlayAgain: startStreak,
        missCount: misses.length,
        onPracticeMisses: () => practiceMisses(misses),
      });
    }

    nextRound();
  }

  renderStart();

  return () => {
    alive = false;
    stopTimer();
  };
}
