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

import { localDayKey, previousDayKey } from './dayKey.js';
import { newestUpdateId, shouldShowUpdateAlert } from '../updateNotes.js';

const STORAGE_KEY = 'german-app-data-v1';
const SNAPSHOTS_KEY = 'german-app-snapshots-v1';
const RECOVERY_KEY = 'german-app-recovery-v1';
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
      uiLanguage: 'de', // 'de' | 'en' — nav/button/tab chrome translated via src/i18n.js
      typeItCheckGender: false, // Type it (beta game): require the article (e.g. "der Löffel") on noun answers
      wordfallDirection: 'de_en', // 'de_en' | 'en_de' — Wordfall practice direction
      wordfallPackIds: [], // retired: Wordfall's old pack picker. Kept in stored data, no longer read (see gameExtraPackIds)
      gameExtraPackIds: [], // vocab pack ids every vocab game also draws from, practice-only (never graded into the SRS)
      coreNewPerDay: 20, // Core 1000 tab: new words per day (separate from dailyNewLimit)
    },
    stats: {
      streak: 0,
      bestStreak: 0,
      lastStudyDate: null, // 'YYYY-MM-DD'
      history: {}, // 'YYYY-MM-DD' -> { reviewed: n, newSeen: n, gamesPlayed: n }
      gameBests: {}, // gameId -> best score
    },
    core: {
      unlockedBands: 0, // Core 1000 tab: how many bands of 50 (by rank) the user has unlocked, 0-20
    },
    userContent: {
      vocab: [], // full word objects, packId: 'user-added'
      phrases: [],
      notes: [],
    },
    meta: {
      createdAt: new Date().toISOString(),
      // Id of the newest update note this device has seen. null here on purpose:
      // migrate() backfills it for existing users (so they see the alert once);
      // only a genuine first run is stamped, in load().
      lastSeenUpdateId: null,
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
    core: { ...base.core, ...(data.core || {}) },
    meta: { ...base.meta, ...(data.meta || {}) },
    version: STORAGE_VERSION,
  };
}

let cache = null;

// Failed-load state. If a blob exists under STORAGE_KEY but can't be parsed,
// validated, or migrated, we must NOT fall back to defaults and then save
// over it — that would silently wipe the user's only copy of their progress.
// Instead the raw string is copied to RECOVERY_KEY, the store goes read-only
// (persist() and maybeSnapshot() become no-ops), and main.js shows the
// recovery screen until a restore/import/confirmed start-fresh clears it.
let loadFailed = false;
let recoveryCopySaved = false;

/** True for a plain `{...}` object (not null, not an array, not a primitive). */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Minimal sanity check on a stored blob: a plain object whose srsCards/settings/stats, where present, are plain objects. */
function hasLoadableShape(data) {
  if (!isPlainObject(data)) return false;
  return ['srsCards', 'settings', 'stats'].every((k) => data[k] === undefined || isPlainObject(data[k]));
}

/** Stricter check for an imported file: it must look like a German-app backup, not just any JSON object. */
function isGermanAppBackup(data) {
  return isPlainObject(data) && ['srsCards', 'settings', 'stats'].every((k) => isPlainObject(data[k]));
}

/**
 * Copy the unloadable raw string, untouched, to RECOVERY_KEY. Entries are
 * appended (never replaced); an identical raw string already saved isn't
 * duplicated. If the recovery key itself is unreadable, we write to a
 * timestamped sibling key instead of overwriting it.
 */
function saveRecoveryCopy(raw, error) {
  const entry = { savedAt: new Date().toISOString(), error: String(error?.message || error), raw };
  try {
    const existingRaw = localStorage.getItem(RECOVERY_KEY);
    let entries = [];
    if (existingRaw != null) {
      try {
        entries = JSON.parse(existingRaw);
      } catch {
        entries = null;
      }
      if (!Array.isArray(entries)) {
        localStorage.setItem(`${RECOVERY_KEY}-${Date.now()}`, JSON.stringify([entry]));
        return true;
      }
    }
    if (entries.some((e) => e && e.raw === raw)) return true;
    entries.push(entry);
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Failed to save a recovery copy of the unloadable data (storage may be full). The original is still untouched under ' + STORAGE_KEY + '.', e);
    return false;
  }
}

function enterFailedState(raw, error) {
  console.error('Saved app data could not be loaded. Saving is disabled until it is recovered; nothing has been overwritten.', error);
  loadFailed = true;
  recoveryCopySaved = raw != null ? saveRecoveryCopy(raw, error) : false;
  // In-memory defaults only, so theme/i18n can still read settings. Never persisted while loadFailed.
  cache = defaultData();
}

function load() {
  if (cache) return cache;
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    enterFailedState(null, e);
    return cache;
  }
  if (raw === null) {
    // First run: nothing saved yet. A brand-new install has nothing to be
    // told about, so it starts as having seen the newest update note.
    cache = defaultData();
    cache.meta.lastSeenUpdateId = newestUpdateId();
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (!hasLoadableShape(parsed)) throw new Error('Saved data is not an object with the expected srsCards/settings/stats shape.');
      cache = migrate(parsed);
    } catch (e) {
      enterFailedState(raw, e);
      return cache;
    }
  }
  maybeSnapshot(cache);
  return cache;
}

// Save-failure state (storage full or otherwise refusing writes). A failed
// write never throws to callers and never touches what's on disk: the
// in-memory data is kept, `saveFailed` is set, and every later persist()
// retries writing the whole blob. Nothing is ever deleted or shrunk to make
// room. In-memory only; re-evaluated on every save.
let saveFailed = false;
// Set when today's daily snapshot couldn't be written even after dropping
// older ones (see maybeSnapshot). In-memory only; re-evaluated on each load.
let snapshotsFailing = false;
const saveStatusListeners = new Set();

