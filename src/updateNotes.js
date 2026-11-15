// Update notes shown on the /updates screen. Newest first.
// Every user-visible change adds an entry here in the same commit.
// `id` must be unique and stable (never edit an old id); `lines` are plain
// English sentences (note text is content, so it is not run through LABELS).

export const UPDATE_NOTES = [
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
