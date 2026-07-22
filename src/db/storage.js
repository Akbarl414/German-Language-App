// Single localStorage-backed store for all on-device state: SRS card states,
// pack activation, settings, stats, and user-added content. Everything lives
// under one key so Export/Import backup is a single JSON blob.
//
// *** User progress data is sacred. ***
// No change here may reset, wipe, or silently break compatibility with data
// already on someone's device. If you change the shape of anything under
// `defaultData()`, you MUST add a migration step to MIGRATIONS below (keyed
// by the version it upgrades FROM) rather than relying on defaults to paper
// over it — the additive merge in `migrate()` is a safety net for missing
// fields, not a substitute for a real migration when values themselves need
// to change shape or meaning.

const STORAGE_KEY = 'german-app-data-v1';
const SNAPSHOTS_KEY = 'german-app-snapshots-v1';
const SNAPSHOT_RETENTION_DAYS = 7;
const BACKUP_REMINDER_DAYS = 7;

export const STORAGE_VERSION = 2;

function defaultData() {
  return {
    version: STORAGE_VERSION,
    srsCards: {}, // cardId -> CardState (see src/srs/engine.js)
    packs: {}, // "vocab:core-verbs-1" -> { active: bool, triaged: bool }
    settings: {
      dailyNewLimit: 18,
      theme: 'system', // 'light' | 'dark' | 'system'
      reviewSessionSize: 30, // reviews are served in chunks of this size, most-urgent first
      throttleQueueThreshold: 60, // due queue size above which new-card intake is halved
      throttlePauseThreshold: 100, // due queue size above which new cards pause entirely
    },
    stats: {
      streak: 0,
      bestStreak: 0,
      lastStudyDate: null, // 'YYYY-MM-DD'
      history: {}, // 'YYYY-MM-DD' -> { reviewed: n, newSeen: n, gamesPlayed: n }
      gameBests: {}, // gameId -> best score
    },
    userContent: {
      vocab: [], // full word objects, packId: 'user-added'
      phrases: [],
      notes: [],
    },
    meta: {
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Version-gated migrations. Each key is the version a stored blob might be
 * AT, and the function returns it transformed to key+1. Add a new entry
 * every time STORAGE_VERSION is bumped — never remove or renumber an old
 * one, since a device could still be sitting on any past version.
 */
const MIGRATIONS = {
  1: (data) => {
    // theme setting was renamed 'auto' -> 'system' to match the Settings copy.
    if (data.settings?.theme === 'auto') data.settings.theme = 'system';
    return data;
  },
};

function runMigrations(data) {
  let version = data.version || 1;
  while (version < STORAGE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) data = step(data);
    version++;
  }
  data.version = STORAGE_VERSION;
  return data;
}

/** Additive merge with defaults — a safety net for missing fields, applied AFTER migrations run. Never drops existing data. */
function migrate(rawData) {
  const data = runMigrations(rawData);
  const base = defaultData();
  return {
    ...base,
    ...data,
    srsCards: { ...base.srsCards, ...(data.srsCards || {}) },
    packs: { ...base.packs, ...(data.packs || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
    stats: {
      ...base.stats,
      ...(data.stats || {}),
      history: { ...base.stats.history, ...(data.stats?.history || {}) },
      gameBests: { ...base.stats.gameBests, ...(data.stats?.gameBests || {}) },
    },
    userContent: {
      ...base.userContent,
      ...(data.userContent || {}),
    },
    meta: { ...base.meta, ...(data.meta || {}) },
    version: STORAGE_VERSION,
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? migrate(JSON.parse(raw)) : defaultData();
  } catch (e) {
    console.error('Failed to load app data, starting fresh.', e);
    cache = defaultData();
  }
  maybeSnapshot(cache);
  return cache;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

// --- Rolling daily snapshots (separate key, so a bad write to one can't take out the other) ---

function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || [];
  } catch {
    return [];
  }
}

function maybeSnapshot(data) {
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = loadSnapshots();
  if (snapshots.some((s) => s.date === today)) return;
  snapshots.push({ date: today, data: JSON.parse(JSON.stringify(data)) });
  const trimmed = snapshots.slice(-SNAPSHOT_RETENTION_DAYS);
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to write daily snapshot (storage may be full).', e);
  }
}

export const store = {
  get data() {
    return load();
  },

  save() {
    persist();
  },

  // --- SRS cards ---
  getCard(cardId) {
    return load().srsCards[cardId];
  },
  setCard(cardId, card) {
    load().srsCards[cardId] = card;
    persist();
  },
  setCards(entries) {
    const data = load();
    for (const [id, card] of entries) data.srsCards[id] = card;
    persist();
  },
  allCards() {
    return load().srsCards;
  },

  // --- Pack activation ---
  // `active: undefined` (not `false`) for never-touched packs, so callers can
  // tell "never touched" apart from "explicitly turned off" — grammar units
  // and phrase sets default to active, vocab packs default to inactive, and
  // both rely on being able to distinguish these two states.
  getPackState(key) {
    return load().packs[key] || { active: undefined, triaged: false };
  },
  setPackState(key, state) {
    const data = load();
    data.packs[key] = { ...data.packs[key], ...state };
    persist();
  },
  allPackStates() {
    return load().packs;
  },

  // --- Settings ---
  getSettings() {
    return load().settings;
  },
  updateSettings(patch) {
    const data = load();
    data.settings = { ...data.settings, ...patch };
    persist();
  },

  // --- Stats ---
  getStats() {
    return load().stats;
  },
  updateStats(patch) {
    const data = load();
    data.stats = { ...data.stats, ...patch };
    persist();
  },
  recordDailyActivity(kind, count = 1) {
    const data = load();
    const today = new Date().toISOString().slice(0, 10);
    if (!data.stats.history[today]) {
      data.stats.history[today] = { reviewed: 0, newSeen: 0, gamesPlayed: 0 };
    }
    data.stats.history[today][kind] = (data.stats.history[today][kind] || 0) + count;
    bumpStreak(data, today);
    persist();
  },

  // --- User-added content ---
  getUserContent() {
    return load().userContent;
  },
  addUserVocab(word) {
    const data = load();
    data.userContent.vocab.push(word);
    persist();
  },
  addUserPhrase(phrase) {
    const data = load();
    data.userContent.phrases.push(phrase);
    persist();
  },
  addUserNote(note) {
    const data = load();
    data.userContent.notes.push(note);
    persist();
  },

  // --- Backup ---
  exportBackup() {
    const data = load();
    data.meta.lastExportAt = new Date().toISOString();
    persist();
    return JSON.stringify(data, null, 2);
  },
  importBackup(json) {
    const parsed = JSON.parse(json);
    cache = migrate(parsed);
    persist();
    return cache;
  },
  /** True once it's been 7+ days since the last export (or since first use, if never exported). */
  shouldPromptBackup() {
    const data = load();
    const last = data.meta.lastExportAt || data.meta.createdAt;
    if (!last) return false;
    return Date.now() - new Date(last).getTime() > BACKUP_REMINDER_DAYS * 86400000;
  },
  resetAll() {
    cache = defaultData();
    persist();
  },

  // --- Snapshots (automatic daily checkpoints, independent of Export/Import) ---
  listSnapshots() {
    return loadSnapshots()
      .map((s) => s.date)
      .sort()
      .reverse();
  },
  restoreSnapshot(date) {
    const snapshots = loadSnapshots();
    const found = snapshots.find((s) => s.date === date);
    if (!found) throw new Error(`No snapshot found for ${date}`);
    cache = migrate(found.data);
    persist();
    return cache;
  },
};

function bumpStreak(data, today) {
  if (data.stats.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  data.stats.streak = data.stats.lastStudyDate === yesterday ? data.stats.streak + 1 : 1;
  data.stats.bestStreak = Math.max(data.stats.bestStreak || 0, data.stats.streak);
  data.stats.lastStudyDate = today;
}
