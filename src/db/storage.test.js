// Verifies the additive merge in migrate() picks up newly-added settings
// fields (reviewSessionSize, throttle thresholds) for data saved before they
// existed, without touching anything already on disk — the "sacred data"
// rule from CLAUDE.md: adding fields must never look like a reset.

import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryLocalStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

globalThis.localStorage = new MemoryLocalStorage();

const { store, STORAGE_VERSION } = await import('./storage.js');

test('old saved data without the new settings fields gets sane defaults, keeping everything else intact', () => {
  const oldBlob = {
    version: STORAGE_VERSION,
    srsCards: { 'vocab:core-verbs-1::gehen:meaning': { status: 'review', ease: 2.5, interval: 10, due: 123, reps: 3, lapses: 0 } },
    packs: { 'vocab:core-verbs-1': { active: true, triaged: true } },
    settings: { dailyNewLimit: 42, theme: 'dark' }, // authored before reviewSessionSize/throttle fields existed
    stats: { streak: 5, bestStreak: 9, lastStudyDate: '2026-01-01', history: {}, gameBests: {} },
    userContent: { vocab: [], phrases: [], notes: [] },
    meta: { createdAt: '2026-01-01T00:00:00.000Z' },
  };
  globalThis.localStorage.setItem('german-app-data-v1', JSON.stringify(oldBlob));

  const restored = store.importBackup(JSON.stringify(oldBlob));

  // Existing user data is untouched.
  assert.equal(restored.settings.dailyNewLimit, 42);
  assert.equal(restored.settings.theme, 'dark');
  assert.deepEqual(restored.srsCards, oldBlob.srsCards);
  assert.deepEqual(restored.packs, oldBlob.packs);
  assert.equal(restored.stats.streak, 5);

  // New fields fall back to defaults instead of being missing/undefined.
  assert.equal(typeof restored.settings.reviewSessionSize, 'number');
  assert.equal(typeof restored.settings.throttleQueueThreshold, 'number');
  assert.equal(typeof restored.settings.throttlePauseThreshold, 'number');
  assert.ok(restored.settings.reviewSessionSize > 0);
  assert.ok(restored.settings.throttlePauseThreshold > restored.settings.throttleQueueThreshold);
});
