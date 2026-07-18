import { getRefsByType, weightedSample, submitGradeForCardId } from '../../srs/queue.js';
import { renderExercise } from './exerciseRenderer.js';
import { gradeFromCorrectness } from '../../srs/engine.js';

const QUIZ_LENGTH = 15;

export async function render(container) {
  const refs = getRefsByType('grammar');
  if (refs.length === 0) {
    container.innerHTML = `<div class="view empty-state">No grammar exercises available yet. <a href="#/grammar">Back to grammar</a></div>`;
    return;
  }
  const picked = weightedSample(refs, Math.min(QUIZ_LENGTH, refs.length));
  let i = 0;
  let correct = 0;

  function paint() {
    if (i >= picked.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Quiz complete 🎉</h1>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${picked.length}</div><div class="label">Questions</div></div>
            <div class="stat-tile"><div class="value">${Math.round((correct / picked.length) * 100)}%</div><div class="label">Correct</div></div>
          </div>
          <a href="#/grammar" class="btn btn-primary btn-block">Back to grammar</a>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${i + 1} / ${picked.length} · Mixed grammar quiz</p>
        <div id="slot"></div>
      </div>`;
    const ref = picked[i];
    renderExercise({
      exercise: ref.content,
      container: container.querySelector('#slot'),
      onResult: (isCorrect, hintUsed) => {
        if (isCorrect) correct++;
        submitGradeForCardId(ref.cardId, gradeFromCorrectness(isCorrect, hintUsed));
        i++;
        paint();
      },
    });
  }

  paint();
}
