// Tests for the pure Core 1000 rules in coreScope.js: which cards daily review
// leaves to the Core tab, the Core session, Core triage, and the game rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandOf,
  bandRange,
  isCoreMeaningFacet,
  stageOneFacet,
  countsTowardDailyReview,
  isRecognised,
  buildCoreSession,
  coreDueCount,
  coreTriageQueue,
  coreTriageEntry,
  coreGameGrade,
  bandSummaries,
} from './coreScope.js';
import { Grade, newCard, learnedCard, grade } from './engine.js';
import { vocabCardId } from './cardIds.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const urgency = (card, now) => (now - card.due) / DAY;

const haus = { id: 'haus', rank: 120, pos: 'noun', lemma: 'Haus', gender: 'das', plural: 'Häuser', meaning_en: 'house', packId: 'core-1000-02' };
const gehen = { id: 'gehen', rank: 7, pos: 'verb', lemma: 'gehen', meaning_en: 'to go', packId: 'core-verbs-1' };
const gut = { id: 'gut', rank: 30, pos: 'adjective', lemma: 'gut', meaning_en: 'good', packId: 'common-adjectives' };
const loeffel = { id: 'loeffel', pos: 'noun', lemma: 'Löffel', gender: 'der', plural: 'Löffel', meaning_en: 'spoon', packId: 'everyday-nouns' };

const reviewCard = (due) => ({ status: 'review', ease: 2.5, interval: 5, learningStep: 0, reps: 3, lapses: 0, due, lastReviewed: due - 5 * DAY });

test('bands of 50 by rank', () => {
  assert.equal(bandOf(1), 1);
  assert.equal(bandOf(50), 1);
  assert.equal(bandOf(51), 2);
  assert.equal(bandOf(1000), 20);
  assert.deepEqual(bandRange(3), { from: 101, to: 150 });
});

test('stage one is meaning_de_en for nouns, meaning otherwise', () => {
  assert.equal(stageOneFacet(haus), 'meaning_de_en');
  assert.equal(stageOneFacet(gehen), 'meaning');
  assert.equal(stageOneFacet(gut), 'meaning');
});

test('daily review leaves out every meaning card of ranked words, keeps everything else', () => {
  const packs = { 'vocab:core-1000-02': { active: true }, 'vocab:core-verbs-1': { active: true }, 'vocab:everyday-nouns': { active: true } };
  const ref = (w, facet) => ({ type: 'vocab', sourceId: w.packId, facet });

  for (const facet of ['meaning_de_en', 'meaning_en_de']) {
    assert.equal(isCoreMeaningFacet(haus, facet), true);
    assert.equal(countsTowardDailyReview(ref(haus, facet), haus, packs), false);
  }
  assert.equal(countsTowardDailyReview(ref(gehen, 'meaning'), gehen, packs), false);

  // Non-meaning facets of ranked words stay in daily review.
  assert.equal(countsTowardDailyReview(ref(haus, 'gender'), haus, packs), true);
  assert.equal(countsTowardDailyReview(ref(haus, 'plural'), haus, packs), true);
  assert.equal(countsTowardDailyReview(ref(gehen, 'principal_parts'), gehen, packs), true);

  // Unranked words are unaffected.
  assert.equal(countsTowardDailyReview(ref(loeffel, 'meaning_de_en'), loeffel, packs), true);
  assert.equal(countsTowardDailyReview(ref(loeffel, 'meaning_en_de'), loeffel, packs), true);

  // Pack activation rule still applies; grammar and phrases untouched.
  assert.equal(countsTowardDailyReview({ type: 'vocab', sourceId: 'travel', facet: 'gender' }, { pos: 'noun' }, packs), false);
  assert.equal(countsTowardDailyReview({ type: 'grammar', sourceId: 'dative-verbs', facet: 'default' }, null, packs), true);
  assert.equal(countsTowardDailyReview({ type: 'phrase', sourceId: 'classic-idioms', facet: 'phrase_to_meaning' }, null, packs), true);
});

test('Core session: due stage-one cards from any band and any pack, then new cards from unlocked bands in rank order', () => {
  const words = [gehen, gut, haus, { ...gut, id: 'klein', rank: 20, lemma: 'klein' }, { ...gut, id: 'gross', rank: 10, lemma: 'groß' }];
  const cards = {
    // haus: band 3 (locked), pack not active, due → included
    [vocabCardId('core-1000-02', 'haus', 'meaning_de_en')]: reviewCard(NOW - 2 * DAY),
    // haus meaning_en_de: ignored by Core
    [vocabCardId('core-1000-02', 'haus', 'meaning_en_de')]: reviewCard(NOW - 9 * DAY),
    // gehen: due, more urgent
    [vocabCardId('core-verbs-1', 'gehen', 'meaning')]: reviewCard(NOW - 5 * DAY),
    // stray meaning_de_en on a verb: ignored
    [vocabCardId('core-verbs-1', 'gehen', 'meaning_de_en')]: reviewCard(NOW - 9 * DAY),
    // new cards in band 1
    [vocabCardId('common-adjectives', 'gut', 'meaning')]: newCard(NOW),
    [vocabCardId('common-adjectives', 'klein', 'meaning')]: newCard(NOW),
    [vocabCardId('common-adjectives', 'gross', 'meaning')]: newCard(NOW),
  };

  const s = buildCoreSession({ rankedWords: words, cards, unlockedBands: 1, newAllowanceLeft: 2, now: NOW, urgency });
  assert.deepEqual(
    s.map((i) => i.cardId),
    [
      vocabCardId('core-verbs-1', 'gehen', 'meaning'),
      vocabCardId('core-1000-02', 'haus', 'meaning_de_en'),
      vocabCardId('common-adjectives', 'gross', 'meaning'),
      vocabCardId('common-adjectives', 'klein', 'meaning'),
    ]
  );
  assert.deepEqual(s.map((i) => i.isNew), [false, false, true, true]);
  assert.equal(coreDueCount(words, cards, NOW), 2);

  // New cards in a locked band wait.
  const locked = buildCoreSession({ rankedWords: words, cards, unlockedBands: 0, newAllowanceLeft: 20, now: NOW, urgency });
  assert.equal(locked.filter((i) => i.isNew).length, 0);
});

