// Ties together storage + content + the SRS engine: builds the daily review
// queue, runs pack activation/triage, and answers the dashboard's questions
// ("what's due", "what's weak"). This is the only module that knows how
// vocab/phrase/grammar content maps onto SRS card ids.

import { store } from '../db/storage.js';
import * as engine from './engine.js';
import { localDayKey } from '../db/dayKey.js';
import {
  getVocabPacks,
  getPhraseSets,
  getGrammarUnits,
  findWord,
  findVocabPack,
  findPhrase,
  findExercise,
} from '../db/contentLoader.js';
import { vocabCardId, phraseCardId, grammarCardId } from './cardIds.js';
import {
  USER_VOCAB_PACK_ID,
  parseCardId,
  isSourceInReview,
  triageQueueFor,
  triageEntries,
  missingFacetEntries,
  shouldGradeGameWord,
} from './vocabScope.js';

export { vocabCardId, phraseCardId, grammarCardId };

function packKey(type, id) {
  return `${type}:${id}`;
}

// --- Pack / unit activation ---------------------------------------------

export function isPackActive(type, id) {
  return store.getPackState(packKey(type, id)).active;
}

/** Whether a vocab pack's cards count toward review — what the pack on/off toggles should show (user-added is on unless switched off). */
export function isVocabPackInReview(packId) {
  return isSourceInReview('vocab', packId, store.allPackStates());
}

export function activateVocabPack(packId) {
  const pack = getVocabPacks().find((p) => p.id === packId);
  if (!pack) return;
  // Words missing a card for any facet need triage; triage fills only the
  // missing facets, so cards from an earlier activation or a game are kept as they are.
  const pending = triageQueueFor(pack.words, packId, store.allCards());
  store.setPackState(packKey('vocab', packId), {
    active: true,
    triaged: pending.length === 0,
    pendingTriageWordIds: pending,
  });
}

export function deactivateVocabPack(packId) {
  store.setPackState(packKey('vocab', packId), { active: false });
}

/**
 * Words of an active pack still pending triage, computed live from the cards
 * (any facet missing), so words added to the pack by a later content update
 * are offered too. The stored pendingTriageWordIds/triaged are kept up to date
 * by activateVocabPack/triageWord but are not what this reads: every word in
 * that stored list is either still missing a facet (included here) or fully
 * carded (nothing left to triage).
 */
export function getPendingTriageWords(packId) {
  if (!isVocabPackInReview(packId)) return [];
  const pack = getVocabPacks().find((p) => p.id === packId);
  const pending = new Set(triageQueueFor(pack?.words || [], packId, store.allCards()));
  return (pack?.words || []).filter((w) => pending.has(w.id));
}

/**
 * Apply a triage decision for one word: 'known' schedules its facets far out,
 * 'drill' enqueues them as new cards. Only facets with no card are written;
 * triage never replaces an existing card.
 */
export function triageWord(packId, wordId, decision) {
  const word = findWord(packId, wordId);
  if (!word) return;
  const entries = triageEntries(packId, word, decision, store.allCards(), Date.now());
  if (entries.length) store.setCards(entries);

  const remaining = getPendingTriageWords(packId).map((w) => w.id);
  store.setPackState(packKey('vocab', packId), { pendingTriageWordIds: remaining, triaged: remaining.length === 0 });
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

/**
 * Words added in the app go straight into daily review as new cards: create
 * any missing facet cards for every user-added word (never touching existing
 * ones). Idempotent; also backfills words added before this rule existed.
 */
export function ensureUserVocabCards() {
  if (!isSourceInReview('vocab', USER_VOCAB_PACK_ID, store.allPackStates())) return;
  const pack = findVocabPack(USER_VOCAB_PACK_ID);
  if (!pack) return;
  const now = Date.now();
  const cards = store.allCards();
  const entries = pack.words.flatMap((w) => missingFacetEntries(USER_VOCAB_PACK_ID, w, cards, now));
  if (entries.length) store.setCards(entries);
}

export function ensureContentCards() {
  ensureUserVocabCards();
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
    const { type, sourceId, itemId, facet } = parseCardId(cardId);
    refs.push({ cardId, type, sourceId, itemId, facet, card: cards[cardId] });
  }
  return refs;
}

/**
 * Whether a card's source counts toward review (queue, due counts, throttle,
 * strength, weakest items, Test me). Vocab packs must be explicitly active;
 * cards from other packs stay stored, just unused. See vocabScope.js.
 */
function isSourceActive(type, sourceId) {
  return isSourceInReview(type, sourceId, store.allPackStates());
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
  const today = localDayKey();
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
 * The only way vocab games grade a word. Words from the game pool
 * (shared/gamePool.js) marked practice-only are ignored: no card is created
 * or changed. Graded words go through submitGradeForCardId as before.
 */
export function gradeGameWord(word, facet, gradeValue, now = Date.now()) {
  if (!shouldGradeGameWord(word)) return;
  submitGradeForCardId(vocabCardId(word.packId, word.id, facet), gradeValue, now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Higher = more urgent: overdue days plus a weakness bonus, so badly-overdue and shaky cards surface first within a session. */
function urgencyScore(card, now) {
  const overdueDays = Math.max(0, (now - card.due) / DAY_MS);
  const weakness = 1 - engine.strength(card);
  return overdueDays + weakness;
}

function dueRefs(now = Date.now()) {
  ensureContentCards();
  const refs = allCardRefs().filter((r) => isSourceActive(r.type, r.sourceId));
  return refs.filter((r) => r.card.status !== 'new' && engine.isDue(r.card, now));
}

/** Count of due (non-new) cards only — the true backlog, unaffected by new-card throttling or session chunking. */
export function dueOnlyCount(now = Date.now()) {
  return dueRefs(now).length;
}

/**
 * Auto-throttle status for new-card intake, based on the raw due backlog:
 * 'reduced' halves the daily new-card allowance, 'paused' stops new cards
 * entirely, so the queue is self-correcting instead of snowballing.
 */
export function throttleStatus(now = Date.now()) {
  const settings = store.getSettings();
  const due = dueOnlyCount(now);
  if (due >= settings.throttlePauseThreshold) return { level: 'paused', due };
  if (due >= settings.throttleQueueThreshold) return { level: 'reduced', due };
  return { level: null, due };
}

/**
 * Builds today's full review assignment: all due (learning/review) cards —
 * most overdue and weakest first — plus new cards up to the remaining daily
 * allowance (reduced or paused by throttleStatus), interleaved across
 * modules. The dashboard/review UI slices this into session-sized chunks
 * (see Settings > review session size) rather than serving it all at once.
 */
export function buildReviewSession({ now = Date.now() } = {}) {
  ensureContentCards();
  const refs = allCardRefs().filter((r) => isSourceActive(r.type, r.sourceId));

  const due = refs
    .filter((r) => r.card.status !== 'new' && engine.isDue(r.card, now))
    .sort((a, b) => urgencyScore(b.card, now) - urgencyScore(a.card, now));

  const settings = store.getSettings();
  const { level: throttleLevel } = throttleStatus(now);
  const dailyLimit =
    throttleLevel === 'paused' ? 0 : throttleLevel === 'reduced' ? Math.floor(settings.dailyNewLimit / 2) : settings.dailyNewLimit;
  const allowanceLeft = Math.max(0, dailyLimit - getTodayNewSeenCount());

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
