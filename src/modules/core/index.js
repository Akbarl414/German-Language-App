// Core 1000 tab home: recognised count, due now, new left today, review /
// triage / unlock buttons, and the 20-band progress grid.
// Queue logic lives in src/srs/queue.js (Core API) and src/srs/coreScope.js.

import { store } from '../../db/storage.js';
import { coreSummary, unlockNextCoreBand } from '../../srs/queue.js';
import { CORE_BAND_COUNT, CORE_TOTAL, bandRange } from '../../srs/coreScope.js';
import { t, getUiLanguage } from '../../i18n.js';

export async function render(container) {
  const s = coreSummary();
  const sessionSize = Math.max(1, store.getSettings().reviewSessionSize || 30);
  const nextBand = s.unlockedBands + 1;
  const next = nextBand <= CORE_BAND_COUNT ? bandRange(nextBand) : null;
  const fmt = (n) => n.toLocaleString(getUiLanguage() === 'de' ? 'de-DE' : 'en-GB');

  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">${t('coreTitle')}</h1>
      <p class="page-subtitle">${t('coreSubtitle')}</p>

      <div class="stat-grid">
        <div class="stat-tile"><div class="value">${fmt(s.recognised)}<span class="core-of"> / ${fmt(CORE_TOTAL)}</span></div><div class="label">${t('coreRecognised')}</div></div>
        <div class="stat-tile"><div class="value">${s.due}</div><div class="label">${t('coreDueNow')}</div></div>
        <div class="stat-tile"><div class="value">${s.newLeftToday}</div><div class="label">${t('coreNewToday')}</div></div>
        <div class="stat-tile"><div class="value">${s.unlockedBands} / ${CORE_BAND_COUNT}</div><div class="label">${t('coreBands')}</div></div>
      </div>

      ${
        s.sessionLength > 0
          ? `<a href="#/core/review" class="btn btn-primary btn-block" style="margin-bottom:10px;">${t('coreStartReview', Math.min(s.sessionLength, sessionSize))}</a>`
          : `<button class="btn btn-block" disabled style="margin-bottom:10px;">${t('coreNothingToReview')}</button>`
      }
      ${s.pendingTriage > 0 ? `<a href="#/core/triage" class="btn btn-warn btn-block" style="margin-bottom:10px;">${t('coreContinueTriage', s.pendingTriage)}</a>` : ''}
      ${
        next
          ? `<button class="btn btn-block" id="unlock-band" style="margin-bottom:10px;">${t('coreUnlockBand', nextBand, next.from, next.to)}</button>`
          : `<p class="page-subtitle" style="text-align:center;">${t('coreAllUnlocked')}</p>`
      }
      ${s.unlockedBands === 0 ? `<p class="page-subtitle" style="text-align:center; margin-top:8px;">${t('coreStartHint')}</p>` : ''}

      <div class="section-heading">${t('coreBands')}</div>
      <div class="core-bands">
        ${s.bands
          .map((b) => {
            const pct = b.total ? Math.round((b.recognised / b.total) * 100) : 0;
            return `
          <div class="core-band ${b.unlocked ? '' : 'locked'}">
            <div class="core-band-range">${b.unlocked ? '' : '🔒 '}${b.from}–${b.to}</div>
            <div class="core-band-count">${b.recognised} / ${b.total}</div>
            <div class="progress-bar"><div style="width:${pct}%"></div></div>
          </div>`;
          })
          .join('')}
      </div>
    </div>`;

  container.querySelector('#unlock-band')?.addEventListener('click', () => {
    unlockNextCoreBand();
    location.hash = '#/core/triage';
  });
}
