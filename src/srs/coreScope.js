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
//   changes nothing. Once a word has switched to stage two, game results land
//   on its meaning_en_de card instead (coreGameTargetFacet).
// - Stage two (English to German): see the section above buildCoreSession.

import { Grade, newCard, learnedCard, isDue, grade } from './engine.js';
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

// --- Stage two (English to German) ------------------------------------------
// Opens once every ranked word has been seen in stage one. From then on a word
// whose stage-one card is recognised (last grade Gut or better) is eligible to
// switch to its meaning_en_de card; eligible words are introduced in rank
// order through the Core new-word allowance. A switched word is marked by
// `coreStageTwoAt` on its meaning_en_de card (additive field: absent on every
// card stored before stage two existed, which is the true state). After the
// switch Core shows only that card; the stage-one card stays stored, untouched.
// A miss keeps the word at stage two; there is no way back to stage one.
// meaning_en_de is not in FACETS for non-nouns, so daily review and pack triage
// never create or show it; Core reads cards directly, not via allCardRefs().

export const STAGE_TWO_FACET = 'meaning_en_de';
export const MASTERED_INTERVAL_DAYS = 21;

export function stageTwoCardId(word) {
  return vocabCardId(word.packId, word.id, STAGE_TWO_FACET);
}

/** Seen in stage one: the card exists and has been reviewed at least once or triaged as known (anything but 'new'). */
export function isSeenInStageOne(card) {
  return !!card && card.status !== 'new';
}

/** Stage two opens once all CORE_TOTAL ranked words have been seen in stage one. */
export function isStageTwoOpen(rankedWords, cards) {
  if (rankedWords.length < CORE_TOTAL) return false;
  return rankedWords.every((w) => isSeenInStageOne(cards[stageOneCardId(w)]));
}

/** The word has switched to English to German (its meaning_en_de card carries coreStageTwoAt). */
export function isIntroduced(word, cards) {
  return cards[stageTwoCardId(word)]?.coreStageTwoAt != null;
}

/** Eligible to switch: stage two open (passed in), not switched yet, stage-one card recognised (Gut or better). */
export function isStageTwoEligible(word, cards, stageTwoOpen) {
  return !!stageTwoOpen && !isIntroduced(word, cards) && isRecognised(cards[stageOneCardId(word)]);
}

/** The one card Core uses for this word right now: { cardId, facet, card } (card may be undefined). */
export function coreCurrentCard(word, cards) {
  const facet = isIntroduced(word, cards) ? STAGE_TWO_FACET : stageOneFacet(word);
  const cardId = vocabCardId(word.packId, word.id, facet);
  return { cardId, facet, card: cards[cardId] };
}

/** Mastered: switched to English to German and that card's interval is 21 days or more. */
export function isMastered(word, cards) {
  if (!isIntroduced(word, cards)) return false;
  return (cards[stageTwoCardId(word)].interval || 0) >= MASTERED_INTERVAL_DAYS;
}

export function coreMasteredCount(rankedWords, cards) {
  return rankedWords.filter((w) => isMastered(w, cards)).length;
}

/**
 * Which Core meaning card a game result lands on: once a word has switched,
 * its English-to-German card (whatever direction the game asked), so the
 * stage-one card stays untouched; otherwise the facet the game passed.
 */
export function coreGameTargetFacet(word, facet, cards) {
  return isIntroduced(word, cards) ? STAGE_TWO_FACET : facet;
}

/**
 * Grade a Core session item. Returns { card, countsAsNew }: the next card
 * state (an introduction adds coreStageTwoAt, keeping all existing progress),
 * and whether it uses up the Core new-word allowance (new cards and every
 * introduction, even of a noun whose meaning_en_de card already had progress).
 */
export function coreReviewResult(item, gradeValue, now = Date.now()) {
  let card = grade(item.card, gradeValue, now);
  if (item.introduce && card.coreStageTwoAt == null) card = { ...card, coreStageTwoAt: now };
  return { card, countsAsNew: item.card.status === 'new' || !!item.introduce };
}

/**
 * Core review session. rankedWords: [{ ...word, packId }] (rank set);
 * cards: store.allCards(). Returns [{ cardId, type, sourceId, itemId, facet,
 * card, content, isNew, introduce? }]: each word's current card if due, from
 * every band, most urgent first (urgency(card, now), higher = sooner); then
 * new stage-one cards from unlocked bands in rank order; then, once stage two
 * is open, eligible words' meaning_en_de cards in rank order (introduce: true;
 * the existing card, or a fresh unsaved one). New items share newAllowanceLeft.
 * A word being introduced is left out of the due list, so no word appears twice.
 */
export function buildCoreSession({ rankedWords, cards, unlockedBands, newAllowanceLeft, now = Date.now(), urgency }) {
  const due = [];
  const fresh = [];
  const intro = [];
  const stageTwoOpen = isStageTwoOpen(rankedWords, cards);
  for (const word of rankedWords) {
    const base = { type: 'vocab', sourceId: word.packId, itemId: word.id, content: word };
    if (isStageTwoEligible(word, cards, stageTwoOpen)) {
      const cardId = stageTwoCardId(word);
      intro.push({ ...base, cardId, facet: STAGE_TWO_FACET, card: cards[cardId] || newCard(now), isNew: true, introduce: true });
    }
    const { cardId, facet, card } = coreCurrentCard(word, cards);
    if (!card) continue;
    const item = { ...base, cardId, facet, card };
    if (card.status === 'new') {
      if (bandOf(word.rank) <= unlockedBands) fresh.push({ ...item, isNew: true });
    } else if (isDue(card, now)) {
      due.push({ ...item, isNew: false });
    }
  }
  const byRank = (a, b) => a.content.rank - b.content.rank;
  fresh.sort(byRank);
  intro.sort(byRank);
  const newItems = [...fresh, ...intro].slice(0, Math.max(0, newAllowanceLeft));
  const introducing = new Set(newItems.filter((i) => i.introduce).map((i) => `${i.sourceId}::${i.itemId}`));
  const dueKept = due.filter((i) => !introducing.has(`${i.sourceId}::${i.itemId}`));
  dueKept.sort((a, b) => urgency(b.card, now) - urgency(a.card, now));
  return [...dueKept, ...newItems];
}

/** Count of due (non-new) current cards (stage-one, or meaning_en_de once switched), any band. */
export function coreDueCount(rankedWords, cards, now = Date.now()) {
  let n = 0;
  for (const word of rankedWords) {
    const { card } = coreCurrentCard(word, cards);
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
