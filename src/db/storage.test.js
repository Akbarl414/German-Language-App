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

// --- Full storage: a failed write must never damage what's on disk ---

/** localStorage with a character quota (key + value, like browsers), throwing before changing anything when a write would exceed it. */
class QuotaLocalStorage extends MemoryLocalStorage {
  constructor() {
    super();
    this.quota = Infinity;
    this.failKeys = new Set();
  }
  used() {
    let n = 0;
    for (const [k, v] of this.map) n += k.length + v.length;
    return n;
  }
  setItem(key, value) {
    const v = String(value);
    const old = this.map.has(key) ? key.length + this.map.get(key).length : 0;
    if (this.failKeys.has(key) || this.used() - old + key.length + v.length > this.quota) {
      throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    }
    this.map.set(key, v);
  }
}

/** Like freshStore, but over a QuotaLocalStorage seeded (with no quota) before `configure` applies limits. */
async function freshQuotaStore(entries = {}, configure = () => {}) {
  const ls = new QuotaLocalStorage();
  for (const [k, v] of Object.entries(entries)) ls.setItem(k, v);
  configure(ls);
  globalThis.localStorage = ls;
  const mod = await import(`./storage.js?fresh=${++freshCounter}`);
  return { store: mod.store, ls };
}

test('a failed save keeps the stored blob byte-for-byte, keeps data in memory, and sets saveFailed', async () => {
  const { store, ls } = await freshQuotaStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
  store.data; // load
  store.updateSettings({ dailyNewLimit: 11 }); // a normal save first, so the on-disk blob is in current format
  const before = ls.getItem(MAIN_KEY);
  let notified = 0;
  store.onSaveStatusChange(() => notified++);

  ls.failKeys.add(MAIN_KEY);
  assert.doesNotThrow(() => store.setCard('vocab:x::a:meaning', { status: 'new' }));
  assert.equal(ls.getItem(MAIN_KEY), before);
  assert.equal(store.saveFailed, true);
  assert.deepEqual(store.getCard('vocab:x::a:meaning'), { status: 'new' });
  assert.equal(notified, 1);

  store.setCard('vocab:x::b:meaning', { status: 'new' }); // still failing: no repeat notification, disk still untouched
  assert.equal(ls.getItem(MAIN_KEY), before);
  assert.equal(notified, 1);
});

test('a later successful save writes everything kept in memory and clears saveFailed', async () => {
  const { store, ls } = await freshQuotaStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
  store.data;
  let notified = 0;
  store.onSaveStatusChange(() => notified++);
  ls.failKeys.add(MAIN_KEY);
  store.setCard('vocab:x::a:meaning', { status: 'new' });
  assert.equal(store.saveFailed, true);

  ls.failKeys.delete(MAIN_KEY);
  store.setCard('vocab:x::b:meaning', { status: 'new' });
  assert.equal(store.saveFailed, false);
  assert.equal(notified, 2);
  const onDisk = JSON.parse(ls.getItem(MAIN_KEY));
  assert.deepEqual(onDisk.srsCards['vocab:x::a:meaning'], { status: 'new' });
  assert.deepEqual(onDisk.srsCards['vocab:x::b:meaning'], { status: 'new' });
  assert.deepEqual(onDisk.srsCards['vocab:core-verbs-1::gehen:meaning'], validBlob().srsCards['vocab:core-verbs-1::gehen:meaning']);
});

test('importing a backup when storage is full still throws and leaves the stored blob byte-for-byte', async () => {
  const { store, ls } = await freshQuotaStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
  store.data;
  const before = ls.getItem(MAIN_KEY);
  ls.failKeys.add(MAIN_KEY);
  assert.throws(() => store.importBackup(JSON.stringify({ ...validBlob(), settings: { dailyNewLimit: 3 } })));
  assert.equal(ls.getItem(MAIN_KEY), before);
});

// Six older snapshots, each padded so dropping one frees a known amount of room.
const OLD_SNAPSHOT_DATES = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'];
const oldSnapshots = () =>
  JSON.stringify(OLD_SNAPSHOT_DATES.map((date) => ({ date, data: { ...validBlob(), meta: { createdAt: date, pad: 'p'.repeat(800) } } })));

