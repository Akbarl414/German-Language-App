# Content Guide

How to add German-learning content to this app. Read this before generating any new content file. It's written for a future Claude Code session (or you) working in this repo with no other context. See also [CLAUDE.md](./CLAUDE.md).

## User progress data is sacred

Content files here (vocab/grammar/phrases/stories) are separate from the user's on-device progress in `localStorage` (`src/db/storage.js`), but content changes can still affect it indirectly — e.g. renaming or removing a pack/word/exercise `id` orphans any SRS card already scheduled against it. Prefer adding new ids over renaming existing ones. See CLAUDE.md for the full rule: no change, anywhere in this repo, may reset, wipe, or break compatibility with existing user progress.

## The golden rule

**Never generate more than ~100 vocab words (or one grammar unit, or one phrase set) in a single pass.** Accuracy on genders, plurals, and verb principal parts degrades in giant single-shot generations. Generate one file, run `npm run validate`, fix any errors, then move on to the next file.

## How content is loaded (no registration step)

Every JSON file under `content/vocab/packs/`, `content/grammar/units/`, `content/phrases/sets/`, and `content/stories/` is **auto-discovered** at build time via `import.meta.glob` in `src/db/contentLoader.js`. There is no index/manifest file to update. To add content:

1. Write a new JSON file in the right folder.
2. Make sure `"id"` inside the file exactly matches the filename (without `.json`).
3. Run `npm run validate`.
4. Done — it'll show up in the app automatically (vocab packs default OFF until the user activates + triages them in Settings; grammar units and phrase sets default ON).

## Directory layout

```
content/
  schemas/                     # JSON Schema (draft-07) for each content type
    vocab-pack.schema.json
    grammar-unit.schema.json
    phrase-set.schema.json
    story.schema.json
  vocab/packs/*.json           # one file per topic/frequency pack, 50-100 words each
  grammar/units/*.json         # one file per grammar unit
  phrases/sets/*.json          # one file per phrase/idiom set
  stories/*.json               # fill-in-the-blank reading stories (used by the Games module)
scripts/
  validate-content.js          # npm run validate — validates all content against schemas
```

## Vocabulary packs

Schema: `content/schemas/vocab-pack.schema.json`. Existing packs (as of this writing): `core-verbs-1`, `core-verbs-2`, `everyday-nouns`, `food-and-cooking`, `work-and-office`, `travel`, `feelings-and-opinions`, `common-adjectives` — 470 words total.

### File shape

```json
{
  "id": "kitchen-and-cooking-2",
  "title": "Kitchen & Cooking 2",
  "level": "A2-B1",
  "topic": "More kitchen and cooking vocabulary",
  "words": [ /* word objects, see below */ ]
}
```

`id` must be kebab-case and match the filename. `level` is one of `A1`, `A2`, `A2-B1`, `B1`, `B1-B2`.

### Word object fields

Always required: `id` (kebab-case, unique in the file, umlauts transliterated ä→ae ö→oe ü→ue ß→ss), `pos` (`noun`/`verb`/`adjective`/`adverb`/`other`), `lemma` (headword, real spelling with umlauts/ß), `meaning_en`, `example_de`, `example_en`.

- **Nouns** additionally require `gender` (`der`/`die`/`das`) and `plural` (bare plural form, no article — get real umlaut-shifted plurals right, e.g. Haus→Häuser). Use `"-"` for uncountable nouns with no plural.
- **Verbs** additionally require `present_3sg` (shows stem changes, e.g. fährt/isst/nimmt), `praeteritum`, `perfekt` (full form with correct auxiliary, e.g. "ist gefahren"), `auxiliary` (`haben`/`sein`, must match `perfekt`). Optional: `separable` (boolean), `government` (case/preposition governance worth drilling, e.g. `"warten auf + Akk"`).
- **Adjectives** only need the common fields, plus optional `comparative`/`superlative` — **only include these if irregular** (gut→besser/am besten, hoch→höher/am höchsten, groß→größer/am größten, nah→näher/am nächsten). Omit both fields for regular adjectives.

### Why this schema: SRS facets

The app's spaced-repetition engine (`src/srs/engine.js`) tracks separate "facets" per word so it can notice — and specifically drill — things like "always knows the meaning but never the gender":

| pos | facets tracked |
|---|---|
| noun | meaning_de_en, meaning_en_de, gender, plural |
| verb | meaning, principal_parts |
| adjective / adverb / other | meaning |

This is why gender/plural and verb principal parts are separate required fields rather than free text — they get quizzed independently.

