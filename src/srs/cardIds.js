// SRS card id builders. The only place card id strings are built; re-exported
// by queue.js (import them from there, as every module already does). Kept in
// their own dependency-free file so pure, node-testable modules can use them.

export function vocabCardId(packId, wordId, facet) {
  return `vocab:${packId}::${wordId}:${facet}`;
}
export function phraseCardId(setId, phraseId, facet) {
  return `phrase:${setId}::${phraseId}:${facet}`;
}
export function grammarCardId(unitId, exerciseId) {
  return `grammar:${unitId}::${exerciseId}:default`;
}
