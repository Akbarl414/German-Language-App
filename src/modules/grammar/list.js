import { getGrammarUnits } from '../../db/contentLoader.js';
import { t } from '../../i18n.js';

export async function render(container) {
  const units = getGrammarUnits();
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('grammarTitle')}</h1>
      <p class="page-subtitle">${units.length} units from your lessons.</p>
      <div class="btn-row" style="margin-bottom:16px;">
        <a href="#/grammar/quiz" class="btn btn-primary">${t('mixedQuiz')}</a>
      </div>
      <div class="card" style="padding:0;">
        ${units
          .map(
            (u) => `
          <a class="list-item" style="padding:14px 16px; display:block;" href="#/grammar/unit/${u.id}">
            <div style="font-weight:700;">${u.title}</div>
            <div class="page-subtitle" style="margin:2px 0 0;">${u.level} · ${u.exercises.length} exercises</div>
            ${u.summary ? `<div style="font-size:0.88rem; color:var(--text-dim); margin-top:4px;">${u.summary}</div>` : ''}
          </a>`
          )
          .join('')}
      </div>
    </div>`;
}
