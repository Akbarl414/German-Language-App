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

// --- Failed-load protection: an unloadable blob must never be overwritten ---

const MAIN_KEY = 'german-app-data-v1';
const RECOVERY_KEY = 'german-app-recovery-v1';
const SNAPSHOTS_KEY = 'german-app-snapshots-v1';

let freshCounter = 0;
/** A brand-new store module instance (fresh in-memory cache) over a fresh localStorage seeded with `entries`. */
async function freshStore(entries = {}) {
  globalThis.localStorage = new MemoryLocalStorage();
  for (const [k, v] of Object.entries(entries)) globalThis.localStorage.setItem(k, v);
  const mod = await import(`./storage.js?fresh=${++freshCounter}`);
  return mod.store;
}

const validBlob = () => ({
  version: 1,
  srsCards: { 'vocab:core-verbs-1::gehen:meaning': { status: 'review', ease: 2.5, interval: 10, due: 123, reps: 3, lapses: 0 } },
  packs: { 'vocab:core-verbs-1': { active: true, triaged: true } },
  settings: { dailyNewLimit: 42, theme: 'auto' },
  stats: { streak: 5, bestStreak: 9, lastStudyDate: '2026-01-01', history: { '2026-01-01': { reviewed: 3, newSeen: 1, gamesPlayed: 0 } }, gameBests: {} },
  userContent: { vocab: [], phrases: [], notes: [] },
  meta: { createdAt: '2026-01-01T00:00:00.000Z' },
});

const UNLOADABLE = {
  'corrupt JSON': '{"srsCards": {"a": 1}, oops',
  null: 'null',
  'an array': '[1,2,3]',
  'a number': '42',
  'a string': '"hello"',
  'srsCards as an array': JSON.stringify({ ...validBlob(), srsCards: [] }),
  'settings as a string': JSON.stringify({ ...validBlob(), settings: 'dark' }),
  'stats as null': JSON.stringify({ ...validBlob(), stats: null }),
};

for (const [label, raw] of Object.entries(UNLOADABLE)) {
  test(`unloadable stored data (${label}): raw copy saved to recovery key, main key never overwritten`, async () => {
    const store = await freshStore({ [MAIN_KEY]: raw });
    assert.equal(store.loadFailed, true);
    assert.equal(store.recoveryCopySaved, true);

    const recovery = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    assert.equal(recovery.length, 1);
    assert.equal(recovery[0].raw, raw);
    assert.ok(recovery[0].savedAt);

    store.setCard('vocab:x::y:meaning', { status: 'new' });
    store.updateSettings({ dailyNewLimit: 1 });
    store.recordDailyActivity('reviewed');
    store.save();
    assert.equal(localStorage.getItem(MAIN_KEY), raw);
    assert.equal(store.getRawSavedData(), raw);
  });
}

test('no snapshot is written while in the failed state', async () => {
  const store = await freshStore({ [MAIN_KEY]: '{broken' });
  assert.equal(store.loadFailed, true);
  store.recordDailyActivity('reviewed');
  assert.equal(localStorage.getItem(SNAPSHOTS_KEY), null);
  assert.deepEqual(store.listSnapshots(), []);
});

test('an existing recovery copy is never overwritten by a different one', async () => {
  const earlier = JSON.stringify([{ savedAt: '2026-01-01T00:00:00.000Z', error: 'x', raw: 'first-bad' }]);
  const store = await freshStore({ [MAIN_KEY]: 'second-bad', [RECOVERY_KEY]: earlier });
  assert.equal(store.loadFailed, true);
  const recovery = JSON.parse(localStorage.getItem(RECOVERY_KEY));
  assert.deepEqual(
    recovery.map((e) => e.raw),
    ['first-bad', 'second-bad']
  );
});

test('an unreadable recovery key is left alone and the new copy goes to a sibling key', async () => {
  const store = await freshStore({ [MAIN_KEY]: 'bad', [RECOVERY_KEY]: 'not json' });
  assert.equal(store.loadFailed, true);
  assert.equal(localStorage.getItem(RECOVERY_KEY), 'not json');
  const sibling = [...localStorage.map.keys()].find((k) => k.startsWith(`${RECOVERY_KEY}-`));
  assert.ok(sibling);
  assert.equal(JSON.parse(localStorage.getItem(sibling))[0].raw, 'bad');
});

