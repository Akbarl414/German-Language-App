import { t } from '../../i18n.js';

// Games shown in the Beta section. The whole section is hidden while this is
// empty. Entry shape: { href, icon, labelKey } (labelKey is a LABELS key).
const BETA_GAMES = [{ href: '#/games/beta/satzbau', icon: '🧩', labelKey: 'gameSatzbauName' }];

function gameLink({ href, icon, labelKey }) {
  return `<a class="list-item" style="padding:16px;" href="${href}">${icon}&nbsp;&nbsp;${t(labelKey)}</a>`;
}

const MAIN_GAMES = [
  { href: '#/games/sorting', icon: '🗂️', labelKey: 'gameSortingName' },
  { href: '#/games/stories', icon: '📖', labelKey: 'gameStoriesName' },
  { href: '#/games/wordfall', icon: '🌧️', labelKey: 'gameWordfallName' },
  { href: '#/games/typeit', icon: '⌨️', labelKey: 'gameTypeItName' },
  { href: '#/games/case-detective', icon: '🕵️', labelKey: 'gameCaseDetectiveName' },
  { href: '#/games/verb-sprint', icon: '🏃', labelKey: 'gameVerbSprintName' },
];

export async function render(container) {
  const betaHTML =
    BETA_GAMES.length === 0
      ? ''
      : `
      <div class="section-heading">${t('betaHeading')}</div>
      <p class="page-subtitle" style="margin-top:-14px;">${t('betaBlurb')}</p>
      <div class="card" style="padding:0;">
        ${BETA_GAMES.map((g) => gameLink(g).replace('</a>', ` <span class="tag">beta</span></a>`)).join('')}
      </div>`;

  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('gamesTitle')}</h1>
      <p class="page-subtitle">${t('gamesHubIntro')}</p>
      <div class="card" style="padding:0;">
        ${MAIN_GAMES.map(gameLink).join('')}
      </div>
      ${betaHTML}
    </div>`;
}
