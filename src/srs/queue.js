// Ties together storage + content + the SRS engine: builds the daily review
// queue, runs pack activation/triage, and answers the dashboard's questions
// ("what's due", "what's weak"). This is the only module that knows how
// vocab/phrase/grammar content maps onto SRS card ids.

import { store } from '../db/storage.js';
import * as engine from './engine.js';
import {
  getVocabPacks,
  getPhraseSets,
  getGrammarUnits,
  findWord,
  findPhrase,
  findExercise,
} from '../db/contentLoader.js';

export function vocabCardId(packId, wordId, facet) {
  return `vocab:${packId}::${wordId}:${facet}`;
}
export function phraseCardId(setId, phraseId, facet) {
  return `phrase:${setId}::${phraseId}:${facet}`;
}
export function grammarCardId(unitId, exerciseId) {
  return `grammar:${unitId}::${exerciseId}:default`;
}

function packKey(type, id) {
  return `${type}:${id}`;
}

// --- Pack / unit activation ---------------------------------------------

export function isPackActive(type, id) {
  return store.getPackState(packKey(type, id)).active;
}

export function activateVocabPack(packId) {
  const pack = getVocabPacks().find((p) => p.id === packId);
  if (!pack) return;
  store.setPackState(packKey('vocab', packId), {
    active: true,
    triaged: pack.words.length === 0,
    pendingTriageWordIds: pack.words.map((w) => w.id),
  });
}

export function deactivateVocabPack(packId) {
  store.setPackState(packKey('vocab', packId), { active: false });
}

export function getPendingTriageWords(packId) {
  const state = store.getPackState(packKey('vocab', packId));
  if (!state.active || state.triaged) return [];
  const pack = getVocabPacks().find((p) => p.id === packId);
  const pending = new Set(state.pendingTriageWordIds || []);
  return (pack?.words || []).filter((w) => pending.has(w.id));
}

/** Apply a triage decision for one word: 'known' schedules all facets far out, 'drill' enqueues them as new cards. */
export function triageWord(packId, wordId, decision) {
  const word = findWord(packId, wordId);
  if (!word) return;
  const now = Date.now();
  const facets = engine.facetsFor(word.pos);
  const entries = facets.map((facet) => {
    const id = vocabCardId(packId, wordId, facet);
    const card = decision === 'known' ? engine.learnedCard(now) : engine.newCard(now);
    return [id, card];
  });
  store.setCards(entries);

  const key = packKey('vocab', packId);
  const state = store.getPackState(key);
  const remaining = (state.pendingTriageWordIds || []).filter((id) => id !== wordId);
  store.setPackState(key, { pendingTriageWordIds: remaining, triaged: remaining.length === 0 });
}

function ensurePhraseCards(setId, phrase) {
  const now = Date.now();
  const entries = [];
  for (const facet of engine.FACETS.phrase) {
    const id = phraseCardId(setId, phrase.id, facet);
    if (!store.getCard(id)) entries.push([id, engine.newCard(now)]);
  }
  if (entries.length) store.setCards(entries);
}

function ensureGrammarCard(unitId, exercise) {
  const id = grammarCardId(unitId, exercise.id);
  if (!store.getCard(id)) store.setCard(id, engine.newCard(Date.now()));
}

/** Phrase sets and grammar units are active by default (no triage step — small, curated content). */
function isActiveByDefault(type, id) {
  const state = store.getPackState(packKey(type, id));
  return state.active !== false; // undefined (never touched) counts as active
}

export function ensureContentCards() {
  for (const set of getPhraseSets()) {
    if (!isActiveByDefault('phrase', set.id)) continue;
    for (const phrase of set.phrases) ensurePhraseCards(set.id, phrase);
  }
  for (const unit of getGrammarUnits()) {
    if (!isActiveByDefault('grammar', unit.id)) continue;
    for (const ex of unit.exercises) ensureGrammarCard(unit.id, ex);
  }
}

// --- Queue building -------------------------------------------------------

function resolveContent(type, ref) {
  if (type === 'vocab') return findWord(ref.sourceId, ref.itemId);
  if (type === 'phrase') return findPhrase(ref.sourceId, ref.itemId);
  if (type === 'grammar') return findExercise(ref.sourceId, ref.itemId);
  return null;
}

/** Walk every SRS card and yield {cardId, type, sourceId, itemId, facet, card}. */
function allCardRefs() {
  const cards = store.allCards();
  const refs = [];
  for (const cardId of Object.keys(cards)) {
    const [type, rest] = cardId.split(':');
    const [sourceId, itemAndFacet] = rest.split('::');
    const lastColon = itemAndFacet.lastIndexOf(':');
    const itemId = itemAndFacet.slice(0, lastColon);
    const facet = itemAndFacet.slice(lastColon + 1);
    refs.push({ cardId, type, sourceId, itemId, facet, card: cards[cardId] });
  }
  return refs;
}

function isSourceActive(type, sourceId) {
  return store.getPackState(packKey(type, sourceId)).active !== false;
}

