// Best-score read/write on stats.gameBests, for new games. Goes only through
// the store; merges into gameBests and never replaces other games' entries.

import { store } from '../../db/storage.js';

export function getBest(gameId) {
  return store.getStats().gameBests?.[gameId] ?? null;
}

/**
 * Saves `entry` under `gameId` when `isBetter(entry, previousBestOrNull)` is true.
 * Returns whether it was a new best.
 */
export function recordBest(gameId, entry, isBetter) {
  const stats = store.getStats();
  const prev = stats.gameBests?.[gameId] ?? null;
  if (!isBetter(entry, prev)) return false;
  store.updateStats({ gameBests: { ...stats.gameBests, [gameId]: entry } });
  return true;
}
