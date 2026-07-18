// Single localStorage-backed store for all on-device state: SRS card states,
// pack activation, settings, stats, and user-added content. Everything lives
// under one key so Export/Import backup is a single JSON blob.

const STORAGE_KEY = 'german-app-data-v1';
const SCHEMA_VERSION = 1;

function defaultData() {
  return {
    version: SCHEMA_VERSION,
    srsCards: {}, // cardId -> CardState (see src/srs/engine.js)
    packs: {}, // "vocab:core-verbs-1" -> { active: bool, triaged: bool }
    settings: {
      dailyNewLimit: 18,
      theme: 'auto',
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

function migrate(data) {
  const base = defaultData();
  const merged = {
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
    version: SCHEMA_VERSION,
  };
  return merged;
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
  return cache;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
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
  resetAll() {
    cache = defaultData();
    persist();
  },
};

function bumpStreak(data, today) {
  if (data.stats.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  data.stats.streak = data.stats.lastStudyDate === yesterday ? data.stats.streak + 1 : 1;
  data.stats.bestStreak = Math.max(data.stats.bestStreak || 0, data.stats.streak);
  data.stats.lastStudyDate = today;
}