function notifySaveStatus() {
  saveStatusListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Save-status listener failed.', e);
    }
  });
}

/** Writes the in-memory blob. Returns null on success, or the write error (never throws). */
function persist() {
  if (loadFailed) {
    console.error('Not saving: stored data failed to load and is awaiting recovery.');
    return null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    if (!saveFailed) {
      console.error('Saving progress failed (storage may be full). Progress is kept in memory and saving will be retried on the next change; the last saved copy on disk is untouched.', e);
      saveFailed = true;
      notifySaveStatus();
    }
    return e;
  }
  if (saveFailed) {
    saveFailed = false;
    notifySaveStatus();
  }
  return null;
}

/** Replace the in-memory data with recovered data, leave the failed state, and save. Throws if the save fails, as before. */
function replaceAndSave(data) {
  load(); // ensure an unloadable blob has been copied to the recovery key before we overwrite it
  cache = data;
  loadFailed = false;
  const err = persist();
  if (err) throw err;
  return cache;
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
  if (loadFailed) return;
  const today = localDayKey();
  const snapshots = loadSnapshots();
  if (snapshots.some((s) => s.date === today)) return;
  snapshots.push({ date: today, data: JSON.parse(JSON.stringify(data)) });
  const candidates = snapshots.slice(-SNAPSHOT_RETENTION_DAYS);
  // If it doesn't fit, drop the oldest snapshot and retry, down to today's
  // alone. A setItem that throws writes nothing, so if every attempt fails
  // the existing snapshots are left exactly as they were.
  let lastError = null;
  while (candidates.length > 0) {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(candidates));
      snapshotsFailing = false;
      return;
    } catch (e) {
      lastError = e;
      candidates.shift();
    }
  }
  snapshotsFailing = true;
  console.error("Failed to write today's daily snapshot (storage may be full); existing snapshots left untouched.", lastError);
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
    const today = localDayKey();
    if (!data.stats.history[today]) {
      data.stats.history[today] = { reviewed: 0, newSeen: 0, gamesPlayed: 0 };
    }
    data.stats.history[today][kind] = (data.stats.history[today][kind] || 0) + count;
    bumpStreak(data, today);
    persist();
  },

  // --- Core 1000 tab ---
  getCoreState() {
    return load().core;
  },
  updateCoreState(patch) {
    const data = load();
    data.core = { ...data.core, ...patch };
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
  /** Validates before replacing anything: a non-JSON or non-German-app file throws and leaves current data untouched. */
  importBackup(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (!isGermanAppBackup(parsed)) {
      throw new Error("That file doesn't look like a Deutsch Trainer backup (missing srsCards/settings/stats).");
    }
    return replaceAndSave(migrate(parsed));
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

  // --- Update notes ---
  shouldShowUpdateAlert() {
    return shouldShowUpdateAlert(load().meta.lastSeenUpdateId, newestUpdateId());
  },
  markUpdatesSeen() {
    const data = load();
    if (data.meta.lastSeenUpdateId === newestUpdateId()) return;
    data.meta.lastSeenUpdateId = newestUpdateId();
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
    if (!hasLoadableShape(found.data)) throw new Error(`Snapshot for ${date} is not in a loadable shape.`);
    return replaceAndSave(migrate(found.data));
  },

  // --- Save health (see persist / maybeSnapshot) ---
  /** True while the latest save failed (e.g. storage full); in-memory data is kept and the next save retries. */
  get saveFailed() {
    return saveFailed;
  },
  /** True when today's daily snapshot couldn't be written this session. */
  get snapshotsFailing() {
    load();
    return snapshotsFailing;
  },
  /** Subscribe to saveFailed changes. Returns an unsubscribe function. */
  onSaveStatusChange(fn) {
    saveStatusListeners.add(fn);
    return () => saveStatusListeners.delete(fn);
  },
  /** Approximate on-disk size in characters (key + stored value) of the main data and the snapshots. */
  getStorageUsage() {
    const size = (key) => {
      try {
        const v = localStorage.getItem(key);
        return v == null ? 0 : key.length + v.length;
      } catch {
        return 0;
      }
    };
    return { main: size(STORAGE_KEY), snapshots: size(SNAPSHOTS_KEY) };
  },

  // --- Failed-load recovery (see enterFailedState) ---
  /** True when saved data exists but couldn't be loaded; the store is read-only until recovered. */
  get loadFailed() {
    load();
    return loadFailed;
  },
  /** Whether the unloadable raw data was successfully copied to the recovery key. */
  get recoveryCopySaved() {
    load();
    return recoveryCopySaved;
  },
  /** The raw saved string as it sits on disk (main key, falling back to the newest recovery copy), for download. */
  getRawSavedData() {
    const main = localStorage.getItem(STORAGE_KEY);
    if (main != null) return main;
    try {
      const entries = JSON.parse(localStorage.getItem(RECOVERY_KEY));
      return Array.isArray(entries) && entries.length ? entries[entries.length - 1].raw : null;
    } catch {
      return null;
    }
  },
  /** Recovery screen's "Start fresh" (after explicit confirmation): fresh defaults, saving re-enabled, recovery copy kept. */
  startFreshAfterFailedLoad() {
    return replaceAndSave(defaultData());
  },
};

function bumpStreak(data, today) {
  if (data.stats.lastStudyDate === today) return;
  const yesterday = previousDayKey(today);
  data.stats.streak = data.stats.lastStudyDate === yesterday ? data.stats.streak + 1 : 1;
  data.stats.bestStreak = Math.max(data.stats.bestStreak || 0, data.stats.streak);
  data.stats.lastStudyDate = today;
}
