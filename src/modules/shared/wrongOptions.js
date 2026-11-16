// Picks wrong answer options for a multiple-choice round. Prefers items that
// share the target's `same` field (default part of speech) so the answer can't
// be guessed from word type, topping up from the rest when there aren't enough.
// Pure: pass your own pool; shuffling is done here.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param target  the item being asked about
 * @param pool    candidate items (may include the target)
 * @param n       how many wrong options to return
 * @param opts    { same: field to match (default 'pos'), label: item => string shown to the player }
 *                Candidates whose label equals the target's, or an earlier option's, are skipped.
 */
export function pickWrongOptions(target, pool, n, { same = 'pos', label = (x) => x.lemma } = {}) {
  const seen = new Set([label(target)]);
  const candidates = shuffle(pool).filter((w) => {
    const l = label(w);
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
  const sameKind = candidates.filter((w) => w[same] === target[same]);
  const other = candidates.filter((w) => w[same] !== target[same]);
  return [...sameKind, ...other].slice(0, n);
}
