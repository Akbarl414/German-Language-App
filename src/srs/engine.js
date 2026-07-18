// Simplified SM-2 spaced-repetition engine.
// Pure functions only — no I/O. Card state is a plain object persisted by src/db/storage.js.

export const Grade = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };

// Minutes-based learning steps before a new card graduates into the
// day-granularity review schedule. Short first step lets a failed card
// resurface later in the same session instead of waiting until tomorrow.
const LEARNING_STEPS_MIN = [10, 60 * 24];

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

/** Facet keys tracked per content type, per the SRS design in the project brief. */
export const FACETS = {
  noun: ['meaning_de_en', 'meaning_en_de', 'gender', 'plural'],
  verb: ['meaning', 'principal_parts'],
  adjective: ['meaning'],
  adverb: ['meaning'],
  other: ['meaning'],
  phrase: ['phrase_to_meaning', 'situation_to_phrase'],
  grammar: ['default'],
};

export function facetsFor(pos) {
  return FACETS[pos] || FACETS.other;
}

/** A brand-new, unreviewed card. */
export function newCard(now = Date.now()) {
  return {
    status: 'new', // 'new' | 'learning' | 'review'
    ease: DEFAULT_EASE,
    interval: 0, // days, once in 'review'
    learningStep: 0,
    reps: 0,
    lapses: 0,
    due: now,
    lastReviewed: null,
  };
}

/** A card marked "already know it" during pack triage: schedule far out, skip the learning queue. */
export function learnedCard(now = Date.now(), intervalDays = 21) {
  return {
    status: 'review',
    ease: DEFAULT_EASE,
    interval: intervalDays,
    learningStep: 0,
    reps: 1,
    lapses: 0,
    due: now + intervalDays * DAY_MS,
    lastReviewed: now,
  };
}

/** Grade a review and return the next card state. Does not mutate the input. */
export function grade(card, gradeValue, now = Date.now()) {
  const next = { ...card, lastReviewed: now, reps: card.reps + (gradeValue > Grade.AGAIN ? 1 : 0) };

  if (card.status === 'new' || card.status === 'learning') {
    if (gradeValue === Grade.AGAIN) {
      next.status = 'learning';
      next.learningStep = 0;
      next.due = now + LEARNING_STEPS_MIN[0] * 60 * 1000;
      return next;
    }
    const nextStep = card.learningStep + 1;
    if (nextStep >= LEARNING_STEPS_MIN.length) {
      next.status = 'review';
      next.interval = gradeValue === Grade.EASY ? 4 : 1;
      next.learningStep = 0;
      next.due = now + next.interval * DAY_MS;
    } else {
      next.status = 'learning';
      next.learningStep = nextStep;
      next.due = now + LEARNING_STEPS_MIN[nextStep] * 60 * 1000;
    }
    return next;
  }

  // status === 'review'
  if (gradeValue === Grade.AGAIN) {
    next.lapses = card.lapses + 1;
    next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    next.interval = 1;
    next.due = now + DAY_MS;
    return next;
  }

  if (gradeValue === Grade.HARD) {
    next.ease = Math.max(MIN_EASE, card.ease - 0.15);
    next.interval = Math.max(1, Math.round(card.interval * 1.2));
  } else if (gradeValue === Grade.GOOD) {
    next.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease));
  } else if (gradeValue === Grade.EASY) {
    next.ease = card.ease + 0.15;
    next.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease * 1.3));
  }
  next.due = now + next.interval * DAY_MS;
  return next;
}

/** Convenience: map a plain correct/incorrect result (games, quizzes) onto a grade. */
export function gradeFromCorrectness(correct) {
  return correct ? Grade.GOOD : Grade.AGAIN;
}

export function isDue(card, now = Date.now()) {
  return card.due <= now;
}

/** 0-1 "strength" heuristic for dashboards: combines interval length and lapse history. */
export function strength(card) {
  if (card.status !== 'review') return card.reps > 0 ? 0.15 : 0;
  const intervalScore = Math.min(1, card.interval / 60);
  const lapsePenalty = Math.min(0.5, card.lapses * 0.1);
  return Math.max(0, Math.min(1, intervalScore - lapsePenalty + 0.1));
}
