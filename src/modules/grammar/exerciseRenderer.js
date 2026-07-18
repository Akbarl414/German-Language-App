// Shared exercise UI for all 5 grammar exercise types. Used by grammar unit
// practice, mixed grammar quiz, the daily review queue (grammar facet), and
// Test-me. Renders into `container`, calls onResult(correct, hintUsed) once
// the user has checked their answer and pressed Continue.
//
// German-first mode: many authored prompts end in a parenthetical grammar
// cue, e.g. "Das Buch liegt auf ___ Tisch. (wo?)" — that cue is stripped
// from the default display and only shown via the Hint button, so the
// learner sees the bare German sentence first. Exercises without an
// authored cue (or an explicit `exercise.hint`) get a generic, type-specific
// fallback hint that never reveals the answer outright. Using a hint caps
// the eventual SRS grade at Hard (see gradeFromCorrectness).

function normalize(str) {
  return String(str).trim().toLowerCase().replace(/[.!?]+$/, '');
}

function matchesAnswer(value, exercise) {
  const candidates = [exercise.answer, ...(exercise.altAnswers || [])].map(normalize);
  return candidates.includes(normalize(value));
}

// Extracts a trailing "(...)" grammar cue from a prompt, e.g.
// "... auf ___ Tisch. (wo?)" -> { displayPrompt: "... auf ___ Tisch.", hintText: "wo?" }
function splitHint(prompt) {
  const m = prompt.match(/\s*\(([^)]*)\)\s*$/);
  if (!m) return { displayPrompt: prompt, hintText: null };
  return { displayPrompt: prompt.slice(0, m.index).trimEnd(), hintText: m[1] };
}

// An explicit `exercise.hint` (used for synthetically-built exercises, e.g.
// the vocab gender drill) always wins over a parsed parenthetical.
function resolveHint(exercise) {
  if (exercise.hint) return { displayPrompt: exercise.prompt, hintText: exercise.hint };
  return splitHint(exercise.prompt);
}

export function renderExercise({ exercise, container, onResult }) {
  const html = {
    'fill-blank': renderFillBlank,
    'error-spot': renderErrorSpot,
    'multiple-choice': renderMultipleChoice,
    'choose-form': renderMultipleChoice,
    reorder: renderReorder,
  }[exercise.type];
  if (!html) {
    container.innerHTML = `<p>Unsupported exercise type: ${exercise.type}</p>`;
    return;
  }
  html(exercise, container, onResult);
}

function continueButton(container, correct, hintUsed, onResult) {
  const wrap = document.createElement('div');
  wrap.style.marginTop = '14px';
  wrap.innerHTML = `<button class="btn btn-primary btn-block">Continue</button>`;
  wrap.querySelector('button').addEventListener('click', () => onResult(correct, hintUsed), { once: true });
  container.appendChild(wrap);
}

function explanationBlock(exercise) {
  return `<p class="drill-sub" style="margin-top:10px;">${escapeHtml(exercise.explanation)}</p>`;
}

function hintControlsHTML() {
  return `<button type="button" class="btn btn-sm" id="hint-btn">💡 Hint</button>
    <div id="hint-panel" class="drill-sub" style="display:none; margin-top:8px;"></div>`;
}

/** Wires a Hint button; `fallback()` supplies hint text/side-effects when no authored hint exists. Returns a getter for whether it was used. */
function wireHint(container, hintText, fallback) {
  let used = false;
  const btn = container.querySelector('#hint-btn');
  const panel = container.querySelector('#hint-panel');
  btn.addEventListener(
    'click',
    () => {
      used = true;
      panel.textContent = hintText || fallback();
      panel.style.display = 'block';
      btn.disabled = true;
    },
    { once: true }
  );
  return {
    isUsed: () => used,
    disable: () => {
      btn.disabled = true;
    },
  };
}

