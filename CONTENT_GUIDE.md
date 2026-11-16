# Content Guide

How to add German-learning content to this app. Read this before generating any new content file. It's written for a future Claude Code session (or you) working in this repo with no other context. See also [CLAUDE.md](./CLAUDE.md).

## User progress data is sacred

Content files here (vocab/grammar/phrases/stories) are separate from the user's on-device progress in `localStorage` (`src/db/storage.js`), but content changes can still affect it indirectly — e.g. renaming or removing a pack/word/exercise `id` orphans any SRS card already scheduled against it. Prefer adding new ids over renaming existing ones. See CLAUDE.md for the full rule: no change, anywhere in this repo, may reset, wipe, or break compatibility with existing user progress.

**Update notes are not `content/`.** The "what changed" list lives in `src/updateNotes.js` (plain English, newest first), not under `content/`, and is not schema-validated. Adding content that learners will notice (a new pack, unit or set) should add an update note there.

## The golden rule

**Never generate more than ~100 vocab words (or one grammar unit, or one phrase set) in a single pass.** Accuracy on genders, plurals, and verb principal parts degrades in giant single-shot generations. Generate one file, run `npm run validate`, fix any errors, then move on to the next file.

## How content is loaded (no registration step)

Every JSON file under `content/vocab/packs/`, `content/grammar/units/`, `content/phrases/sets/`, `content/stories/`, and `content/sentences/` is **auto-discovered** at build time via `import.meta.glob` in `src/db/contentLoader.js`. There is no index/manifest file to update. To add content:

1. Write a new JSON file in the right folder.
2. Make sure `"id"` inside the file exactly matches the filename (without `.json`).
3. Run `npm run validate`.
4. Done — it'll show up in the app automatically (vocab packs default OFF until the user activates + triages them in Settings, and only active packs reach daily review or are graded by games; grammar units and phrase sets default ON). Words added to a pack the user has already activated are offered for triage automatically; games treat them as practice-only until they have a card.

## Directory layout

```
content/
  schemas/                     # JSON Schema (draft-07) for each content type
    vocab-pack.schema.json
    grammar-unit.schema.json
    phrase-set.schema.json
    story.schema.json
    sentence-set.schema.json
  vocab/packs/*.json           # one file per topic/frequency pack, 50-100 words each
  grammar/units/*.json         # one file per grammar unit
  phrases/sets/*.json          # one file per phrase/idiom set
  stories/*.json               # fill-in-the-blank reading stories (used by the Games module)
  sentences/*.json             # word-order sentences for Satzbau (Games > Beta)
  core/                        # Core 1000 authoring files (plan + SOURCES.md); NOT loaded by the app
scripts/
  validate-content.js          # npm run validate — validates all content against schemas
```

## Vocabulary packs

Schema: `content/schemas/vocab-pack.schema.json`. Existing packs (as of this writing): `core-verbs-1`, `core-verbs-2`, `everyday-nouns`, `food-and-cooking`, `work-and-office`, `travel`, `feelings-and-opinions`, `common-adjectives`, `core-1000-01`, `core-1000-02`, `core-1000-03`, `core-1000-04`, `core-1000-05`, `core-1000-06`, `core-1000-07`, `core-1000-08` — 1232 words total.

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
- **Optional on any word:** `rank` (integer 1–1000), the word's Core 1000 frequency rank. See "Core 1000" below.
- **Optional on any word:** `prompt_en`, a clean English prompt with **no German in it**, shown only where English is the prompt and German the answer: `meaning_en_de` cards (incl. Core 1000 stage two), Type it, Wordfall English to German. Without it those places show `meaning_en`. `meaning_en` itself is unchanged and still shown on backs, in answer options and wherever German is the prompt, so it may keep its German usage notes.
  - **When it's needed:** add `prompt_en` whenever `meaning_en` contains German: the headword or a form of it, a German phrase (`sich …`, `Spaß machen`, `die Polizistin`), a "German = English" note, or a case label like `+ Dat`.
  - **What to keep:** keep the English senses and only the English disambiguation that tells words apart, such as "you (informal, plural)" for ihr, "you (formal)" for Sie, "that (conjunction)" for dass, "police officer (male)" for Polizist, or "half (adjective, …)" for halb vs Hälfte.
  - **Phrase-only senses:** where a German phrase was the only way a sense was shown, say the sense in English, e.g. Ahnung → "idea, notion (as in: no idea)".
  - **Uniqueness:** words that share a spelling or meaning must end up with prompts that tell them apart. For near-synonyms, use English only: register ("everyday", "slightly more formal"), grammar ("separable verb") or a typical use, e.g. aufmachen "to open (everyday; separable verb)" vs öffnen "to open (standard word, also on signs)". Where two words really are interchangeable (etwa/ungefähr, wenigstens/zumindest), leave them alone rather than invent a difference.
  - **No grammar rule reminders:** notes like "(the verb goes to the end)" or "(reflexive)" stay in `meaning_en` for the back. The prompt keeps only what identifies the word, e.g. nachdem "after (conjunction)", obwohl "although".
  - Validation fails if an English prompt contains the word's own lemma inside brackets (see Validation).
