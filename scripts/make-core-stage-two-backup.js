// Dev-only: writes a backup file with stage one of Core 1000 finished, so
// stage two (English to German) can be tried in `npm run dev` without real
// progress. Never imported by the app. Import the file via Settings → Import
// on a throwaway origin (another port or a private window), never on the
// deployed site.
//
//   node scripts/make-core-stage-two-backup.js /path/to/core-stage-two.json
//
// Every ranked word gets a seen stage-one card: most last graded Gut, every
// fifth Schwer, every seventeenth Nochmal (still learning), and every seventh
// due now. The first ten ranked nouns also get existing meaning_en_de progress
// (interval 30), as if reviewed before stage two, to check it is kept.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabCardId } from '../src/srs/cardIds.js';
import { Grade } from '../src/srs/engine.js';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/make-core-stage-two-backup.js <output.json>');
  process.exit(1);
}
if (fs.existsSync(out)) {
  console.error(`Refusing to overwrite ${out}; choose a new path.`);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = path.join(root, 'content/vocab/packs');
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const ranked = [];
for (const file of fs.readdirSync(packDir).filter((f) => f.endsWith('.json'))) {
  const pack = JSON.parse(fs.readFileSync(path.join(packDir, file), 'utf8'));
  for (const w of pack.words) if (Number.isInteger(w.rank)) ranked.push({ ...w, packId: pack.id });
}
ranked.sort((a, b) => a.rank - b.rank);

const card = (fields) => ({ status: 'review', ease: 2.5, interval: 10, learningStep: 0, reps: 3, lapses: 0, due: now + 5 * DAY, lastReviewed: now - 10 * DAY, ...fields });

const srsCards = {};
let nouns = 0;
for (const w of ranked) {
  const facet = w.pos === 'noun' ? 'meaning_de_en' : 'meaning';
  let c;
  if (w.rank % 17 === 0) c = card({ status: 'learning', interval: 0, learningStep: 0, lastGrade: Grade.AGAIN, due: now - 60 * 1000, lapses: 1 });
  else if (w.rank % 5 === 0) c = card({ lastGrade: Grade.HARD });
  else c = card({ lastGrade: Grade.GOOD });
  if (w.rank % 7 === 0 && c.status === 'review') c.due = now - DAY;
  srsCards[vocabCardId(w.packId, w.id, facet)] = c;

  if (w.pos === 'noun' && nouns < 10) {
    nouns++;
    srsCards[vocabCardId(w.packId, w.id, 'meaning_en_de')] = card({ interval: 30, ease: 2.3, reps: 6, lapses: 1, lastGrade: Grade.GOOD, due: now + 12 * DAY });
  }
}

const backup = {
  version: 2, // STORAGE_VERSION when this script was written; migrate() handles anything older
  srsCards,
  packs: {},
  settings: {},
  stats: {},
  core: { unlockedBands: 20 },
  meta: { createdAt: new Date(now).toISOString() },
};

fs.writeFileSync(out, JSON.stringify(backup));
console.log(`Wrote ${out}: ${ranked.length} ranked words, ${Object.keys(srsCards).length} cards.`);
