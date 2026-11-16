// Pure answer classification for Satzbau, on top of reorderChecker.
//   'usual'  matches an order in answerOrders (the neutral orders)
//   'also'   matches an order in alsoAccepted (grammatical, but not the order a teacher would expect)
//   'wrong'  neither
// Both 'usual' and 'also' are correct for score and streak.

import { checkReorderAnswer } from '../../grammar/reorderChecker.js';

export function classifyAnswer(submitted, sentence) {
  if (checkReorderAnswer(submitted, { answerOrders: sentence.answerOrders })) return 'usual';
  if (sentence.alsoAccepted?.length && checkReorderAnswer(submitted, { answerOrders: sentence.alsoAccepted })) return 'also';
  return 'wrong';
}

/** The accepted order (with its punctuation) the learner built, or null. */
export function matchedOrder(submitted, sentence) {
  const all = [...sentence.answerOrders, ...(sentence.alsoAccepted || [])];
  return all.find((o) => checkReorderAnswer(submitted, { answerOrders: [o] })) ?? null;
}