async function snapshotRun(roomBeyondMain) {
  const seeded = { [MAIN_KEY]: JSON.stringify(validBlob()), [SNAPSHOTS_KEY]: oldSnapshots() };
  const { store, ls } = await freshQuotaStore(seeded, (l) => {
    // Room measured on top of the main data alone, so small values can't fit even today's snapshot.
    l.quota = MAIN_KEY.length + seeded[MAIN_KEY].length + roomBeyondMain;
  });
  store.data; // load → maybeSnapshot
  return { store, ls, before: seeded[SNAPSHOTS_KEY] };
}

test("today's snapshot is written by dropping the oldest snapshots, newest ones kept", async () => {
  // Room for today's snapshot plus a little: some (not all) old snapshots must be dropped.
  const { store, ls } = await snapshotRun(SNAPSHOTS_KEY.length + 4000);
  const after = JSON.parse(ls.getItem(SNAPSHOTS_KEY));
  const olds = after.slice(0, -1).map((s) => s.date);
  assert.equal(store.snapshotsFailing, false);
  assert.notEqual(after.at(-1).date, OLD_SNAPSHOT_DATES.at(-1)); // today's is last
  assert.ok(olds.length > 0 && olds.length < OLD_SNAPSHOT_DATES.length, `kept ${olds.length}`);
  assert.deepEqual(olds, OLD_SNAPSHOT_DATES.slice(-olds.length));
});

test("if even today's snapshot alone can't be written, existing snapshots are left byte-for-byte and snapshotsFailing is set", async () => {
  const { store, ls, before } = await snapshotRun(100); // not even room for today's snapshot alone
  assert.equal(ls.getItem(SNAPSHOTS_KEY), before);
  assert.equal(store.snapshotsFailing, true);
  assert.deepEqual(store.listSnapshots(), [...OLD_SNAPSHOT_DATES].reverse());
  assert.equal(ls.getItem(MAIN_KEY), JSON.stringify(validBlob())); // main data untouched too
});

test('snapshot fallback never leaves fewer good snapshots than before unless it wrote today’s (quota sweep)', async () => {
  const outcomes = new Set();
  for (let room = 0; room <= 12000; room += 250) {
    const { store, ls, before } = await snapshotRun(room);
    const raw = ls.getItem(SNAPSHOTS_KEY);
    if (raw === before) {
      assert.equal(store.snapshotsFailing, true, `room ${room}`);
      outcomes.add('failed');
      continue;
    }
    const after = JSON.parse(raw);
    assert.equal(store.snapshotsFailing, false, `room ${room}`);
    assert.ok(!OLD_SNAPSHOT_DATES.includes(after.at(-1).date), `room ${room}: today's snapshot written last`);
    const olds = after.slice(0, -1).map((s) => s.date);
    assert.deepEqual(olds, OLD_SNAPSHOT_DATES.slice(OLD_SNAPSHOT_DATES.length - olds.length), `room ${room}: kept the newest old snapshots`);
    outcomes.add(olds.length === OLD_SNAPSHOT_DATES.length ? 'all kept' : olds.length === 0 ? 'today only' : 'some dropped');
  }
  // The sweep really exercised every path.
  assert.deepEqual([...outcomes].sort(), ['all kept', 'failed', 'some dropped', 'today only']);
});

test('getStorageUsage reports the stored sizes of main data and snapshots', async () => {
  const main = JSON.stringify(validBlob());
  const snaps = oldSnapshots();
  const { store } = await freshQuotaStore({ [MAIN_KEY]: main, [SNAPSHOTS_KEY]: snaps }, (l) => {
    l.failKeys.add(SNAPSHOTS_KEY); // keep the snapshot key exactly as seeded
  });
  assert.deepEqual(store.getStorageUsage(), { main: MAIN_KEY.length + main.length, snapshots: SNAPSHOTS_KEY.length + snaps.length });
});

// --- Update-note alert: fresh install vs existing user ---

test('fresh install (no saved data) does not show the update alert', async () => {
  const store = await freshStore();
  assert.equal(store.shouldShowUpdateAlert(), false);
});

test('existing saved data without lastSeenUpdateId shows the alert, and all progress is untouched', async () => {
  const blob = validBlob();
  const store = await freshStore({ [MAIN_KEY]: JSON.stringify(blob) });
  assert.equal(store.shouldShowUpdateAlert(), true);
  assert.deepEqual(store.allCards(), blob.srsCards);
  assert.deepEqual(store.allPackStates(), blob.packs);
});

