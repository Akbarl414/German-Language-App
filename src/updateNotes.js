// Update notes shown on the /updates screen. Newest first.
// Every user-visible change adds an entry here in the same commit.
// `id` must be unique and stable (never edit an old id); `lines` are plain
// English sentences (note text is content, so it is not run through LABELS).

export const UPDATE_NOTES = [
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