### Generating the next pack (extending toward 2000+ words)

1. Pick an unused topic or the next frequency band. Good next candidates: `house-and-home`, `time-and-numbers`, `shopping-and-money`, `health-and-body`, `nature-and-weather`, `technology-and-media`, `education-and-school`, `sports-and-hobbies`, `core-nouns-2` (next-tier frequency nouns), `core-verbs-3`.
2. Before generating, skim existing packs for lemma overlap: `grep -ohi '"lemma"' content/vocab/packs/*.json | sort | uniq -c | sort -rn` or just grep the specific words you're about to add. A little overlap isn't fatal (each pack has its own id namespace) but avoid it where easy.
3. Generate 50-100 words in one file, matching the schema above exactly.
4. Run `npm run validate`. Fix any schema errors.
5. Manually re-check every noun gender/plural and every verb's principal parts (auxiliary choice especially) — this is the single most error-prone part and validation can't catch factual German-grammar mistakes, only shape mistakes.
6. If generating several packs in one session, consider delegating each pack to a separate parallel subagent (each given this guide + the schema) — that's how the initial 8 packs were built. Assign each a distinct topic to keep overlap low.

## Grammar units

Schema: `content/schemas/grammar-unit.schema.json`. Existing units: `wechselpraepositionen`, `perfekt-vs-praeteritum`, `adjective-endings`.

### File shape

```json
{
  "id": "konjunktiv-ii",
  "title": "Konjunktiv II",
  "level": "B1",
  "summary": "One-line description shown in the unit list.",
  "explanation": {
    "sections": [
      {
        "heading": "Section heading",
        "body": "Paragraph one.\nParagraph two (each \\n becomes its own <p>).",
        "table": {
          "headers": ["Col A", "Col B"],
          "rows": [["a1", "b1"], ["a2", "b2"]]
        }
      }
    ]
  },
  "exercises": [ /* at least 25, mixed types, see below */ ]
}
```

`table` is optional per section. Use it for conjugation tables, case tables, comparison tables — anything more scannable as a grid.

### Exercise types (mix all 5 across the ≥25 exercises)

All exercise objects need `id`, `type`, `prompt`, `explanation` (shown after answering).

- **`fill-blank`**: `prompt` contains a literal `___` marker; `answer` (string); optional `altAnswers` (array of accepted alternatives).
- **`multiple-choice`**: `options` (array of strings), `answerIndex` (0-based index of the correct option).
- **`choose-form`**: same shape as `multiple-choice` — use this type when the question is specifically "pick the right inflected form" (for UI/analytics grouping), otherwise identical.
- **`reorder`**: `tokens` (scrambled word/phrase array as shown to the user), `answerOrder` (same tokens in correct order).
- **`error-spot`**: `prompt` is the sentence containing an error; `answer` is the corrected sentence.

Aim for a real mix — roughly a third fill-blank, a third multiple-choice/choose-form, and the remainder split between reorder and error-spot. Grammar exercises are individually SRS-tracked (one card per exercise), so more variety per unit means richer review material.

### Adding a new unit

1. Pick a concept from a lesson (e.g. Konjunktiv II, Relativsätze, Passiv, Modalverben in der Vergangenheit).
2. Write 3-5 explanation sections building from concept → forms → common pitfalls, with a table wherever a table would clarify faster than prose.
3. Write ≥25 exercises mixing all 5 types, grounded in realistic A2-B1 sentences.
4. Run `npm run validate`.

### Case detective sentence packs (Games > Beta > Case detective)

The Case detective beta game (`src/modules/games/beta/caseDetective.js`) doesn't have its own content files — it draws its question pool directly from grammar units, by scanning every unit listed in that file's `CASE_UNIT_IDS` array for `multiple-choice`/`choose-form` exercises that have a `___` blank in the prompt. So the way to add more Case detective questions in a future session is to **add more qualifying exercises to a grammar unit** (new or existing) and add that unit's id to `CASE_UNIT_IDS`.

