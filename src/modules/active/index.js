import { t } from '../../i18n.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('activeContentTitle')}</h1>
      <p class="page-subtitle">Manage which vocab packs and grammar units feed your review queue, or add new content.</p>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/grammar">✏️&nbsp;&nbsp;${t('activeContentGrammar')}</a>
        <a class="list-item" style="padding:16px;" href="#/vocab">📚&nbsp;&nbsp;${t('activeContentVocab')}</a>
        <a class="list-item" style="padding:16px;" href="#/add">➕&nbsp;&nbsp;${t('activeContentAdd')}</a>
      </div>
    </div>`;
}
