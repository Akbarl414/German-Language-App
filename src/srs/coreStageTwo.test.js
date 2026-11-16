// Tests for Core 1000 stage two (English to German) in coreScope.js, against a
// simulated store: 1,000 synthetic ranked words and a plain card map.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_TOTAL,
  stageOneCardId,
  stageTwoCardId,
  isStageTwoOpen,
  isStageTwoEligible,
  isIntroduced,
  coreCurrentCard,
  buildCoreSession,
  coreDueCount,
  coreReviewResult,
  coreGameTargetFacet,
  coreMasteredCount,
  countsTowardDailyReview,
  isRecognised,
} from './coreScope.js';
import { isValidVocabFacet } from './vocabScope.js';
import { Grade, newCard, learnedCard, grade } from './engine.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const urgency = (card, now) => (now - card.due) / DAY;
const POS = ['noun', 'verb', 'adjective', 'adverb', 'other'];

function makeWords(n = CORE_TOTAL) {
  const words = [];
  for (let rank = 1; rank <= n; rank++) {
    words.push({ id: `w${rank}`, rank, pos: POS[rank % POS.length], lemma: `W${rank}`, meaning_en: `m${rank}`, packId: `pack-${Math.ceil(rank / 100)}` });
  }
  return words;
}

/** A stage-one card last graded `g`, not due until `due`. */
function gradedCard(g, due = NOW + 10 * DAY) {
  return { status: 'review', ease: 2.5, interval: 10, learningStep: 0, reps: 3, lapses: 0, due, lastReviewed: NOW - 10 * DAY, lastGrade: g };
}

/** Every word seen in stage one, last graded Gut, nothing due. */
function finishedStageOne(words) {
  const cards = {};
  for (const w of words) cards[stageOneCardId(w)] = gradedCard(Grade.GOOD);
  return cards;
}

function session(words, cards, newAllowanceLeft = 20) {
  return buildCoreSession({ rankedWords: words, cards, unlockedBands: 20, newAllowanceLeft, now: NOW, urgency });
}

test('stage two stays closed until all 1,000 are seen: no switch', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  assert.equal(isStageTwoOpen(words, cards), true);

  // One word still new (practised in triage, never reviewed).
  const oneNew = { ...cards, [stageOneCardId(words[500])]: newCard(NOW) };
  assert.equal(isStageTwoOpen(words, oneNew), false);
  assert.equal(words.some((w) => isStageTwoEligible(w, oneNew, false)), false);
  const s = session(words, oneNew);
  assert.ok(s.every((i) => !i.introduce && i.facet !== 'meaning_en_de'));
  assert.equal(s.length, 1); // only the new stage-one card

  // One word with no card at all.
  const missing = { ...cards };
  delete missing[stageOneCardId(words[999])];
  assert.equal(isStageTwoOpen(words, missing), false);
  assert.equal(session(words, missing).length, 0);

  // Fewer than 1,000 ranked words never opens stage two.
  const fewer = words.slice(0, 999);
  assert.equal(isStageTwoOpen(fewer, finishedStageOne(fewer)), false);
});

test('once all are seen, only Gut-or-better (and triaged-as-known) words become eligible', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  cards[stageOneCardId(words[0])] = gradedCard(Grade.HARD);
  cards[stageOneCardId(words[1])] = { ...gradedCard(Grade.AGAIN), status: 'learning' };
  cards[stageOneCardId(words[2])] = gradedCard(Grade.EASY);
  cards[stageOneCardId(words[3])] = learnedCard(NOW - DAY); // "Kenne ich": no lastGrade
  const open = isStageTwoOpen(words, cards);
  assert.equal(open, true);

  assert.equal(isStageTwoEligible(words[0], cards, open), false); // Schwer
  assert.equal(isStageTwoEligible(words[1], cards, open), false); // Nochmal
  assert.equal(isStageTwoEligible(words[2], cards, open), true); // Einfach
  assert.equal(isStageTwoEligible(words[3], cards, open), true); // triaged as known
  assert.equal(isStageTwoEligible(words[4], cards, open), true); // Gut

  const s = session(words, cards, 3);
  assert.deepEqual(s.map((i) => i.content.rank), [3, 4, 5]);
  assert.ok(s.every((i) => i.introduce && i.facet === 'meaning_en_de'));

  // The Schwer word reaches Gut in stage one, then becomes eligible.
  const regraded = grade({ ...cards[stageOneCardId(words[0])], due: NOW }, Grade.GOOD, NOW);
  const after = { ...cards, [stageOneCardId(words[0])]: regraded };
  assert.equal(isRecognised(regraded), true);
  assert.equal(isStageTwoEligible(words[0], after, true), true);
});

test('introductions follow rank order and the daily allowance', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  assert.deepEqual(session(words, cards, 20).map((i) => i.content.rank), Array.from({ length: 20 }, (_, k) => k + 1));
  assert.equal(session(words, cards, 0).length, 0);
  assert.equal(session(words, cards, -3).length, 0);

  // After the first 20 are introduced, the next session offers 21–40.
  const after = { ...cards };
  for (const item of session(words, cards, 20)) after[item.cardId] = coreReviewResult(item, Grade.GOOD, NOW).card;
  const next = session(words, after, 20).filter((i) => i.introduce);
  assert.deepEqual(next.map((i) => i.content.rank), Array.from({ length: 20 }, (_, k) => k + 21));
});

