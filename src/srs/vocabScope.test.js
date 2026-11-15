// Tests for the pure review-scope / game-pool rules in vocabScope.js, run
// against a real store over an in-memory localStorage where the rule is about
// stored cards surviving untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCardId,
  isSourceInReview,
  wordKeysWithCards,
  triageQueueFor,
  triageEntries,
  missingFacetEntries,
  buildGamePool,
  shouldGradeGameWord,
} from './vocabScope.js';
import { vocabCardId, grammarCardId, phraseCardId } from './cardIds.js';

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

const MAIN_KEY = 'german-app-data-v1';
let freshCounter = 0;
async function freshStore(blob) {
  globalThis.localStorage = new MemoryLocalStorage();
  if (blob) globalThis.localStorage.setItem(MAIN_KEY, JSON.stringify(blob));
  const mod = await import(`../db/storage.js?scope=${++freshCounter}`);
  return mod.store;
}

const reviewCard = (due = 1000) => ({ status: 'review', ease: 2.3, interval: 12, learningStep: 0, reps: 5, lapses: 1, due, lastReviewed: 500 });

const blobWith = (srsCards, packs = {}, userVocab = []) => ({
  version: 2,
  srsCards,
  packs,
  settings: { dailyNewLimit: 18 },
  stats: { streak: 0, bestStreak: 0, lastStudyDate: null, history: {}, gameBests: {} },
  userContent: { vocab: userVocab, phrases: [], notes: [] },
  meta: { createdAt: '2026-01-01T00:00:00.000Z' },
});

/** The same filter queue.js applies to every review/due/strength/Test-me path. */
function cardsInReview(store) {
  const states = store.allPackStates();
  return Object.keys(store.allCards()).filter((id) => {
    const { type, sourceId } = parseCardId(id);
    return isSourceInReview(type, sourceId, states);
  });
}

test('parseCardId round-trips the id builders', () => {
  assert.deepEqual(parseCardId(vocabCardId('core-nouns-1', 'tisch', 'gender')), { type: 'vocab', sourceId: 'core-nouns-1', itemId: 'tisch', facet: 'gender' });
  assert.deepEqual(parseCardId(grammarCardId('dative-verbs', 'ex-3')), { type: 'grammar', sourceId: 'dative-verbs', itemId: 'ex-3', facet: 'default' });
  assert.deepEqual(parseCardId(phraseCardId('classic-idioms', 'wurst', 'phrase_to_meaning')), { type: 'phrase', sourceId: 'classic-idioms', itemId: 'wurst', facet: 'phrase_to_meaning' });
});

test('isSourceInReview: vocab needs explicit active; user-added, grammar and phrases default on', () => {
  assert.equal(isSourceInReview('vocab', 'p', {}), false);
  assert.equal(isSourceInReview('vocab', 'p', { 'vocab:p': { active: false } }), false);
  assert.equal(isSourceInReview('vocab', 'p', { 'vocab:p': { active: true } }), true);
  assert.equal(isSourceInReview('vocab', 'user-added', {}), true);
  assert.equal(isSourceInReview('vocab', 'user-added', { 'vocab:user-added': { active: false } }), false);
  assert.equal(isSourceInReview('grammar', 'g', {}), true);
  assert.equal(isSourceInReview('grammar', 'g', { 'grammar:g': { active: false } }), false);
  assert.equal(isSourceInReview('phrase', 's', {}), true);
});

test('a card from a never-activated pack is not in review and still exists in storage, unchanged', async () => {
  const leakedId = vocabCardId('core-nouns-1', 'tisch', 'gender');
  const activeId = vocabCardId('core-verbs-1', 'gehen', 'meaning');
  const grammarId = grammarCardId('dative-verbs', 'ex-1');
  const original = { [leakedId]: reviewCard(1), [activeId]: reviewCard(1), [grammarId]: reviewCard(1) };
  const store = await freshStore(blobWith(structuredClone(original), { 'vocab:core-verbs-1': { active: true, triaged: true } }));

  const visible = cardsInReview(store);
  assert.ok(!visible.includes(leakedId), 'never-activated pack hidden');
  assert.ok(visible.includes(activeId), 'active pack shown');
  assert.ok(visible.includes(grammarId), 'grammar still default-on');
  assert.deepEqual(store.getCard(leakedId), original[leakedId], 'hidden card kept as is');

  // Activating the pack later uses that card as it is.
  store.setPackState('vocab:core-nouns-1', { active: true });
  assert.ok(cardsInReview(store).includes(leakedId));
  assert.deepEqual(store.getCard(leakedId), original[leakedId]);
});