test('markUpdatesSeen hides the alert, persists, and keeps it hidden after reload', async () => {
  const store = await freshStore({ [MAIN_KEY]: JSON.stringify(validBlob()) });
  store.markUpdatesSeen();
  assert.equal(store.shouldShowUpdateAlert(), false);
  const saved = localStorage.getItem(MAIN_KEY);
  const reloaded = await freshStore({ [MAIN_KEY]: saved });
  assert.equal(reloaded.shouldShowUpdateAlert(), false);
  assert.deepEqual(reloaded.allCards(), validBlob().srsCards);
});

// --- Games/review scoping change: pre-change stored data must load intact ---

test('pre-change stored data (game-created cards, user-added words, wordfallPackIds) loads with every card intact', async () => {
  const card = (due) => ({ status: 'review', ease: 2.4, interval: 7, learningStep: 0, reps: 4, lapses: 1, due, lastReviewed: due - 1 });
  const blob = {
    version: 2,
    srsCards: {
      'vocab:core-verbs-1::gehen:meaning': card(10), // active pack
      'vocab:core-nouns-1::tisch:gender': card(20), // never-activated pack, created by a game
      'vocab:core-adj-1::gross:meaning_de_en': card(30), // explicitly deactivated pack
      'vocab:user-added::hund-abc:gender': card(40), // user-added word, partial cards from a game
      'grammar:dative-verbs::ex-1:default': card(50),
      'phrase:classic-idioms::wurst:phrase_to_meaning': card(60),
    },
    packs: { 'vocab:core-verbs-1': { active: true, triaged: true }, 'vocab:core-adj-1': { active: false, triaged: true } },
    settings: { dailyNewLimit: 12, theme: 'dark', wordfallDirection: 'en_de', wordfallPackIds: ['core-nouns-1'] },
    stats: { streak: 3, bestStreak: 8, lastStudyDate: '2026-11-14', history: {}, gameBests: { wordfall: { score: 9 } } },
    userContent: { vocab: [{ id: 'hund-abc', pos: 'noun', lemma: 'Hund', meaning_en: 'dog', gender: 'der', plural: 'Hunde' }], phrases: [], notes: [] },
    meta: { createdAt: '2026-01-01T00:00:00.000Z', lastSeenUpdateId: '2026-11-15-update-notes' },
  };
  const store = await freshStore({ [MAIN_KEY]: JSON.stringify(blob) });
  assert.equal(store.loadFailed, false);
  assert.deepEqual(store.allCards(), blob.srsCards);
  assert.deepEqual(store.allPackStates(), blob.packs);
  assert.deepEqual(store.getUserContent().vocab, blob.userContent.vocab);
  assert.deepEqual(store.getSettings().wordfallPackIds, ['core-nouns-1']); // kept, unused
  assert.deepEqual(store.getSettings().gameExtraPackIds, []); // additive default
  assert.equal(store.getSettings().dailyNewLimit, 12);
});

test('pre-change stored triage fields (triaged / pendingTriageWordIds) and partial cards load intact', async () => {
  const card = (due) => ({ status: 'review', ease: 2.5, interval: 3, learningStep: 0, reps: 2, lapses: 0, due, lastReviewed: due - 1 });
  const blob = {
    version: 2,
    srsCards: {
      'vocab:core-nouns-1::tisch:gender': card(1), // partial: only gender, from a game
      'vocab:core-verbs-1::gehen:meaning': card(2),
      'vocab:core-verbs-1::gehen:principal_parts': card(3),
    },
    packs: {
      'vocab:core-verbs-1': { active: true, triaged: true, pendingTriageWordIds: [] },
      'vocab:core-nouns-1': { active: true, triaged: false, pendingTriageWordIds: ['lampe', 'stuhl'] },
      'vocab:core-adj-1': { active: false, triaged: true },
    },
    settings: { dailyNewLimit: 18 },
    stats: { streak: 1, bestStreak: 1, lastStudyDate: '2026-11-14', history: {}, gameBests: {} },
    userContent: { vocab: [], phrases: [], notes: [] },
    meta: { createdAt: '2026-01-01T00:00:00.000Z' },
  };
  const store = await freshStore({ [MAIN_KEY]: JSON.stringify(blob) });
  assert.equal(store.loadFailed, false);
  assert.deepEqual(store.allCards(), blob.srsCards);
  assert.deepEqual(store.allPackStates(), blob.packs);
});
