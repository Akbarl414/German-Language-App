import { findGrammarUnit } from '../../db/contentLoader.js';
import { renderExercise } from './exerciseRenderer.js';
import { grammarCardId, submitGradeForCardId } from '../../srs/queue.js';
import { gradeFromCorrectness } from '../../srs/engine.js';

export async function render(container, { unitId }) {
  const unit = findGrammarUnit(unitId);
  if (!unit) {
    container.innerHTML = `<div class="view empty-state">Unit not found. <a href="#/grammar">Back to grammar</a></div>`;
    return;
  }
  const exercises = unit.exercises;
  let i = 0;
  let correct = 0;

  function paint() {
    if (i >= exercises.length) {
      container.innerHTML = `
        <div class="view">
          <h1 class="page-title">Nice work 🎉</h1>
          <p class="page-subtitle">${unit.title}</p>
          <div class="stat-grid">
            <div class="stat-tile"><div class="value">${exercises.length}</div><div class="label">Exercises</div></div>
            <div class="stat-tile"><div class="value">${Math.round((correct / exercises.length) * 100)}%</div><div class="label">Correct</div></div>
          </div>
          <div class="btn-row">
            <a href="#/grammar/unit/${unit.id}" class="btn">Back to unit</a>
            <a href="#/grammar" class="btn btn-primary">All units</a>
          </div>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="view">
        <p class="page-subtitle">${i + 1} / ${exercises.length} · ${unit.title}</p>
        <div id="slot"></div>
      </div>`;
    const exercise = exercises[i];
    renderExercise({
      exercise,
      container: container.querySelector('#slot'),
      onResult: (isCorrect, hintUsed) => {
        if (isCorrect) correct++;
        submitGradeForCardId(grammarCardId(unit.id, exercise.id), gradeFromCorrectness(isCorrect, hintUsed));
        i++;
        paint();
      },
    });
  }

  paint();
}
