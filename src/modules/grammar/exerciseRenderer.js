// Shared exercise UI for all 5 grammar exercise types. Used by grammar unit
// practice, mixed grammar quiz, the daily review queue (grammar facet), and
// Test-me. Renders into `container`, calls onResult(correct) once the user
// has checked their answer and pressed Continue.

function normalize(str) {
  return String(str).trim().toLowerCase().replace(/[.!?]+$/, '');
}

function matchesAnswer(value, exercise) {
  const candidates = [exercise.answer, ...(exercise.altAnswers || [])].map(normalize);
  return candidates.includes(normalize(value));
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

function continueButton(container, correct, onResult) {
  const wrap = document.createElement('div');
  wrap.style.marginTop = '14px';
  wrap.innerHTML = `<button class="btn btn-primary btn-block">Continue</button>`;
  wrap.querySelector('button').addEventListener('click', () => onResult(correct), { once: true });
  container.appendChild(wrap);
}

function explanationBlock(exercise) {
  return `<p class="drill-sub" style="margin-top:10px;">${escapeHtml(exercise.explanation)}</p>`;
}

function renderFillBlank(exercise, container, onResult) {
  const parts = exercise.prompt.split('___');
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">Fill in the blank</div>
      <div style="font-size:1.15rem; margin:10px 0;">
        ${escapeHtml(parts[0] || '')}<input id="fb-input" type="text" style="width:140px; display:inline-block; margin:0 4px;" />${escapeHtml(parts[1] || '')}
      </div>
      <button class="btn btn-primary" id="fb-check">Check</button>
      <div id="fb-result"></div>
    </div>`;
  container.querySelector('#fb-check').addEventListener('click', () => {
    const input = container.querySelector('#fb-input');
    const correct = matchesAnswer(input.value, exercise);
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    input.disabled = true;
    container.querySelector('#fb-check').disabled = true;
    const resultEl = container.querySelector('#fb-result');
    resultEl.innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct answer: ${escapeHtml(exercise.answer)}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, onResult);
  });
}

function renderErrorSpot(exercise, container, onResult) {
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">Find and correct the error</div>
      <div class="drill-prompt" style="font-size:1.15rem;">${escapeHtml(exercise.prompt)}</div>
      <label for="es-input">Corrected sentence</label>
      <input id="es-input" type="text" />
      <button class="btn btn-primary" id="es-check" style="margin-top:10px;">Check</button>
      <div id="es-result"></div>
    </div>`;
  container.querySelector('#es-check').addEventListener('click', () => {
    const input = container.querySelector('#es-input');
    const correct = matchesAnswer(input.value, exercise);
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    input.disabled = true;
    container.querySelector('#es-check').disabled = true;
    container.querySelector('#es-result').innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct: ${escapeHtml(exercise.answer)}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, onResult);
  });
}

function renderMultipleChoice(exercise, container, onResult) {
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-prompt" style="font-size:1.15rem;">${escapeHtml(exercise.prompt)}</div>
      <div class="option-list">
        ${exercise.options.map((opt, i) => `<button class="option-btn" data-i="${i}">${escapeHtml(opt)}</button>`).join('')}
      </div>
      <div id="mc-result"></div>
    </div>`;
  const buttons = [...container.querySelectorAll('.option-btn')];
  buttons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const i = Number(btn.dataset.i);
        const correct = i === exercise.answerIndex;
        buttons.forEach((b) => (b.disabled = true));
        btn.classList.add(correct ? 'correct' : 'incorrect');
        if (!correct) buttons[exercise.answerIndex].classList.add('correct');
        container.querySelector('#mc-result').innerHTML = explanationBlock(exercise);
        continueButton(container, correct, onResult);
      },
      { once: true }
    );
  });
}

function renderReorder(exercise, container, onResult) {
  const pool = [...exercise.tokens];
  const answer = [];
  container.innerHTML = `
    <div class="drill-card" style="text-align:left; align-items:stretch;">
      <div class="drill-sub">${escapeHtml(exercise.prompt)}</div>
      <div class="token-answer" id="ro-answer"></div>
      <div class="token-pool" id="ro-pool"></div>
      <button class="btn btn-primary" id="ro-check">Check</button>
      <div id="ro-result"></div>
    </div>`;

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
    container.querySelectorAll('.token').forEach((t) => (t.style.pointerEvents = 'none'));
    container.querySelector('#ro-result').innerHTML = `<p style="color:${correct ? 'var(--good)' : 'var(--bad)'}; margin-top:8px;">${
      correct ? 'Correct!' : `Correct order: ${escapeHtml(exercise.answerOrder.join(' '))}`
    }</p>${explanationBlock(exercise)}`;
    continueButton(container, correct, onResult);
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
