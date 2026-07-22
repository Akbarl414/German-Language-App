import { getVocabPacks } from '../../db/contentLoader.js';
import { store } from '../../db/storage.js';
import { activateVocabPack, deactivateVocabPack, getPendingTriageWords } from '../../srs/queue.js';
import { t } from '../../i18n.js';

export async function render(container) {
  paint();

  function paint() {
    const packs = getVocabPacks();
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">${t('vocabTitle')}</h1>
        <p class="page-subtitle">${packs.reduce((n, p) => n + p.words.length, 0)} words across ${packs.length} packs.</p>
        <div class="btn-row" style="margin-bottom:16px;">
          <a href="#/add" class="btn">${t('addAWord')}</a>
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
  // Note: intentionally no <a> wrapping the whole row — the "continue triage"
  // link inside would nest an <a> inside an <a>, which is invalid HTML and
  // gets silently mangled by the parser (browsers close the outer anchor early).
  return `
    <div class="card">
      <div class="card-row">
        <a href="#/vocab/pack/${pack.id}" style="text-decoration:none; color:inherit; flex:1;">
          <div style="font-weight:700;">${pack.title}</div>
          <div class="page-subtitle" style="margin:2px 0 0;">${pack.topic} · ${pack.level} · ${pack.words.length} words</div>
        </a>
        <button class="btn btn-sm ${state.active ? 'btn-good' : ''}" data-toggle="${pack.id}">${state.active ? t('packActive') : t('packOff')}</button>
      </div>
      ${pending > 0 ? `<a href="#/vocab/pack/${pack.id}/triage" class="tag" style="margin-top:10px; display:inline-block; color:var(--warn); border-color:var(--warn);">Continue triage (${pending} left)</a>` : ''}
    </div>`;
}
