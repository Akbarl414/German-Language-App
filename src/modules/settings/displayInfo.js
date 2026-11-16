// Diagnostic readings for the Settings "Display info" line (how the app is
// drawn on iPhones). Read-only; touches no storage.

function px(n) {
  return Math.round(n * 100) / 100;
}

function measureInsets() {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  try {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();
    return out;
  } catch {
    return zero;
  }
}

export function parseIosVersion(ua) {
  const s = ua || '';
  if (!/iPhone|iPad|iPod/.test(s)) return null;
  const m = s.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  if (!m) return null;
  return m[3] ? `${m[1]}.${m[2]}.${m[3]}` : `${m[1]}.${m[2]}`;
}

export function measureDisplayInfo() {
  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  };
  const vv = safe(() => window.visualViewport, null);
  return {
    insets: measureInsets(),
    displayModeStandalone: safe(() => window.matchMedia('(display-mode: standalone)').matches, false),
    navigatorStandalone: safe(() => navigator.standalone === true, false),
    innerWidth: safe(() => window.innerWidth, 0),
    innerHeight: safe(() => window.innerHeight, 0),
    screenHeight: safe(() => screen.height, 0),
    dpr: safe(() => window.devicePixelRatio, 0),
    vvHeight: vv ? px(vv.height) : 0,
    vvOffsetTop: vv ? px(vv.offsetTop) : 0,
    appTop: safe(() => px(document.getElementById('app').getBoundingClientRect().top), 0),
    ios: safe(() => parseIosVersion(navigator.userAgent), null),
  };
}

/** One copyable line of text from measureDisplayInfo(); `tr` is the label function. */
export function formatDisplayInfo(d, tr) {
  const yn = (b) => tr(b ? 'displayYes' : 'displayNo');
  const i = d.insets;
  return [
    `${tr('displayInsets')} ${px(i.top)}/${px(i.right)}/${px(i.bottom)}/${px(i.left)} px`,
    `${tr('displayStandalone')} ${yn(d.displayModeStandalone)}/${yn(d.navigatorStandalone)}`,
    `${tr('displayWindow')} ${d.innerWidth}×${d.innerHeight}`,
    `${tr('displayScreenHeight')} ${d.screenHeight}`,
    `DPR ${d.dpr}`,
    `${tr('displayViewport')} ${d.vvHeight} / ${d.vvOffsetTop}`,
    `${tr('displayAppTop')} ${d.appTop}`,
    `iOS ${d.ios || '—'}`,
  ].join(' · ');
}