function renderFillBlank(exercise, container, onResult) {
  const { displayPrompt, hintText } = resolveHint(exercise);
  const parts = displayPrompt.split('___');
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">Fill in the blank</div>
      <div style="font-size:1.15rem; margin:10px 0;">
        ${escapeHtml(parts[0] || '')}<input id="fb-input" type="text" style="width:140px; display:inline-block; margin:0 4px;" />${escapeHtml(parts[1] || '')}
      </div>
      <div class="btn-row">
        ${hintControlsHTML()}
        <button class="btn btn-primary" id="fb-check">Check</button>
      </div>
      <div id="fb-result"></div>
    </div>`;

  const hint = wireHint(container, hintText, () => {
    const first = exercise.answer.trim()[0] || '?';
    return `Starts with "${first}" · ${exercise.answer.trim().length} letters`;
  });

  container.querySelector('#fb-check').addEventListener('click', () => {
    const input = container.querySelector('#fb-input');
    const correct = matchesAnswer(input.value, exercise);
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    input.disabled = true;
    container.querySelector('#fb-check').disabled = true;
    hint.disable();
    const resultEl = container.querySelector('#fb-result');
    resultEl.innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct answer: ${escapeHtml(exercise.answer)}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, hint.isUsed(), onResult);
  });
}

function renderErrorSpot(exercise, container, onResult) {
  const { displayPrompt, hintText } = resolveHint(exercise);
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">Find and correct the error</div>
      <div class="drill-prompt" style="font-size:1.15rem;">${escapeHtml(displayPrompt)}</div>
      <label for="es-input">Corrected sentence</label>
      <input id="es-input" type="text" />
      <div class="btn-row" style="margin-top:10px;">
        ${hintControlsHTML()}
        <button class="btn btn-primary" id="es-check">Check</button>
      </div>
      <div id="es-result"></div>
    </div>`;

  const hint = wireHint(container, hintText, () => {
    const a = displayPrompt.replace(/[.!?]+$/, '').split(' ');
    const b = exercise.answer.replace(/[.!?]+$/, '').split(' ');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) return `Look closely at word #${i + 1}.`;
    }
    return 'Check the sentence carefully.';
  });

  container.querySelector('#es-check').addEventListener('click', () => {
    const input = container.querySelector('#es-input');
    const correct = matchesAnswer(input.value, exercise);
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    input.disabled = true;
    container.querySelector('#es-check').disabled = true;
    hint.disable();
    container.querySelector('#es-result').innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct: ${escapeHtml(exercise.answer)}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, hint.isUsed(), onResult);
  });
}

function renderMultipleChoice(exercise, container, onResult) {
  const { displayPrompt, hintText } = resolveHint(exercise);
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-prompt" style="font-size:1.15rem;">${escapeHtml(displayPrompt)}</div>
      <div class="option-list">
        ${exercise.options.map((opt, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(opt)}</button>`).join('')}
      </div>
      ${hintControlsHTML()}
      <div id="mc-result"></div>
    </div>`;
  const buttons = [...container.querySelectorAll('.option-btn')];

  const hint = wireHint(container, hintText, () => {
    const wrongIndices = buttons.map((_, i) => i).filter((i) => i !== exercise.answerIndex && !buttons[i].disabled);
    if (wrongIndices.length < 2) return 'No further hint available.';
    const idx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    buttons[idx].disabled = true;
    buttons[idx].style.opacity = '0.4';
    buttons[idx].style.textDecoration = 'line-through';
    return 'Eliminated one incorrect option.';
  });

  buttons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const i = Number(btn.dataset.i);
        const correct = i === exercise.answerIndex;
        buttons.forEach((b) => (b.disabled = true));
        btn.classList.add(correct ? 'correct' : 'incorrect');
        if (!correct) buttons[exercise.answerIndex].classList.add('correct');
        hint.disable();
        container.querySelector('#mc-result').innerHTML = explanationBlock(exercise);
        continueButton(container, correct, hint.isUsed(), onResult);
      },
      { once: true }
    );
  });
}

function renderReorder(exercise, container, onResult) {
  const { displayPrompt, hintText } = resolveHint(exercise);
  const pool = [...exercise.tokens];
  const answer = [];
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">${escapeHtml(displayPrompt)}</div>
      <div class="token-answer" id="ro-answer"></div>
      <div class="token-pool" id="ro-pool"></div>
      <div class="btn-row">
        ${hintControlsHTML()}
        <button class="btn btn-primary" id="ro-check">Check</button>
      </div>
      <div id="ro-result"></div>
    </div>`;

  const hint = wireHint(container, hintText, () => `Starts with: "${exercise.answerOrder[0]}"`);

  function paint() {
    container.querySelector('#ro-pool').innerHTML = pool.map((t, i) => `<span class="token" data-pool-i="${i}">${escapeHtml(t)}</span>`).join('');
    container.querySelector('#ro-answer').innerHTML = answer.map((t, i) => `<span class="token" data-ans-i="${i}">${escapeHtml(t)}</span>`).join('');
    container.querySelectorAll('[data-pool-i]').forEach((el) =>
      el.addEventListener('click', () => {
        const i = Number(el.dataset.poolI);
        answer.push(pool.splice(i, 1)[0]);
        paint();
      })
    );
    container.querySelectorAll('[data-ans-i]').forEach((el) =>
      el.addEventListener('click', () => {
        const i = Number(el.dataset.ansI);
        pool.push(answer.splice(i, 1)[0]);
        paint();
      })
    );
  }
  paint();

  container.querySelector('#ro-check').addEventListener('click', () => {
    const correct = answer.join(' | ') === exercise.answerOrder.join(' | ');
    container.querySelector('#ro-check').disabled = true;
    hint.disable();
    container.querySelectorAll('.token').forEach((t) => (t.style.pointerEvents = 'none'));
    container.querySelector('#ro-result').innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct order: ${escapeHtml(exercise.answerOrder.join(' '))}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, hint.isUsed(), onResult);
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
