import { getVocabPacks } from '../../db/contentLoader.js';
import { store } from '../../db/storage.js';
import { activateVocabPack, deactivateVocabPack, getPendingTriageWords } from '../../srs/queue.js';

export async function render(container) {
  paint();

  function paint() {
    const packs = getVocabPacks();
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Vocabulary</h1>
        <p class="page-subtitle">${packs.reduce((n, p) => n + p.words.length, 0)} words across ${packs.length} packs.</p>
        <div class="btn-row" style="margin-bottom:16px;">
          <a href="#/add" class="btn">➕ Add a word</a>
        </div>
        ${packs.map((p) => packRow(p)).join('')}
      </div>`;

    container.querySelectorAll('[data-toggle]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const packId = el.dataset.toggle;
        const state = store.getPackState(`vocab:${packId}`);
        if (state.active) deactivateVocabPack(packId);
        else activateVocabPack(packId);
        paint();
      })
    );
  }
}

function packRow(pack) {
  const state = store.getPackState(`vocab:${pack.id}`);
  const pending = state.active ? getPendingTriageWords(pack.id).length : 0;
  return `
    <a class="card card-row" href="#/vocab/pack/${pack.id}" style="text-decoration:none; color:inherit;">
      <div>
        <div style="font-weight:700;">${pack.title}</div>
        <div class="page-subtitle" style="margin:2px 0 0;">${pack.topic} · ${pack.level} · ${pack.words.length} words</div>
        ${pending > 0 ? `<a href="#/vocab/pack/${pack.id}/triage" class="tag" style="margin-top:6px; display:inline-block; color:var(--warn); border-color:var(--warn);">Continue triage (${pending} left)</a>` : ''}
      </div>
      <button class="btn btn-sm ${state.active ? 'btn-good' : ''}" data-toggle="${pack.id}">${state.active ? 'Active' : 'Off'}</button>
    </a>`;
}
