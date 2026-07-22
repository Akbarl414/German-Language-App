// Pure token-sequence checker for "reorder" (put the words in order) exercises.
// No DOM dependency, so it can be unit-tested directly (see reorderChecker.test.js).
//
// Rules:
//  - Compares the sequence of tokens, not a joined string.
//  - Position 0 (sentence-initial) is case-insensitive: a tile like "heute"
//    moved to the front has to match an authored "Heute", since tokens are
//    authored in their natural mid-sentence casing.
//  - Every other position is case-sensitive, so a noun's capitalization
//    elsewhere in the sentence still has to be right.
//  - Leading/trailing punctuation glued to a tile is ignored for matching.
//  - An exercise can list multiple accepted orders (`answerOrders`); legacy
//    single-order exercises (`answerOrder`) still work.

const EDGE_PUNCTUATION = /^[.,!?;:„"'()]+|[.,!?;:„"'()]+$/g;

function stripPunctuation(token) {
  return token.replace(EDGE_PUNCTUATION, '');
}

function tokenSequencesMatch(submitted, accepted) {
  if (submitted.length !== accepted.length) return false;
  return submitted.every((tok, i) => {
    const a = stripPunctuation(tok);
    const b = stripPunctuation(accepted[i]);
    return i === 0 ? a.toLowerCase() === b.toLowerCase() : a === b;
  });
}

/** All accepted orders for an exercise, newest-format first. */
export function acceptedOrders(exercise) {
  if (exercise.answerOrders?.length) return exercise.answerOrders;
  if (exercise.answerOrder) return [exercise.answerOrder];
  return [];
}

export function checkReorderAnswer(submittedTokens, exercise) {
  return acceptedOrders(exercise).some((order) => tokenSequencesMatch(submittedTokens, order));
}