/**
 * All content items of a given type (vocab/phrase/grammar) from active
 * sources, each paired with its SRS card and resolved content — used by
 * mixed quizzes and Test-me to sample weighted toward weak spots without
 * being limited to today's due queue.
 */
export function getRefsByType(type) {
  ensureContentCards();
  return allCardRefs()
    .filter((r) => r.type === type && isSourceActive(r.type, r.sourceId))
    .map((r) => ({ ...r, content: resolveContent(r.type, r) }))
    .filter((r) => r.content != null);
}

export function getTodayNewSeenCount() {
  const today = new Date().toISOString().slice(0, 10);
  return store.getStats().history[today]?.newSeen || 0;
}

/**
 * Grade a card by id directly, outside the daily review queue — used by
 * grammar unit practice, mixed quizzes, and Test-me, which pull exercises
 * on demand rather than only from today's due queue.
 */
export function submitGradeForCardId(cardId, gradeValue, now = Date.now()) {
  const existing = store.getCard(cardId) || engine.newCard(now);
  const wasNew = existing.status === 'new';
  const next = engine.grade(existing, gradeValue, now);
  store.setCard(cardId, next);
  store.recordDailyActivity('reviewed');
  if (wasNew) store.recordDailyActivity('newSeen');
}

/**
 * Builds today's review session: all due (learning/review) cards, plus new
 * cards up to the remaining daily allowance, interleaved across modules.
 */
export function buildReviewSession({ now = Date.now() } = {}) {
  ensureContentCards();
  const refs = allCardRefs().filter((r) => isSourceActive(r.type, r.sourceId));

  const due = refs
    .filter((r) => r.card.status !== 'new' && engine.isDue(r.card, now))
    .sort((a, b) => a.card.due - b.card.due);

  const settings = store.getSettings();
  const allowanceLeft = Math.max(0, settings.dailyNewLimit - getTodayNewSeenCount());

  const newByType = { vocab: [], phrase: [], grammar: [] };
  for (const r of refs) {
    if (r.card.status === 'new') newByType[r.type]?.push(r);
  }
  const newCards = interleave([newByType.vocab, newByType.phrase, newByType.grammar]).slice(0, allowanceLeft);

  const items = [...due, ...newCards].map((r) => ({
    ...r,
    isNew: r.card.status === 'new',
    content: resolveContent(r.type, r),
  }));

  return items.filter((i) => i.content != null);
}

function interleave(lists) {
  const out = [];
  const cursors = lists.map(() => 0);
  let remaining = lists.reduce((n, l) => n + l.length, 0);
  while (remaining > 0) {
    for (let i = 0; i < lists.length; i++) {
      if (cursors[i] < lists[i].length) {
        out.push(lists[i][cursors[i]]);
        cursors[i]++;
        remaining--;
      }
    }
  }
  return out;
}

/** Submit a grade for a queue item; updates SRS state and today's stats. */
export function submitReview(item, gradeValue, now = Date.now()) {
  const wasNew = item.card.status === 'new';
  const next = engine.grade(item.card, gradeValue, now);
  store.setCard(item.cardId, next);
  store.recordDailyActivity('reviewed');
  if (wasNew) store.recordDailyActivity('newSeen');
}

// --- Weak-spot weighting (grammar mixed quiz, Test-me mode) ---------------

function weightForCard(card) {
  if (!card) return 3; // never-seen: prioritize somewhat, but not as much as known-weak
  const s = engine.strength(card);
  const lapsePenalty = 1 + card.lapses * 0.5;
  return Math.max(0.2, (1 - s) * 3 * lapsePenalty);
}

/** Weighted random sample without replacement, biased toward weak/new items. */
export function weightedSample(entriesWithCards, count) {
  const pool = entriesWithCards.map((e) => ({ entry: e, weight: weightForCard(e.card) }));
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      roll -= pool[idx].weight;
      if (roll <= 0) break;
    }
    const chosen = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    picked.push(chosen.entry);
  }
  return picked;
}

// --- Dashboard stats --------------------------------------------------------

export function dueTodayCount(now = Date.now()) {
  return buildReviewSession({ now }).length;
}

export function moduleStrength() {
  const refs = allCardRefs().filter((r) => isSourceActive(r.type, r.sourceId));
  const byType = { vocab: [], phrase: [], grammar: [] };
  for (const r of refs) byType[r.type]?.push(r.card);
  const avg = (cards) => (cards.length ? cards.reduce((s, c) => s + engine.strength(c), 0) / cards.length : null);
  return {
    vocab: avg(byType.vocab),
    phrase: avg(byType.phrase),
    grammar: avg(byType.grammar),
  };
}

export function weakestItems(count = 10) {
  const refs = allCardRefs()
    .filter((r) => isSourceActive(r.type, r.sourceId))
    .filter((r) => r.card.status !== 'new' && r.card.reps > 0);
  const scored = refs
    .map((r) => ({ ...r, score: engine.strength(r.card) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((r) => ({ ...r, content: resolveContent(r.type, r) }))
    .filter((r) => r.content != null);
  return scored;
}
