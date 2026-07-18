import { findGrammarUnit } from '../../db/contentLoader.js';

export async function render(container, { unitId }) {
  const unit = findGrammarUnit(unitId);
  if (!unit) {
    container.innerHTML = `<div class="view empty-state">Unit not found. <a href="#/grammar">Back to grammar</a></div>`;
    return;
  }

  container.innerHTML = `
    <div class="view">
      <a href="#/grammar" class="page-subtitle">&larr; Grammar</a>
      <h1 class="page-title">${unit.title}</h1>
      <p class="page-subtitle">${unit.level}</p>

      ${unit.explanation.sections.map(sectionHTML).join('')}

      <a href="#/grammar/unit/${unit.id}/practice" class="btn btn-primary btn-block" style="margin-top:8px;">
        Practice this unit (${unit.exercises.length} exercises)
      </a>
    </div>`;
}

function sectionHTML(section) {
  const body = section.body
    .split('\n')
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  const table = section.table
    ? `<div style="overflow-x:auto;"><table class="grammar-table">
        <thead><tr>${section.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${section.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`
    : '';
  return `
    <div class="card">
      <h2 style="margin:0 0 8px; font-size:1.1rem;">${escapeHtml(section.heading)}</h2>
      ${body}
      ${table}
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
