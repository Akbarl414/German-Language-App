import { findVocabPack } from '../../db/contentLoader.js';
import { getPendingTriageWords, isPackActive } from '../../srs/queue.js';
import { genderBadgeHTML, escapeHtml } from '../../components/gender.js';

export async function render(container, { packId }) {
  const pack = findVocabPack(packId);
  if (!pack) {
    container.innerHTML = `<div class="view empty-state">Pack not found. <a href="#/vocab">Back to vocab</a></div>`;
    return;
  }

  const pending = isPackActive('vocab', packId) ? getPendingTriageWords(packId).length : 0;

  container.innerHTML = `
    <div class="view">
      <a href="#/vocab" class="page-subtitle">&larr; Vocabulary</a>
      <h1 class="page-title">${pack.title}</h1>
      <p class="page-subtitle">${pack.topic} · ${pack.level} · ${pack.words.length} words</p>
      ${
        pending > 0
          ? `<a href="#/vocab/pack/${pack.id}/triage" class="btn btn-warn btn-block" style="margin-bottom:16px;">Triage ${pending} new word(s)</a>`
          : ''
      }
      <div class="card" style="padding:0;">
        ${pack.words.map((w) => wordRow(w)).join('')}
      </div>
    </div>`;

  container.querySelectorAll('[data-expand]').forEach((el) =>
    el.addEventListener('click', () => {
      const detail = container.querySelector(`#detail-${el.dataset.expand}`);
      detail.style.display = detail.style.display === 'block' ? 'none' : 'block';
    })
  );
}

function wordRow(w) {
  const head = w.pos === 'noun' ? `${genderBadgeHTML(w.gender)} ${escapeHtml(w.lemma)}` : `<strong>${escapeHtml(w.lemma)}</strong>`;
  return `
    <div style="padding:12px 16px; border-bottom:1px solid var(--border);">
      <div class="card-row" style="cursor:pointer;" data-expand="${w.id}">
        <span>${head}</span>
        <span class="page-subtitle" style="margin:0;">${escapeHtml(w.meaning_en)}</span>
      </div>
      <div id="detail-${w.id}" style="display:none; margin-top:10px; font-size:0.9rem; color:var(--text-dim);">
        ${detailHTML(w)}
      </div>
    </div>`;
}

function detailHTML(w) {
  const lines = [];
  if (w.pos === 'noun') {
    lines.push(`Plural: die ${escapeHtml(w.plural)}`);
  }
  if (w.pos === 'verb') {
    lines.push(`3sg present: ${escapeHtml(w.present_3sg)}`);
    lines.push(`Präteritum: ${escapeHtml(w.praeteritum)}`);
    lines.push(`Perfekt: ${escapeHtml(w.perfekt)} (${w.auxiliary})`);
    if (w.separable) lines.push(`Separable prefix verb`);
    if (w.government) lines.push(`Government: ${escapeHtml(w.government)}`);
  }
  if (w.comparative) lines.push(`Comparative: ${escapeHtml(w.comparative)}`);
  if (w.superlative) lines.push(`Superlative: ${escapeHtml(w.superlative)}`);
  lines.push(`<em>${escapeHtml(w.example_de)}</em>`);
  lines.push(escapeHtml(w.example_en));
  return lines.join('<br>');
}
