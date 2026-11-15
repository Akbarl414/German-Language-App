// Pure decision logic for which cards count toward review and which words
// games may grade. No storage or content imports: every input is passed in,
// so this file loads under `node --test` (queue.js can't — it imports
// contentLoader.js, which uses import.meta.glob).
//
// Rules (see ARCHITECTURE.md § The SRS engine):
// - A vocab card counts toward daily review, due counts, throttling, module
//   strength, weakest items and Test me only if its pack is explicitly active
//   (`active === true`). Cards from other packs stay in storage, just unused.
// - The in-app "user-added" pack counts as active unless explicitly switched
//   off, like grammar units and phrase sets.
// - In an active vocab pack, a word is pending triage if it is missing a card
//   for any of its facets. Triage writes only the missing facets and never
//   replaces an existing card.
// - Games grade a word only if its pack is in review AND the word already has
//   at least one card ("already in the user's reviews"); everything else in
//   the game pool is practice-only.

import { facetsFor, newCard, learnedCard } from './engine.js';
import { vocabCardId } from './cardIds.js';

export const USER_VOCAB_PACK_ID = 'user-added';

/** "type:sourceId::itemId:facet" -> { type, sourceId, itemId, facet }. */
export function parseCardId(cardId) {
  const type = cardId.slice(0, cardId.indexOf(':'));
  const rest = cardId.slice(type.length + 1); // "sourceId::itemId:facet"
  const [sourceId, itemAndFacet] = rest.split('::');
  const lastColon = itemAndFacet.lastIndexOf(':');
  const itemId = itemAndFacet.slice(0, lastColon);
  const facet = itemAndFacet.slice(lastColon + 1);
  return { type, sourceId, itemId, facet };
}

/** Whether cards from this source count toward review. packStates: store.allPackStates(). */
export function isSourceInReview(type, sourceId, packStates) {
  const active = packStates?.[`${type}:${sourceId}`]?.active;
  if (type === 'vocab' && sourceId !== USER_VOCAB_PACK_ID) return active === true;
  return active !== false; // grammar, phrases and the user-added pack: never touched counts as active
}

function wordKey(packId, wordId) {
  return `${packId}::${wordId}`;
}

/** Set of "packId::wordId" for every vocab word that has at least one card (any facet). */
export function wordKeysWithCards(cardIds) {
  const keys = new Set();
  for (const id of cardIds) {
    if (!id.startsWith('vocab:')) continue;
    const { sourceId, itemId } = parseCardId(id);
    keys.add(wordKey(sourceId, itemId));
  }
  return keys;
}

/** A word in an active vocab pack is pending triage if it lacks a card for ANY of its facets. cards: store.allCards(). */
export function wordNeedsTriage(packId, word, cards) {
  return facetsFor(word.pos).some((facet) => !cards[vocabCardId(packId, word.id, facet)]);
}

/** Ids of the pack's words pending triage (missing any facet card). Triage then writes only the missing facets. */
export function triageQueueFor(words, packId, cards) {
  return words.filter((w) => wordNeedsTriage(packId, w, cards)).map((w) => w.id);
}

/** [cardId, card] entries for each of the word's facets that has no card. Existing cards are never included. */
function entriesForMissingFacets(packId, word, cards, makeCard) {
  return facetsFor(word.pos)
    .map((facet) => vocabCardId(packId, word.id, facet))
    .filter((id) => !cards[id])
    .map((id) => [id, makeCard()]);
}

/** New cards for the word's missing facets (user-added words go straight into review). */
export function missingFacetEntries(packId, word, cards, now = Date.now()) {
  return entriesForMissingFacets(packId, word, cards, () => newCard(now));
}

/** Triage decision for one word, applied only to facets with no card: 'known' -> scheduled far out, 'drill' -> new. */
export function triageEntries(packId, word, decision, cards, now = Date.now()) {
  return entriesForMissingFacets(packId, word, cards, () => (decision === 'known' ? learnedCard(now) : newCard(now)));
}

/**
 * The game word pool: every word from packs in review, plus words from the
 * extra packs chosen in settings.gameExtraPackIds. Each word is
 * { ...word, packId, packTitle, graded }.
 */
export function buildGamePool(packs, packStates, extraPackIds, keysWithCards) {
  const extras = new Set(extraPackIds || []);
  const out = [];
  for (const pack of packs) {
    const inReview = isSourceInReview('vocab', pack.id, packStates);
    if (!inReview && !extras.has(pack.id)) continue;
    for (const word of pack.words) {
      out.push({
        ...word,
        packId: pack.id,
        packTitle: pack.title,
        graded: inReview && keysWithCards.has(wordKey(pack.id, word.id)),
      });
    }
  }
  return out;
}

/** Games grade only words marked graded by buildGamePool. */
export function shouldGradeGameWord(word) {
  return word?.graded === true;
}
