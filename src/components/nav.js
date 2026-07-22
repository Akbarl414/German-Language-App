import { t } from '../i18n.js';

function navItems() {
  return [
    { path: '/', icon: '🏠', label: t('navHome') },
    { path: '/games', icon: '🎮', label: t('navGames') },
    { path: '/testme', icon: '🧪', label: t('navTestMe') },
    { path: '/more', icon: '☰', label: t('navMore') },
  ];
}

export function renderNav(activePath) {
  const topPath = '/' + (activePath.split('/')[1] || '');
  return `
    <nav class="bottom-nav">
      ${navItems()
        .map(
          (item) => `
        <a href="#${item.path}" class="${topPath === item.path ? 'active' : ''}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>`
        )
        .join('')}
    </nav>`;
}