test('restoring a snapshot clears the failed state and saving works again; recovery copy kept', async () => {
  const snap = JSON.stringify([{ date: '2026-01-01', data: validBlob() }]);
  const store = await freshStore({ [MAIN_KEY]: '{broken', [SNAPSHOTS_KEY]: snap });
  assert.equal(store.loadFailed, true);
  store.restoreSnapshot('2026-01-01');
  assert.equal(store.loadFailed, false);
  store.updateSettings({ dailyNewLimit: 7 });
  assert.equal(JSON.parse(localStorage.getItem(MAIN_KEY)).settings.dailyNewLimit, 7);
  assert.equal(JSON.parse(localStorage.getItem(RECOVERY_KEY))[0].raw, '{broken');
});

test('importing a valid backup clears the failed state', async () => {
  const store = await freshStore({ [MAIN_KEY]: '{broken' });
  store.importBackup(JSON.stringify(validBlob()));
  assert.equal(store.loadFailed, false);
  assert.equal(JSON.parse(localStorage.getItem(MAIN_KEY)).settings.dailyNewLimit, 42);
});

test('confirmed start-fresh clears the failed state, saves defaults, keeps the recovery copy', async () => {
  const store = await freshStore({ [MAIN_KEY]: '{broken' });
  store.startFreshAfterFailedLoad();
  assert.equal(store.loadFailed, false);
  assert.deepEqual(JSON.parse(localStorage.getItem(MAIN_KEY)).srsCards, {});
  assert.equal(JSON.parse(localStorage.getItem(RECOVERY_KEY))[0].raw, '{broken');
});

test('valid existing data still loads and migrates exactly as before', async () => {
  const store = await freshStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
  assert.equal(store.loadFailed, false);
  assert.equal(localStorage.getItem(RECOVERY_KEY), null);
  const data = store.data;
  assert.equal(data.version, STORAGE_VERSION);
  assert.equal(data.settings.theme, 'system'); // v1 -> v2 migration ran
  assert.equal(data.settings.dailyNewLimit, 42);
  assert.equal(typeof data.settings.reviewSessionSize, 'number'); // additive default backfilled
  assert.deepEqual(data.srsCards, validBlob().srsCards);
  assert.deepEqual(data.stats.history, validBlob().stats.history);
  assert.equal(store.listSnapshots().length, 1); // normal daily snapshot still taken
  store.updateSettings({ dailyNewLimit: 9 });
  assert.equal(JSON.parse(localStorage.getItem(MAIN_KEY)).settings.dailyNewLimit, 9);
});

test('missing key (first run) starts with fresh defaults and saving works', async () => {
  const store = await freshStore();
  assert.equal(store.loadFailed, false);
  assert.deepEqual(store.allCards(), {});
  store.setCard('vocab:x::y:meaning', { status: 'new' });
  assert.deepEqual(JSON.parse(localStorage.getItem(MAIN_KEY)).srsCards, { 'vocab:x::y:meaning': { status: 'new' } });
  assert.equal(localStorage.getItem(RECOVERY_KEY), null);
});

for (const [label, file] of Object.entries({
  'not JSON': 'hello',
  'another app’s backup': JSON.stringify({ words: [{ urdu: 'پانی', english: 'water' }], progress: {} }),
  'an empty object': '{}',
  'an array': '[]',
  'srsCards wrong type': JSON.stringify({ ...validBlob(), srsCards: 'x' }),
})) {
  test(`importing a wrong-shaped file (${label}) is rejected and data is unchanged`, async () => {
    const store = await freshStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
    store.data; // load (and migrate) the real data
    const before = localStorage.getItem(MAIN_KEY);
    const beforeData = JSON.stringify(store.data);
    assert.throws(() => store.importBackup(file));
    assert.equal(localStorage.getItem(MAIN_KEY), before);
    assert.equal(JSON.stringify(store.data), beforeData);
    assert.equal(store.loadFailed, false);
  });
}
