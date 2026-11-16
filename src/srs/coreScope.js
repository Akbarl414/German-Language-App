// Pure decision logic for the Core 1000 tab. No storage or content imports:
// every input is passed in, so this file loads under `node --test` (queue.js
// can't — it imports contentLoader.js, which uses import.meta.glob).
//
// Rules (see ARCHITECTURE.md § The SRS engine, Core 1000):
// - A Core word is any vocab word with a `rank` (1–1000). Its meaning cards
//   (meaning_de_en, meaning_en_de, meaning) belong to the Core tab only:
//   daily review, due counts, throttling, strength, weakest items and Test me
//   leave them out. Its other facets (gender, plural, principal_parts) stay in
//   daily review for active packs.
// - Core uses one "stage one" card per word: meaning_de_en for nouns, meaning
//   for everything else. Any other meaning card stays stored and is ignored.
// - Core ignores pack activation: the same card ids, wherever the word lives.
// - Words are worked through in bands of 50 by rank. Due Core cards come from
//   every band; new ones only from unlocked bands, in rank order.
// - Games: a miss on any Core meaning card that has already been reviewed
//   counts as AGAIN, whichever pack the word came from; a correct answer
//   changes nothing.

import { Grade, newCard, learnedCard, isDue } from './engine.js';
import { vocabCardId } from './cardIds.js';
import { isSourceInReview } from './vocabScope.js';

export const CORE_BAND_SIZE = 50;
export const CORE_BAND_COUNT = 20;
export const CORE_TOTAL = CORE_BAND_SIZE * CORE_BAND_COUNT;

const MEANING_FACETS = ['meaning_de_en', 'meaning_en_de', 'meaning'];

/** Band number (1–20) for a rank. */
export function bandOf(rank) {
  return Math.ceil(rank / CORE_BAND_SIZE);
}

/** First and last rank of a band. */
export function bandRange(band) {
  return { from: (band - 1) * CORE_BAND_SIZE + 1, to: band * CORE_BAND_SIZE };
}

export function isRankedWord(word) {
  return Number.isInteger(word?.rank) && word.rank >= 1;
}

/** Whether this card of this word is a Core meaning card (owned by the Core tab, not daily review). */
export function isCoreMeaningFacet(word, facet) {
  return isRankedWord(word) && MEANING_FACETS.includes(facet);
}

/** The one card per word that Core reviews in stage one. */
export function stageOneFacet(word) {
  return word.pos === 'noun' ? 'meaning_de_en' : 'meaning';
}

export function stageOneCardId(word) {
  return vocabCardId(word.packId, word.id, stageOneFacet(word));
}

/**
 * Whether a card ref counts toward daily review (queue, due counts, throttle,
 * strength, weakest items, Test me). ref: { type, sourceId, facet }; word: the
 * resolved vocab word or null; packStates: store.allPackStates().
 */
export function countsTowardDailyReview(ref, word, packStates) {
  if (!isSourceInReview(ref.type, ref.sourceId, packStates)) return false;
  if (ref.type === 'vocab' && isCoreMeaningFacet(word, ref.facet)) return false;
  return true;
}

/**
 * "Recognised": the stage-one card's last grade was Gut or better. Cards with
 * no recorded grade (triaged as known, or graded before lastGrade existed)
 * count when they're in review status, i.e. have graduated.
 */
export function isRecognised(card) {
  if (!card) return false;
  if (card.lastGrade != null) return card.lastGrade >= Grade.GOOD;
  return card.status === 'review';
}

/**
 * Core review session. rankedWords: [{ ...word, packId }] (rank set);
 * cards: store.allCards(). Returns [{ cardId, type, sourceId, itemId, facet,
 * card, content, isNew }]: due stage-one cards from every band, most urgent
 * first (urgency(card, now), higher = sooner), then new stage-one cards from
 * unlocked bands in rank order, up to newAllowanceLeft.
 */
export function buildCoreSession({ rankedWords, cards, unlockedBands, newAllowanceLeft, now = Date.now(), urgency }) {
  const due = [];
  const fresh = [];
  for (const word of rankedWords) {
    const facet = stageOneFacet(word);
    const cardId = vocabCardId(word.packId, word.id, facet);
    const card = cards[cardId];
    if (!card) continue;
    const item = { cardId, type: 'vocab', sourceId: word.packId, itemId: word.id, facet, card, content: word };
    if (card.status === 'new') {
      if (bandOf(word.rank) <= unlockedBands) fresh.push({ ...item, isNew: true });
    } else if (isDue(card, now)) {
      due.push({ ...item, isNew: false });
    }
  }
  due.sort((a, b) => urgency(b.card, now) - urgency(a.card, now));
  fresh.sort((a, b) => a.content.rank - b.content.rank);
  return [...due, ...fresh.slice(0, Math.max(0, newAllowanceLeft))];
}

/** Count of due (non-new) stage-one cards, any band. */
export function coreDueCount(rankedWords, cards, now = Date.now()) {
  let n = 0;
  for (const word of rankedWords) {
    const card = cards[stageOneCardId(word)];
    if (card && card.status !== 'new' && isDue(card, now)) n++;
  }
  return n;
}

/** Words in unlocked bands with no stage-one card yet, in rank order. */
export function coreTriageQueue(rankedWords, cards, unlockedBands) {
  return rankedWords
    .filter((w) => bandOf(w.rank) <= unlockedBands && !cards[stageOneCardId(w)])
    .sort((a, b) => a.rank - b.rank);
}

/** [cardId, card] entries for a Core triage decision; [] if the stage-one card already exists (never overwrites). */
export function coreTriageEntry(word, decision, cards, now = Date.now()) {
  const id = stageOneCardId(word);
  if (cards[id]) return [];
  return [[id, decision === 'known' ? learnedCard(now) : newCard(now)]];
}

/**
 * Games on a Core meaning card: a miss on a card that has already been
 * reviewed (exists, not 'new') counts as AGAIN; anything else changes nothing.
 * Returns the grade to apply, or null.
 */
export function coreGameGrade(card, gradeValue) {
  if (gradeValue !== Grade.AGAIN) return null;
  if (!card || card.status === 'new') return null;
  return Grade.AGAIN;
}

/** Per-band progress: [{ band, from, to, total, recognised, unlocked }] for all 20 bands. */
export function bandSummaries(rankedWords, cards, unlockedBands) {
  const out = [];
  for (let band = 1; band <= CORE_BAND_COUNT; band++) {
    out.push({ band, ...bandRange(band), total: 0, recognised: 0, unlocked: band <= unlockedBands });
  }
  for (const word of rankedWords) {
    const b = out[bandOf(word.rank) - 1];
    if (!b) continue;
    b.total++;
    if (isRecognised(cards[stageOneCardId(word)])) b.recognised++;
  }
  return out;
}
