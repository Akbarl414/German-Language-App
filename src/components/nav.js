const NAV_ITEMS = [
  { path: '/', icon: '🏠', label: 'Start' },
  { path: '/games', icon: '🎮', label: 'Spiele' },
  { path: '/testme', icon: '🧪', label: 'Teste mich' },
  { path: '/more', icon: '☰', label: 'Mehr' },
];

export function renderNav(activePath) {
  const topPath = '/' + (activePath.split('/')[1] || '');
  return `
    <nav class="bottom-nav">
      ${NAV_ITEMS.map(
        (item) => `
        <a href="#${item.path}" class="${topPath === item.path ? 'active' : ''}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>`
      ).join('')}
    </nav>`;
}