test('re-activation queues only words without cards, and triage leaves existing cards byte-identical', async () => {
  const packId = 'core-nouns-1';
  const words = [
    { id: 'tisch', pos: 'noun' }, // fully reviewed
    { id: 'stuhl', pos: 'noun' }, // one facet from a game
    { id: 'lampe', pos: 'noun' }, // nothing yet
  ];
  const cards = {};
  for (const f of ['meaning_de_en', 'meaning_en_de', 'gender', 'plural']) cards[vocabCardId(packId, 'tisch', f)] = reviewCard(111);
  cards[vocabCardId(packId, 'stuhl', 'gender')] = reviewCard(222);
  const store = await freshStore(blobWith(structuredClone(cards), { [`vocab:${packId}`]: { active: false, triaged: true } }));
  const before = JSON.stringify(store.allCards());

  const pending = triageQueueFor(words, packId, wordKeysWithCards(Object.keys(store.allCards())));
  assert.deepEqual(pending, ['lampe']);

  // Even if a word with cards reaches triage, only its missing facets are written.
  for (const w of words) {
    for (const decision of ['known', 'drill']) {
      const entries = triageEntries(packId, w, decision, store.allCards(), 5000);
      assert.ok(entries.every(([id]) => !store.getCard(id)), `${w.id}/${decision}: no entry for an existing card`);
    }
    store.setCards(triageEntries(packId, w, 'known', store.allCards(), 5000));
  }
  const after = store.allCards();
  for (const [id, card] of Object.entries(JSON.parse(before))) assert.equal(JSON.stringify(after[id]), JSON.stringify(card), id);
  assert.equal(after[vocabCardId(packId, 'stuhl', 'plural')].status, 'review'); // missing facet filled
  assert.equal(after[vocabCardId(packId, 'lampe', 'gender')].status, 'review');
});

test('game pool: active-pack words with cards are graded; extra packs and card-less words are practice-only', () => {
  const packs = [
    { id: 'a', title: 'A', words: [{ id: 'x', pos: 'noun' }, { id: 'y', pos: 'noun' }] },
    { id: 'b', title: 'B', words: [{ id: 'z', pos: 'verb' }] },
    { id: 'c', title: 'C', words: [{ id: 'q', pos: 'verb' }] },
  ];
  const keys = wordKeysWithCards([vocabCardId('a', 'x', 'gender'), vocabCardId('b', 'z', 'meaning')]);
  const pool = buildGamePool(packs, { 'vocab:a': { active: true } }, ['b'], keys);
  const byId = Object.fromEntries(pool.map((w) => [w.id, w]));
  assert.deepEqual(Object.keys(byId).sort(), ['x', 'y', 'z']); // pack c neither active nor extra
  assert.equal(byId.x.graded, true);
  assert.equal(byId.y.graded, false); // active pack, but no card yet (e.g. awaiting triage)
  assert.equal(byId.z.graded, false); // extra pack: practice only, even though it has an old card
  assert.equal(byId.x.packId, 'a');
  assert.equal(buildGamePool(packs, {}, [], keys).length, 0);
});

test('practice-only words create no card (shouldGradeGameWord gate)', async () => {
  const store = await freshStore(blobWith({}));
  const pool = buildGamePool([{ id: 'b', title: 'B', words: [{ id: 'z', pos: 'verb' }] }], {}, ['b'], new Set());
  const before = JSON.stringify(store.allCards());
  // Mirrors queue.js gradeGameWord: only graded words reach submitGradeForCardId.
  for (const w of pool) {
    if (shouldGradeGameWord(w)) store.setCard(vocabCardId(w.packId, w.id, 'meaning'), reviewCard());
  }
  assert.equal(shouldGradeGameWord(pool[0]), false);
  assert.equal(shouldGradeGameWord({ graded: undefined }), false);
  assert.equal(JSON.stringify(store.allCards()), before);
});

test('user-added words get new cards for missing facets only', () => {
  const existingId = vocabCardId('user-added', 'hund-1', 'gender');
  const cards = { [existingId]: reviewCard(9) };
  const entries = missingFacetEntries('user-added', { id: 'hund-1', pos: 'noun' }, cards, 42);
  assert.deepEqual(entries.map(([id]) => id).sort(), ['meaning_de_en', 'meaning_en_de', 'plural'].map((f) => vocabCardId('user-added', 'hund-1', f)).sort());
  assert.ok(entries.every(([, c]) => c.status === 'new' && c.due === 42));
  assert.deepEqual(missingFacetEntries('user-added', { id: 'hund-1', pos: 'noun' }, Object.fromEntries([[existingId, cards[existingId]], ...entries]), 42), []);
});
