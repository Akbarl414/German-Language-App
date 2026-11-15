import './style.css';
import { route, initRouter, rerenderCurrentRoute } from './router.js';
import { renderNav } from './components/nav.js';
import { initTheme } from './theme.js';
import { onLanguageChange, t } from './i18n.js';
import { store } from './db/storage.js';

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
route('/games/wordfall', () => import('./modules/games/wordfall.js'));
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

// Persistent, non-blocking warning on every screen while saving to
// localStorage fails (e.g. storage full); see persist() in storage.js.
const saveWarningEl = document.getElementById('save-warning');
function paintSaveWarning() {
  const failed = store.saveFailed;
  saveWarningEl.hidden = !failed;
  document.body.classList.toggle('has-save-warning', failed);
  saveWarningEl.innerHTML = failed ? `${t('saveFailedBanner')} <a href="#/settings">${t('saveFailedGoToSettings')}</a>` : '';
}

if (store.loadFailed) {
  // Saved data exists but couldn't be loaded: the store is read-only, and no
  // normal screen (or the nav that leads to them) is shown until the user
  // recovers via the recovery screen, which reloads the page on success.
  import('./modules/recovery/index.js').then((mod) => mod.render(document.getElementById('app')));
} else {
  window.addEventListener('hashchange', paintNav);
  paintNav();
  paintSaveWarning();
  store.onSaveStatusChange(paintSaveWarning);

  initRouter(document.getElementById('app'));

  // Flip nav chrome + the currently-displayed screen in place when the UI
  // language toggle in Settings changes.
  onLanguageChange(() => {
    paintNav();
    paintSaveWarning();
    rerenderCurrentRoute();
  });
}

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
