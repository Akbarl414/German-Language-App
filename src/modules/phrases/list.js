import { getAllPhrases } from '../../db/contentLoader.js';

const REGISTER_COLOR = { colloquial: 'var(--warn)', neutral: 'var(--text-dim)', formal: 'var(--accent)' };

export async function render(container) {
  const phrases = getAllPhrases();
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Phrasen &amp; Redewendungen</h1>
      <p class="page-subtitle">${phrases.length} phrases.</p>
      <a href="#/phrases/quiz" class="btn btn-primary btn-block" style="margin-bottom:16px;">Context quiz</a>
      ${phrases.map((p, i) => phraseCard(p, i)).join('')}
    </div>`;

  container.querySelectorAll('[data-expand]').forEach((el) =>
    el.addEventListener('click', () => {
      const detail = container.querySelector(`#pdetail-${el.dataset.expand}`);
      detail.style.display = detail.style.display === 'block' ? 'none' : 'block';
    })
  );
}

function phraseCard(p, i) {
  return `
    <div class="card" data-expand="${i}" style="cursor:pointer;">
      <div class="card-row">
        <span style="font-weight:700;">${escapeHtml(p.phrase)}</span>
        <span class="tag" style="color:${REGISTER_COLOR[p.register]}; border-color:${REGISTER_COLOR[p.register]};">${p.register}</span>
      </div>
      <div id="pdetail-${i}" style="display:none; margin-top:10px; color:var(--text-dim); font-size:0.92rem;">
        <div><em>${escapeHtml(p.literal)}</em></div>
        <div style="margin-top:4px; color:var(--text);">${escapeHtml(p.meaning)}</div>
        <div class="drill-example" style="margin-top:8px;">${escapeHtml(p.situation)}</div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
