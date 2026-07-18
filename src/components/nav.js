const NAV_ITEMS = [
  { path: '/', icon: '🏠', label: 'Home' },
  { path: '/review', icon: '⏱️', label: 'Review' },
  { path: '/vocab', icon: '📚', label: 'Vocab' },
  { path: '/grammar', icon: '✏️', label: 'Grammar' },
  { path: '/more', icon: '☰', label: 'More' },
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