test('Core triage: only words in unlocked bands without a stage-one card; never overwrites', () => {
  const words = [haus, gehen, gut];
  const existing = reviewCard(NOW + 3 * DAY);
  const cards = { [vocabCardId('core-verbs-1', 'gehen', 'meaning')]: existing };

  assert.deepEqual(coreTriageQueue(words, cards, 1).map((w) => w.id), ['gut']);
  assert.deepEqual(coreTriageQueue(words, cards, 3).map((w) => w.id), ['gut', 'haus']);

  assert.deepEqual(coreTriageEntry(gehen, 'known', cards, NOW), []);
  assert.deepEqual(coreTriageEntry(haus, 'known', cards, NOW), [[vocabCardId('core-1000-02', 'haus', 'meaning_de_en'), learnedCard(NOW)]]);
  const [[, drilled]] = coreTriageEntry(gut, 'drill', cards, NOW);
  assert.deepEqual(drilled, newCard(NOW));
  assert.equal(learnedCard(NOW).due, NOW + 21 * DAY);
});

test('game rule: a miss on a reviewed Core card counts as AGAIN; a hit changes nothing', () => {
  const reviewed = reviewCard(NOW + DAY);
  assert.equal(coreGameGrade(reviewed, Grade.AGAIN), Grade.AGAIN);
  assert.equal(coreGameGrade(learnedCard(NOW), Grade.AGAIN), Grade.AGAIN);
  assert.equal(coreGameGrade(reviewed, Grade.GOOD), null);
  assert.equal(coreGameGrade(reviewed, Grade.HARD), null);
  assert.equal(coreGameGrade(newCard(NOW), Grade.AGAIN), null);
  assert.equal(coreGameGrade(undefined, Grade.AGAIN), null);
});

test('recognised: last grade Gut or better, or graduated with no recorded grade', () => {
  assert.equal(isRecognised(undefined), false);
  assert.equal(isRecognised(newCard(NOW)), false);
  assert.equal(isRecognised(learnedCard(NOW)), true);
  assert.equal(isRecognised(reviewCard(NOW)), true); // progress from before lastGrade existed
  assert.equal(isRecognised({ ...reviewCard(NOW), lastGrade: Grade.HARD }), false);
  assert.equal(isRecognised({ ...reviewCard(NOW), lastGrade: Grade.GOOD }), true);
  assert.equal(isRecognised(grade(newCard(NOW), Grade.EASY, NOW)), true);
  assert.equal(isRecognised(grade(newCard(NOW), Grade.AGAIN, NOW)), false);
});

test('band summaries count recognised stage-one cards per band', () => {
  const words = [gehen, gut, haus];
  const cards = {
    [vocabCardId('core-verbs-1', 'gehen', 'meaning')]: learnedCard(NOW),
    [vocabCardId('common-adjectives', 'gut', 'meaning')]: newCard(NOW),
    [vocabCardId('core-1000-02', 'haus', 'meaning_de_en')]: reviewCard(NOW),
  };
  const b = bandSummaries(words, cards, 1);
  assert.equal(b.length, 20);
  assert.deepEqual(b[0], { band: 1, from: 1, to: 50, total: 2, recognised: 1, unlocked: true });
  assert.deepEqual(b[2], { band: 3, from: 101, to: 150, total: 1, recognised: 1, unlocked: false });
});

test('engine records lastGrade without changing scheduling', () => {
  const start = newCard(NOW);
  const review = reviewCard(NOW);
  const expected = {
    new: {
      [Grade.AGAIN]: { status: 'learning', due: NOW + 10 * 60 * 1000 },
      [Grade.GOOD]: { status: 'learning', due: NOW + DAY },
    },
    review: {
      [Grade.AGAIN]: { interval: 1, ease: 2.3, lapses: 1 },
      [Grade.HARD]: { interval: 6, ease: 2.35 },
      [Grade.GOOD]: { interval: 13, ease: 2.5 },
      [Grade.EASY]: { interval: 16, ease: 2.65 },
    },
  };
  for (const g of [Grade.AGAIN, Grade.HARD, Grade.GOOD, Grade.EASY]) {
    const fromNew = grade(start, g, NOW);
    const fromReview = grade(review, g, NOW);
    assert.equal(fromNew.lastGrade, g);
    assert.equal(fromReview.lastGrade, g);
    for (const [k, v] of Object.entries(expected.new[g] || {})) assert.equal(fromNew[k], v);
    for (const [k, v] of Object.entries(expected.review[g])) assert.ok(Math.abs(fromReview[k] - v) < 1e-9, `${k} for grade ${g}`);
  }
});
