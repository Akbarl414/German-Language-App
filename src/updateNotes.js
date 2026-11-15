// Update notes shown on the /updates screen. Newest first.
// Every user-visible change adds an entry here in the same commit.
// `id` must be unique and stable (never edit an old id); `lines` are plain
// English sentences (note text is content, so it is not run through LABELS).

export const UPDATE_NOTES = [
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
