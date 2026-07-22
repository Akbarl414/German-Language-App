import './style.css';
import { route, initRouter } from './router.js';
import { renderNav } from './components/nav.js';
import { initTheme } from './theme.js';

initTheme();

route('/', () => import('./modules/dashboard/index.js'));
route('/review', () => import('./modules/dashboard/review.js'));
route('/more', () => import('./modules/dashboard/more.js'));
route('/active', () => import('./modules/active/index.js'));

route('/vocab', () => import('./modules/vocab/browse.js'));
route('/vocab/pack/:packId', () => import('./modules/vocab/pack.js'));
route('/vocab/pack/:packId/triage', () => import('./modules/vocab/triage.js'));

route('/grammar', () => import('./modules/grammar/list.js'));
route('/grammar/unit/:unitId', () => import('./modules/grammar/unit.js'));
route('/grammar/unit/:unitId/practice', () => import('./modules/grammar/practice.js'));
route('/grammar/quiz', () => import('./modules/grammar/quiz.js'));

route('/phrases', () => import('./modules/phrases/list.js'));
route('/phrases/quiz', () => import('./modules/phrases/quiz.js'));

route('/games', () => import('./modules/games/hub.js'));
route('/games/sorting', () => import('./modules/games/sorting.js'));
route('/games/timed', () => import('./modules/games/timed.js'));
route('/games/stories', () => import('./modules/games/stories.js'));
route('/games/beta/wordfall', () => import('./modules/games/beta/wordfall.js'));
route('/games/beta/typeit', () => import('./modules/games/beta/typeit.js'));
route('/games/beta/case-detective', () => import('./modules/games/beta/caseDetective.js'));
route('/games/beta/verb-sprint', () => import('./modules/games/beta/verbSprint.js'));

route('/testme', () => import('./modules/testme/index.js'));
route('/testme/run', () => import('./modules/testme/run.js'));

route('/add', () => import('./modules/addcontent/index.js'));
route('/settings', () => import('./modules/settings/index.js'));

const navEl = document.getElementById('nav');
function paintNav() {
  navEl.innerHTML = renderNav(location.hash.slice(1) || '/');
}
window.addEventListener('hashchange', paintNav);
paintNav();

initRouter(document.getElementById('app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((e) => console.error('SW registration failed', e));
  });
}

// Ask the browser not to evict this device's progress data under storage
// pressure. Best-effort — Settings surfaces a warning if it's not granted.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}
