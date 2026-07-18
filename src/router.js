// Minimal hash router: no framework, no build-time route generation.
// Each route maps a path pattern to a module with a render(container, params) function.

const routes = [];
let currentCleanup = null;
let container = null;

export function route(pattern, loader) {
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            paramNames.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
  );
  routes.push({ regex, paramNames, loader });
}

function parseHash() {
  const hash = location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  const params = {};
  if (query) {
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { path: path.startsWith('/') ? path : '/' + path, params };
}

async function resolve() {
  const { path, params } = parseHash();
  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      if (typeof currentCleanup === 'function') {
        try {
          currentCleanup();
        } catch (e) {
          console.error(e);
        }
      }
      container.innerHTML = '';
      const mod = await r.loader();
      currentCleanup = await mod.render(container, params);
      window.scrollTo(0, 0);
      return;
    }
  }
  container.innerHTML = '<div class="empty-state">Page not found. <a href="#/">Go home</a></div>';
}

export function initRouter(el) {
  container = el;
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function navigate(path) {
  location.hash = path;
}
