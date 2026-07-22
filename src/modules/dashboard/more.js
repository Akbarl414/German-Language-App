import { t } from '../../i18n.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('moreTitle')}</h1>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/phrases">🗣️&nbsp;&nbsp;${t('morePhrases')}</a>
        <a class="list-item" style="padding:16px;" href="#/games">🎮&nbsp;&nbsp;${t('navGames')}</a>
        <a class="list-item" style="padding:16px;" href="#/testme">🧪&nbsp;&nbsp;${t('navTestMe')}</a>
        <a class="list-item" style="padding:16px;" href="#/active">🗂️&nbsp;&nbsp;${t('moreActiveContent')}</a>
        <a class="list-item" style="padding:16px;" href="#/settings">⚙️&nbsp;&nbsp;${t('moreSettings')}</a>
      </div>
    </div>`;
}