Two hard requirements for an exercise to qualify (the game filters out anything that doesn't meet them, silently shrinking the pool rather than erroring):

- **Options must be bare forms only** — `"den"`, `"wegen"`, `"ihm"` — never annotated with the reason, e.g. never `"den (Akkusativ)"` or `"dem (wrong — that's dative)"`. An annotated option gives the answer away before the learner picks, which defeats the whole game.
- **Any grammar cue goes in a trailing `(...)` on the prompt, not in the options** — e.g. `"Ich helfe ___ Mutter. (wem?)"`. The app's German-first hint convention (`resolveHint` in `src/modules/grammar/exerciseRenderer.js`) strips a trailing parenthetical from the displayed prompt and only reveals it via the Hint button, so this is exactly how every other exercise type in the app already hides its cues — just keep using it.

Good topics to cover next (each its own unit, following "Adding a new unit" above, but aim for at least 30-35 of the ≥25 exercises to be qualifying bare-option multiple-choice/choose-form, since that's what actually grows this game's pool — the existing `dative-verbs` and `fixed-case-prepositions` units are examples to copy the shape of):

- Genitive prepositions and possessives (wegen, trotz, während, statt; genitive -s/-es endings).
- Reflexive verbs with dative vs. accusative reflexive pronouns (sich (dat) etwas kaufen vs. sich (akk) waschen).
- Relative pronouns across all four cases (der/die/das/den/dem/deren/dessen...).
- Comparative/superlative adjective endings in context.
- Passive voice subject case (werden + Partizip II, "von + Dat" agent phrase).

After adding, sanity-check the new pool size from the repo root:

```bash
node -e "
const fs = require('fs');
const units = fs.readdirSync('content/grammar/units').map(f => JSON.parse(fs.readFileSync('content/grammar/units/'+f)));
const caseUnitIds = ['adjective-endings','wechselpraepositionen','dative-verbs','fixed-case-prepositions']; // keep in sync with CASE_UNIT_IDS
let n = 0;
for (const u of units) if (caseUnitIds.includes(u.id)) for (const ex of u.exercises)
  if ((ex.type==='multiple-choice'||ex.type==='choose-form') && ex.prompt.includes('___') && ex.options.every(o=>!o.includes('('))) n++;
console.log('Case detective pool size:', n);
"
```

Aim to keep this comfortably above 80 as the bank grows, so a player doing several rounds in a row keeps seeing fresh questions (the game itself tracks recently-served questions per device and prioritizes unseen ones, but that only helps if the pool is actually large).

## Phrase / idiom sets

Schema: `content/schemas/phrase-set.schema.json`. Existing set: `classic-idioms` (25 phrases).

```json
{
  "id": "business-idioms",
  "title": "Business & Formal Idioms",
  "phrases": [
    {
      "id": "unique-kebab-id",
      "phrase": "Das Handtuch werfen",
      "literal": "To throw the towel",
      "meaning": "To give up.",
      "register": "colloquial",
      "situation": "A short example dialogue or situation showing natural use, ideally German + English gloss."
    }
  ]
}
```

`register` is `colloquial`, `neutral`, or `formal`. Facets tracked: `phrase_to_meaning` and `situation_to_phrase` (the latter is how the app builds "which phrase fits this situation?" multiple-choice quizzes, pulling distractor phrases from the same set — so keep `situation` concrete and specific enough that only one phrase in the set plausibly fits).

## Fill-in-the-blank stories (Games module)

Schema: `content/schemas/story.schema.json`. Existing: `ein-tag-im-leben` (A2), `wochenendausflug` (B1, ties into Wechselpräpositionen).

```json
{
  "id": "im-supermarkt",
  "title": "Im Supermarkt",
  "level": "A2",
  "segments": [
    { "type": "text", "value": "Lisa geht " },
    { "type": "blank", "answer": "zum", "options": ["zum", "zur", "in den"] },
    { "type": "text", "value": " Supermarkt." }
  ]
}
```

Alternate `text` and `blank` segments. Each `blank` needs `answer` plus 2-4 `options` (including the answer) for the multiple-choice dropdown rendered inline. Good stories reuse current vocab packs and grammar units as a reading-practice bridge (see `wochenendausflug.json` for an example that drills Wechselpräpositionen in context).

## Validation

`npm run validate` (also runs automatically before `npm run build`) checks every content file against its schema, confirms `id` matches the filename, and checks for duplicate ids within a pack/unit/set. It does **not** check German grammatical correctness — that's on you (or the generating agent) to sanity-check manually, especially noun genders/plurals and verb principal parts.

## Path A vs Path B

This guide covers Path B (bulk content generation via Claude Code). Path A (in-app manual entry, right after a lesson) stores words/phrases/notes directly in the browser's localStorage via `src/db/storage.js` — they're merged into the same lists at runtime by `contentLoader.js` under a synthetic `"user-added"` pack/set, and ride along in the Export/Import backup. You don't need to do anything in this repo for Path A entries; they never touch the filesystem.