test('every introduction counts against the allowance; the marker is set once', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  const [item] = session(words, cards, 1);
  const r = coreReviewResult(item, Grade.GOOD, NOW);
  assert.equal(r.countsAsNew, true);
  assert.equal(r.card.coreStageTwoAt, NOW);

  const later = coreReviewResult({ ...item, card: { ...r.card, due: NOW + DAY }, introduce: false }, Grade.GOOD, NOW + DAY);
  assert.equal(later.countsAsNew, false);
  assert.equal(later.card.coreStageTwoAt, NOW); // kept through later grades
});

test('an introduced word shows exactly one card in Core, and a miss keeps it at English to German', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  const verb = words.find((w) => w.pos === 'verb');
  const stageOneId = stageOneCardId(verb);
  const before = cards[stageOneId];

  // Introduce the verb and miss it.
  const intro = { type: 'vocab', sourceId: verb.packId, itemId: verb.id, content: verb, cardId: stageTwoCardId(verb), facet: 'meaning_en_de', card: newCard(NOW), isNew: true, introduce: true };
  cards[stageTwoCardId(verb)] = coreReviewResult(intro, Grade.AGAIN, NOW).card;
  // Make its stage-one card due too: it must still not appear.
  cards[stageOneId] = { ...before, due: NOW - DAY };

  assert.equal(isIntroduced(verb, cards), true);
  assert.equal(coreCurrentCard(verb, cards).facet, 'meaning_en_de');
  const later = NOW + 11 * 60 * 1000;
  const s = buildCoreSession({ rankedWords: words, cards, unlockedBands: 20, newAllowanceLeft: 50, now: later, urgency });
  const forVerb = s.filter((i) => i.itemId === verb.id && i.sourceId === verb.packId);
  assert.equal(forVerb.length, 1);
  assert.equal(forVerb[0].facet, 'meaning_en_de');
  assert.equal(forVerb[0].introduce, undefined);
  assert.equal(coreDueCount(words, cards, later), 1);

  // The stage-one card is untouched by all of this (only our test changed its due).
  assert.equal(cards[stageOneId].lastGrade, before.lastGrade);
  assert.equal(cards[stageOneId].interval, before.interval);
});

test('a word being introduced is not also served from its due stage-one card', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  cards[stageOneCardId(words[0])] = gradedCard(Grade.GOOD, NOW - DAY); // due and eligible
  const s = session(words, cards, 5);
  const forWord = s.filter((i) => i.itemId === words[0].id);
  assert.equal(forWord.length, 1);
  assert.equal(forWord[0].introduce, true);

  // With no allowance it keeps being reviewed German to English.
  const none = session(words, cards, 0);
  assert.equal(none.length, 1);
  assert.equal(none[0].facet, 'meaning');
});

test('existing noun meaning_en_de progress is preserved on introduction', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  const noun = words.find((w) => w.pos === 'noun');
  const existing = { status: 'review', ease: 2.2, interval: 30, learningStep: 0, reps: 6, lapses: 2, due: NOW + 5 * DAY, lastReviewed: NOW - 25 * DAY, lastGrade: Grade.GOOD };
  cards[stageTwoCardId(noun)] = existing;
  assert.equal(isIntroduced(noun, cards), false); // existing card alone doesn't switch the word

  const item = session(words, cards, CORE_TOTAL).find((i) => i.itemId === noun.id);
  assert.equal(item.introduce, true);
  assert.equal(item.card, existing); // the stored card, unchanged

  const r = coreReviewResult(item, Grade.GOOD, NOW);
  assert.equal(r.card.reps, 7);
  assert.equal(r.card.lapses, 2);
  assert.equal(r.card.interval, Math.round(30 * 2.2)); // continues from the stored schedule
  assert.equal(r.card.coreStageTwoAt, NOW);
  assert.equal(r.countsAsNew, true);
});

test('mastered counts only switched words with an interval of 21 days or more', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  const [a, b, c] = words.filter((w) => w.pos === 'noun');
  cards[stageTwoCardId(a)] = { ...gradedCard(Grade.GOOD), interval: 21, coreStageTwoAt: NOW };
  cards[stageTwoCardId(b)] = { ...gradedCard(Grade.GOOD), interval: 20, coreStageTwoAt: NOW };
  cards[stageTwoCardId(c)] = { ...gradedCard(Grade.GOOD), interval: 40 }; // old progress, not switched
  assert.equal(coreMasteredCount(words, cards), 1);
});

test('games land on the English-to-German card only once a word has switched', () => {
  const words = makeWords();
  const cards = finishedStageOne(words);
  const noun = words.find((w) => w.pos === 'noun');
  assert.equal(coreGameTargetFacet(noun, 'meaning_de_en', cards), 'meaning_de_en');
  assert.equal(coreGameTargetFacet(noun, 'meaning_en_de', cards), 'meaning_en_de');
  cards[stageTwoCardId(noun)] = { ...gradedCard(Grade.GOOD), coreStageTwoAt: NOW };
  assert.equal(coreGameTargetFacet(noun, 'meaning_de_en', cards), 'meaning_en_de');
});

test('daily review never sees a non-noun meaning_en_de card', () => {
  const verb = { id: 'gehen', rank: 7, pos: 'verb', packId: 'core-verbs-1' };
  const packs = { 'vocab:core-verbs-1': { active: true } };
  assert.equal(isValidVocabFacet('verb', 'meaning_en_de'), false);
  assert.equal(countsTowardDailyReview({ type: 'vocab', sourceId: 'core-verbs-1', facet: 'meaning_en_de' }, verb, packs), false);
});
