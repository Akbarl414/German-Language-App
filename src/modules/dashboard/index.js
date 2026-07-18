import { store } from '../../db/storage.js';
import { dueTodayCount, moduleStrength, weakestItems } from '../../srs/queue.js';
import { labelForItem } from '../shared/labels.js';

export async function render(container) {
  const stats = store.getStats();
  const due = dueTodayCount();
  const strength = moduleStrength();
  const weak = weakestItems(6);

  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Los geht's!</h1>
      <p class="page-subtitle">Your German training dashboard.</p>

      <div class="stat-grid">
        <div class="stat-tile"><div class="value">${due}</div><div class="label">Due today</div></div>
        <div class="stat-tile"><div class="value">${stats.streak}🔥</div><div class="label">Streak</div></div>
        <div class="stat-tile"><div class="value">${stats.bestStreak || 0}</div><div class="label">Best streak</div></div>
        <div class="stat-tile"><div class="value">${Object.keys(store.allCards()).length}</div><div class="label">Cards tracked</div></div>
      </div>

      <a href="#/review" class="btn btn-primary btn-block" style="margin-bottom:20px;">
        ${due > 0 ? `Start review (${due})` : 'Nothing due — review anyway'}
      </a>

      <div class="section-heading">Strength by module</div>
      <div class="card">
        ${strengthRow('Vocabulary', strength.vocab)}
        ${strengthRow('Phrases', strength.phrase)}
        ${strengthRow('Grammar', strength.grammar)}
      </div>

      <div class="section-heading">Weakest spots</div>
      <div class="card">
        ${
          weak.length === 0
            ? `<p class="page-subtitle" style="margin:0;">Nothing scored yet — start reviewing to see your weak spots here.</p>`
            : weak.map((w) => `<div class="list-item"><span>${labelForItem(w)}</span><span class="tag">${w.facet}</span></div>`).join('')
        }
      </div>

      <div class="btn-row">
        <a href="#/testme" class="btn">🧪 Test me</a>
        <a href="#/games" class="btn">🎮 Games</a>
        <a href="#/add" class="btn">➕ Add content</a>
      </div>
    </div>
  `;
}

function strengthRow(label, value) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return `
    <div style="margin-bottom:12px;">
      <div class="card-row" style="margin-bottom:6px;">
        <span>${label}</span>
        <span class="page-subtitle" style="margin:0;">${value == null ? 'no data' : pct + '%'}</span>
      </div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
    </div>`;
}