- **Optional on verbs:** `present_forms`, all six present-tense forms as `{ "ich", "du", "er", "wir", "ihr", "sie" }` (`er` = er/sie/es, `sie` = sie/Sie). Use it only for sein, haben, werden and the modal verbs (können, müssen, dürfen, sollen, wollen, mögen, möchten), whose present tense is irregular.

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

## Core 1000

Core 1000 is the 1,000 most frequent German headwords that are also on the Goethe-Zertifikat B1 word list. The Goethe list decides which words qualify and frequency decides the order. There is **one word pool**: a Core word is any word in `content/vocab/packs/` that has a `rank`. There is no separate list for the app to load.

- **`content/core/core-1000-plan.json`** is the authoring plan, which the app doesn't load. Each of its 1,000 rows has `rank`, `headword` and `pos`. An existing word has `pack` + `wordId`. A new word has `pack: "new"`, plus `targetPack` (`core-1000-NN`) and `wordId` once it has been written. `duplicates` records which copy of a headword that sits in two packs carries the rank.
- **`content/core/SOURCES.md`** records the sources, licences and ranking method. The rank order is CC BY-SA 4.0, adapted from FrequencyWords. The Goethe list is © Goethe-Institut/ÖSD and is used only to decide which headwords qualify: never copy its definitions or example sentences, and never commit the PDF.
- **One entry per headword:** *sein* is one word, not ist/war/bin. Function words (articles, pronouns, conjunctions, particles) use `pos: "other"`. No proper names or abbreviations. Pronouns and the definite article aren't on the Goethe list and are admitted as a closed-class exception (`closedClassException: true` in the plan).
- **Ids:** follow the normal convention. Where two Core words share a lemma, add a suffix to the second: `sein` (verb) / `sein-poss`, `ihr` (pronoun) / `ihr-poss`, `sie` / `sie-formal` (for *Sie*). A noun whose id would match an existing word's id gets `-noun`: `mal-noun`, `leben-noun`, `bitte-noun`, `wissen-noun`, `morgen-noun`. An adjective that clashes the same way gets `-adj`: `recht-adj` (the noun *Recht* is `recht`), `arm-adj` (the noun *Arm* is `arm`). A verb that clashes gets `-verb`: `unternehmen-verb` (the noun *Unternehmen* is `unternehmen`).
- **Never change an existing word's `id`** to add a rank, and don't touch its other fields; just add `"rank": n`. A rank is unique across all packs.
- **The app reads `rank`.** The Core 1000 tab (`#/core`) takes every ranked word from every pack, whether or not the pack is switched on, and groups them into 20 bands of 50 by rank. Rank therefore decides which band a word is in and the order in which its new cards appear. It also takes the word's meaning cards out of daily review (see ARCHITECTURE.md § The SRS engine, Core 1000). Changing a word's rank moves it to a different band, but its card stays where it is (card ids don't contain the rank). Adding a rank to an existing word moves its meaning cards from daily review to the Core tab. Adding or changing ranks therefore needs an update note.
- **Stage two shows the English prompt.** Once every ranked word has been seen, Core reviews English to German for every part of speech. The card front shows `prompt_en`, or `meaning_en` if there is none (see the `prompt_en` field above). That prompt should therefore point to this German word and not just to a near-synonym (for example, "to go (on foot)" rather than just "to go" where that matters), and it must contain no German. Stage two only opens while all 1,000 ranks have a seen card, so moving a rank onto a word with no card closes it again on every device until that word is seen.

### Writing the next pack (core-1000-NN)

The list is now complete: `core-1000-08` wrote the last new rows, and validation reports all 1,000 ranks present. These steps stay as the record of how the packs were written.


1. In the plan, take the next **≤100** rows with `pack: "new"` and no `targetPack`, in rank order.
2. Write `content/vocab/packs/core-1000-NN.json`:
   - `level` "A1" for the early packs; use the band's real level once the words get harder (`core-1000-03`, ranks 270–417, and `core-1000-04`, ranks 420–540, are "A2"; `core-1000-05`, ranks 542–671, `core-1000-06`, ranks 672–793, `core-1000-07`, ranks 794–923, and `core-1000-08`, ranks 925–1000, are "A2-B1").
   - title `Core 1000 · NN`, topic `The most frequent German words, part N (ranks a–b)`.
   - Each word in the normal format plus its `rank`.
   - Write every meaning and example yourself.
   - Add `present_forms` for any of sein, haben, werden or the modals that fall in the band. All of them are now written (`core-1000-01` and `core-1000-02`). möchten has no past forms of its own, so it uses wollen's (`wollte`, `hat gewollt`) and says so in `meaning_en`.
3. In the plan, set `targetPack` and `wordId` on those rows. Keep one row per line so diffs stay readable.
4. Run `npm run validate`. It fails on a duplicate rank or one outside 1–1000, and prints `Core 1000: N / 1000 ranks present`.
5. Re-check every noun's gender and plural, and every verb's 3sg, Präteritum, Perfekt and auxiliary, one by one (see the golden rule).
6. Add an update note (`src/updateNotes.js`).

## Grammar units

Schema: `content/schemas/grammar-unit.schema.json`. Existing units: `wechselpraepositionen`, `perfekt-vs-praeteritum`, `adjective-endings`, `dative-verbs`, `fixed-case-prepositions`.

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

- **`fill-blank`**: `prompt` contains a literal `___` marker; `answer` (string); `translation_en` (**required** — English translation of the full sentence with the blank filled in; shown alongside the prompt, always visible, not hint-gated; this is a current exception to the German-first, no-English-before-answering rule, and a later task will change it — without it a learner often has no way to know what word is even being asked for); optional `altAnswers` (array of accepted alternatives).
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

The Case detective game (`src/modules/games/caseDetective.js`) doesn't have its own content files — it draws its question pool directly from grammar units, by scanning every unit listed in that file's `CASE_UNIT_IDS` array for `multiple-choice`/`choose-form` exercises that have a `___` blank in the prompt. So the way to add more Case detective questions in a future session is to **add more qualifying exercises to a grammar unit** (new or existing) and add that unit's id to `CASE_UNIT_IDS`.

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

## Sentences (Satzbau, Games > Beta)

Schema: `content/schemas/sentence-set.schema.json`. One file per set (`satzbau-a2-b1-01`, 60 sentences). The game builds each sentence from tiles and checks it with `reorderChecker.js`, so the data uses the same shape as `reorder` grammar exercises.

```json
{
  "id": "satzbau-a2-b1-01",
  "title": "Satzbau A2–B1, set 1",
  "level": "A2-B1",
  "sentences": [
    {
      "id": "v2-heute-kino",
      "level": "A2",
      "topic": "v2-fronted",
      "tokens": ["gehe", "ins Kino", "ich", "heute"],
      "answerOrders": [
        ["Heute", "gehe", "ich", "ins Kino."],
        ["Ich", "gehe", "heute", "ins Kino."],
        ["Ins Kino", "gehe", "ich", "heute."]
      ],
      "translation_en": "Today I'm going to the cinema."
    }
  ]
}
```

Rules:
- `topic` names the word-order pattern: `v2-fronted`, `time-manner-place`, `modal-infinitive`, `perfekt-bracket`, `separable-verb`, `weil`, `dass`, `wenn`, `obwohl`. Aim for a spread.
- `tokens` are the tiles, scrambled, in natural mid-sentence casing (`ich`, not `Ich`; nouns keep their capital) and **without punctuation**. A tile may be a short phrase that must stay together (`ins Kino`, `am Wochenende`). Never a tile that gives a clue beyond the word itself.
- `answerOrders` lists **every** acceptable order, each written as the finished sentence: first word capitalised, commas and the final `.`/`?`/`!` attached to tokens. The checker ignores punctuation and the capital on the first word, and still requires correct capitals elsewhere. The first order is the one shown as the answer, so make it the most natural one. Don't list an order you wouldn't accept from a learner; do list natural variants (fronting an object or time phrase, time and place swapped when both sound fine, subordinate clause first or second).
- `alsoAccepted` (optional) is a second tier, same format as `answerOrders`: orders that are grammatical but not the neutral order a teacher would expect. They count as correct, and the feedback shows `answerOrders[0]` as the more usual one. Put an order here when, in the middle of the sentence, a place comes before a time expression ("Wir fahren nach Berlin am Wochenende.") or an indefinite or bare object comes before a time adverb ("Er will ein Haus nächstes Jahr kaufen."). Definite or possessive objects before a time expression ("Ich besuche meine Oma morgen.") are normal and stay in `answerOrders`. Exception: short place adverbs such as "hier" and "dort" normally come before a time expression ("Man sieht hier manchmal Vögel."), so they stay in `answerOrders`; it is the time expression before them ("Man sieht manchmal hier Vögel.") that goes in `alsoAccepted`. A fronted element is fine for emphasis and stays in `answerOrders`, unless the rest of that order breaks the rule above. An order may not appear in both lists.
- `answerOrders[0]` must be the most neutral order: it is the one shown as the answer.
- `translation_en` is shown only after the learner has answered.
- Use Core 1000 and existing pack vocabulary, at most 60 sentences per pass, and re-read every sentence and every listed order yourself.

## Validation

`npm run validate` (also runs automatically before `npm run build`) checks every content file against its schema, confirms `id` matches the filename, checks for duplicate ids within a pack/unit/set, and checks that Core 1000 `rank` values are unique across all vocab packs (printing how many of the 1,000 are present). It also fails if a word's English prompt (`prompt_en`, or `meaning_en` when there is none) contains the word's own lemma inside `(…)` or `[…]`. The match is case-insensitive: as a whole word, or, for lemmas of 4+ letters, as the start of a word, so "Sachen" counts for Sache. It prints how many words carry `prompt_en`. For sentence sets it also checks that every accepted order (in `answerOrders` and `alsoAccepted`) uses exactly the tokens (ignoring punctuation and the first word's capital), that no order is listed twice (also across the two lists), that tokens carry no punctuation and aren't handed over already solved, and prints the sentence count per topic and how many `alsoAccepted` orders there are. It can't spot other German, or the lemma buried inside a compound ("Speisekarte" for Karte), so still read every prompt yourself. It doesn't read `content/core/`. It does **not** check German grammatical correctness — that's on you (or the generating agent) to sanity-check manually, especially noun genders/plurals and verb principal parts.

## Path A vs Path B

This guide covers Path B (bulk content generation via Claude Code). Path A (in-app manual entry, right after a lesson) stores words/phrases/notes directly in the browser's localStorage via `src/db/storage.js` — they're merged into the same lists at runtime by `contentLoader.js` under a synthetic `"user-added"` pack/set, and ride along in the Export/Import backup. User-added words go straight into daily review as new cards (the `user-added` pack counts as active unless the user switches it off). You don't need to do anything in this repo for Path A entries; they never touch the filesystem.
