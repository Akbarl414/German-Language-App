// Update notes shown on the /updates screen. Newest first.
// Every user-visible change adds an entry here in the same commit.
// `id` must be unique and stable (never edit an old id); `lines` are plain
// English sentences (note text is content, so it is not run through LABELS).

export const UPDATE_NOTES = [
  {
    id: '2026-11-16-clean-english-prompts',
    date: '2026-11-16',
    lines: [
      'When a card or game shows you English and asks for the German, the English no longer gives the answer away. About 180 words had German notes in their meaning, for example "the (definite article: der/die/das)" or "thanks (vielen Dank = many thanks)". These words now have a clean English prompt instead.',
      'This affects English-to-German review cards (including the second stage of Kern 1000), Type it, and Wordfall played English to German. After you answer, the full meaning with its German notes is still shown as before.',
      'Your progress is unchanged.',
    ],
  },
  {
    id: '2026-11-16-core-1000-stage-two',
    date: '2026-11-16',
    lines: [
      'Kern 1000 now has a second stage. Once you have seen all 1,000 words at least once, words you last rated Gut or Einfach start coming back the other way round: you see the English and recall the German.',
      'Words switch a few at a time, in order, using the same "new words per day" allowance. Until a word switches, it keeps coming up German first. Words you last rated Schwer or Nochmal wait until you rate them Gut.',
      'Each word has only one card in Kern 1000 at a time. Once a word has switched it stays English to German; a miss just brings it back sooner. Nothing you have already learned is lost.',
      'The Kern 1000 page now also shows how many words you have mastered: words you can recall English to German with a gap of three weeks or more.',
      'Until you have seen all 1,000 words, nothing changes.',
    ],
  },
  {
    id: '2026-11-16-core-1000-tab',
    date: '2026-11-16',
    lines: [
      'New tab "Kern 1000" in the bottom bar, between Home and Games. It works through the 1,000 most common words in blocks of 50. Unlock a block when you are ready, sort its words into "Kenne ich" and "Üben", then review them German first, with the same four grades as daily review.',
      'The meanings of these 1,000 words are now reviewed only in the Kern 1000 tab, so your daily review and its due count get smaller. Their gender, plural and verb forms stay in daily review.',
      'Your progress carries over: meaning cards you already had for these words show up in Kern 1000 with their schedule unchanged.',
      'Kern 1000 has its own allowance of new words per day (20 by default, in Settings). It does not use up the daily review\'s new-card limit, and its reviews count towards your streak.',
      'In games, missing one of these words brings its meaning card back sooner, as if you had pressed Nochmal,, but only if you have reviewed it before. Getting it right in a game changes nothing.',
    ],
  },
  {
    id: '2026-11-16-core-1000-complete',
    date: '2026-11-16',
    lines: [
      'The Core 1000 word list is now complete: the 1,000 most frequent words on the B1 exam word list. The new ones are in the vocab packs "Core 1000 · 01" to "Core 1000 · 08"; the rest were already in your other packs. Like every vocab pack they are off until you switch them on.',
      'A Core 1000 screen comes next. Your existing words and progress are unchanged.',
    ],
  },
  {
    id: '2026-11-15-core-1000-01',
    date: '2026-11-15',
    lines: [
      'New vocab pack "Core 1000 · 01": the 100 most frequent German words not yet in any pack, including sein, haben, werden, the modal verbs, pronouns and other small everyday words. Like every vocab pack it is off until you switch it on.',
      'This is the first step towards a Core 1000 list of the most common words on the B1 exam word list. Your existing words and progress are unchanged.',
    ],
  },
  {
    id: '2026-11-15-games-cleanup',
    date: '2026-11-15',
    lines: [
      'The Timed challenge game is gone. Your best scores in the other games are kept.',
      'Type it, Case detective and Verb forms sprint are now regular games, no longer marked beta. Old links to them still work.',
      'Wordfall now shows wrong options of the same word type (noun, verb, ...) as the right answer, so you cannot guess from the word type.',
      'Wordfall now counts German to English answers for verbs, adjectives and other non-noun words under their normal meaning card. Daily review and Test me ignore leftover cards that do not belong to a word.',
      'Game titles, instructions and buttons now follow the interface language. The Games screen says that results count for words already in your reviews and other words are practice only.',
    ],
  },
  {
    id: '2026-11-15-games-review-words',
    date: '2026-11-15',
    lines: [
      'Games now use the words from your active vocab packs, and only words already in your reviews count toward your progress. Playing a game no longer adds new words to your daily review.',
      'Each game has an "extra packs" choice under Advanced settings. Words from extra packs are for practice only and never go into your daily review.',
      'Daily review, due counts and Test me now include only vocab packs you have switched on. Cards from other packs are kept and come back if you switch the pack on.',
      'Switching a pack off and on again no longer resets words you have already learned, and new words added to a pack you use are offered for triage.',
      'Words you add yourself now go straight into your daily review.',
    ],
  },
  {
    id: '2026-11-15-update-notes',
    date: '2026-11-15',
    lines: [
      'Update notes now exist: this page lists what changed, and Home shows a small alert after each update.',
      'The app now warns you if saving or backups fail.',
    ],
  },
];

export function newestUpdateId() {
  return UPDATE_NOTES[0]?.id ?? null;
}

/** Pure: show the alert when there is a newest note this device hasn't seen. */
export function shouldShowUpdateAlert(lastSeenId, newestId) {
  return Boolean(newestId) && lastSeenId !== newestId;
}
