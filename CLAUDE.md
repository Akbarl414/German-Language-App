# CLAUDE.md — German Learning App

Project instructions for Claude Code sessions in this repo. **This file holds the rules and the owner's taste; it does not try to describe the code.** For how things are built, it points into the two reference docs:

| Read | When | What it covers |
|---|---|---|
| **CLAUDE.md** (this file) | Always, first | Invariants, owner's taste, working rules |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Before any code change | Stack, data flow, routing, storage, SRS, modules, games, common tasks |
| **[CONTENT_GUIDE.md](./CONTENT_GUIDE.md)** | Before touching any file in `content/` | Schemas, facet design, per-type field rules, generation quality rules |

References below like *ARCHITECTURE.md § Persistence* mean "the section of that file whose heading starts with that word." If this file and the code disagree, the code wins: fix this file (see "Keeping docs true" at the end).

## What this app is

A **German learning PWA** for A2–B1 learners who take in-person lessons with a private teacher. After class, the owner adds vocabulary, grammar, and phrases and drills them here. No accounts, no server, no analytics. The owner practices equally on an iPhone 12 Pro (installed as a PWA) and on a computer, and iterates on the app through Claude Code sessions.

**Who uses it:** the owner plus about four other people use the deployed app. Each has their own progress on their own device; nothing is shared between them. **Every push to `main` reaches all of them.** Every change must therefore be safe for stored data that nobody working in this repo can inspect: you can't see what shape other people's data is in, so never assume it matches yours.

## Non-negotiable invariants

These override everything else. Never violate them, even to "improve" something.

1. **User progress data is sacred.** All progress lives in one `localStorage` blob (key `german-app-data-v1`), read and written **only** through the `store` singleton in `src/db/storage.js`; never touch `localStorage` directly.
   - Changing the *shape or meaning* of anything under `defaultData()` requires a `MIGRATIONS` entry (keyed by the version it upgrades *from*) **and** a `STORAGE_VERSION` bump, with a test in `storage.test.js`.
   - Purely *additive* fields with a sensible default (e.g. a new setting) need no migration; `migrate()` backfills them. If in doubt, treat it as a shape change. The additive merge is a safety net for missing fields, not a substitute for a real migration when a value's meaning or shape changes.
   - Never wipe, reset, re-key, or re-initialise progress. Never touch `resetAll()` or the Settings "erase all progress" button unless explicitly asked.
   - **Failed load is read-only.** If stored data exists but fails to load, the store enters a failed state (`store.loadFailed`): the raw string is kept under `german-app-recovery-v1`, `persist()` and `maybeSnapshot()` don't write, and `main.js` shows the recovery screen. Never add a write path that bypasses that guard, never clear the recovery key, and never replace load logic with anything that can silently start from empty/default state when existing data fails to parse. Fail loud (`console.error`) and fall back to the safest non-destructive option, not a wipe.
   - **Failed save keeps data in memory.** If a write throws (e.g. storage full), `persist()` keeps the in-memory data, sets `store.saveFailed` (banner on every screen), and retries on the next save. Never delete or shrink the main blob to make room. A snapshot that doesn't fit may only drop the *oldest* snapshots, and only if today's then gets written; otherwise existing snapshots stay untouched and `store.snapshotsFailing` is set.
   - Daily snapshots (separate key, 7-day rolling retention) and Export/Import must keep working; they are each person's only backup.
   - Details: *ARCHITECTURE.md § Persistence*.
2. **Fully offline, fully static.** No backend, no runtime API calls, no accounts. Static files on GitHub Pages, cached by the hand-written service worker (`public/sw.js`). All AI-generated content is created at authoring time and committed as JSON.
3. **German-first, minimal coaching.** Before the user answers anything (reviews, quizzes, exercises, games) show only German: no translations, gender/case labels, rule reminders, or annotated answer choices by default. That help lives behind a per-item **Hint** button.
   - A hint must never reveal the answer currently being tested.
   - Using a hint caps the grade at HARD via `gradeFromCorrectness()` in `src/srs/engine.js`; always route grading through it.
   - Grammar cues are authored as a trailing parenthetical (`"… ___ Tisch. (wo?)"`) that `resolveHint()` strips until Hint is pressed; answer option strings never carry the cue. See *ARCHITECTURE.md § UI conventions* and CONTENT_GUIDE.md.
   - **Current exception:** fill-in-the-blank grammar exercises show an English translation (`translation_en`) before the learner answers. This contradicts the rule above as written. It is the present behavior, not a precedent to copy, and a later task will change it. Don't add new pre-answer English anywhere else.
4. **Full feedback after answering.** Post-answer and end-of-round screens show the complete correct answer for every item (correct ones too), with gender colour-coding for nouns, plus a "practice my misses" option. Use the shared `resultsSummary.js` and `missesReview.js` in `src/modules/shared/`. Corrections are explicit and formatted (e.g. `aufwachen: ist aufgewacht`).
5. **Games feed the SRS only for words already in the user's reviews.** A vocab word is graded only if its pack is in review (explicitly active, or the `user-added` pack unless switched off) and the word already has a card; every other word in the game pool is practice-only and creates or changes no card. Vocab games get words from `getGameWordPool()` (`src/modules/shared/gamePool.js`) and grade only through `gradeGameWord()` in `src/srs/queue.js`; never call `submitGradeForCardId()` for vocab from a game. Grammar games and quizzes grade through the engine as before. Card ids come only from `vocabCardId()` / `phraseCardId()` / `grammarCardId()` (defined in `src/srs/cardIds.js`, imported via `src/srs/queue.js`), never hand-built strings. Don't change which facet an existing game grades without preserving existing progress (precedent: Wordfall's direction toggle, *ARCHITECTURE.md § Games*).
6. **Mobile correctness.** Respect iOS safe-area insets (`viewport-fit=cover` + `env(safe-area-inset-*)`, never hardcoded offsets), work in light and dark mode, stay thumb-friendly. The bottom bar background must fully contain its icons/labels.
7. **Scope discipline.** Make only the changes requested. No opportunistic refactors, redesigns, or content rewrites. That includes the deliberate duplication of `escapeHtml()` and `shuffle()` across files: match whatever the file you're editing already does (*ARCHITECTURE.md § Known quirks*).

## Repo map (short version)

Full tour in *ARCHITECTURE.md § The modules tour* and *§ Data flow*.

```
content/{vocab/packs,grammar/units,phrases/sets,stories}/*.json   learning content (auto-discovered, no manifest)
content/core/                        Core 1000 authoring plan + SOURCES.md (not loaded by the app)
content/schemas/                     JSON Schemas used by validation
scripts/validate-content.js          npm run validate (also runs before build)
src/main.js                          registers every route: fastest overview of all screens
src/router.js                        hand-rolled hash router; screens export render(container, params) → cleanup?
src/db/storage.js                    the ONLY persistence layer (sacred; see invariant 1)
src/db/contentLoader.js              loads content JSON + merges user-added content
src/srs/engine.js                    pure SM-2 engine, Grade, FACETS, gradeFromCorrectness
src/srs/queue.js                     card ids, pack activation/triage, daily queue, throttling, weighted sampling
src/i18n.js                          LABELS map {de, en} + t()
src/components/gender.js             der/die/das badges + noun rendering
src/modules/…                        screens: dashboard, active, vocab, grammar, phrases, testme,
                                     addcontent, settings, games, shared
src/style.css                        single global stylesheet, theme CSS vars
public/sw.js, public/manifest.webmanifest   PWA
.github/workflows/deploy.yml         push to main → GitHub Pages
```

**Stack:** Vite, vanilla JS (no framework), one global CSS file, `node --test` (no test framework), `ajv` for content validation. No browser test runner: UI changes need manual checking via `npm run dev`.

## Product rules (things that look like choices you could change, but aren't)

- **SRS facets stay separate.** The owner explicitly chose per-facet cards (nouns: `meaning_de_en`, `meaning_en_de`, `gender`, `plural`; verbs: `meaning`, `principal_parts`; phrases: `phrase_to_meaning`, `situation_to_phrase`; grammar: one card per exercise). Do not bundle them. Table in *ARCHITECTURE.md § The SRS engine*.
- **Queue management:** daily new-card limit, review sessions of a configurable size ordered by urgency with the true due count visible, and auto-throttling of new cards when the due backlog crosses the reduce/pause thresholds. Actual defaults live in `defaultData()` in `storage.js`; read them there rather than trusting numbers quoted in docs.
- **Activation asymmetry is intentional.** Vocab packs default *inactive* and go through triage ("already know it" vs "drill it") on activation; grammar units and phrase sets default *active*. Only explicitly active vocab packs count toward daily review, due counts, throttling, strength, weakest items and Test me; cards from other packs stay stored, unused, and come back as they are if the pack is activated. The `user-added` pack counts as active unless switched off, and words added in the app get new cards straight away. Triage never replaces an existing card. Games draw from active packs plus the extra packs chosen in `settings.gameExtraPackIds` (practice-only). Details: *ARCHITECTURE.md § The SRS engine*.
- **Interface language:** every nav/button/tab/common in-game label goes in `LABELS` in `src/i18n.js` with both `de` and `en`, called via `t()`. Default is German ("Spiele", "Teste mich", "Einstellungen", "Aktive Inhalte"). Grammar explanations, exercise prompts, settings help text, near-miss diff messages, and all content stay hardcoded English by convention.
- **German text inputs:** always provide tap buttons for ä ö ü ß, and set `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`, `lang="de"`.
- **Gender colours:** use `genderBadgeHTML` / `nounHTML` from `src/components/gender.js` and the `--der` / `--die` / `--das` CSS vars; never hardcode the colours. Keep them distinguishable in dark mode.
- **Theming:** new themed colours follow the `@media (prefers-color-scheme: light)` + `[data-theme="light"]` + `[data-theme="dark"]` triple-block pattern in `style.css`.
- **Word-order checker** (`src/modules/grammar/reorderChecker.js`): compares token sequences, ignores sentence-initial capitalisation but still requires noun capitalisation, handles punctuation separately, supports multiple accepted orders. Its tests must keep passing.

## Current feature set

A snapshot to orient you, not a spec. Run `ls content/*/*/` and read `main.js` / `games/hub.js` for current truth.

- **Vocabulary:** packs in `content/vocab/packs/` (13 packs, ~970 words at last count; the long-term goal is a ~1,500-word base).
  - **Core 1000** is the 1,000 most frequent headwords on the Goethe B1 list. It lives in the same pool: any word with a `rank` is a Core word. New Core words go in `core-1000-NN` packs; `core-1000-01` to `core-1000-05` are written. The plan and sources are in `content/core/`, and there is no app screen for it yet. The rank data is CC BY-SA 4.0 and the Goethe list is used only to decide which words qualify (never copy from it). Details: CONTENT_GUIDE.md § Core 1000. Nouns carry gender, plural, example; verbs carry principal parts, hat/ist, separable/case flags. In-app manual entry (`/add`, "Path A") stores words on-device under `userContent`, merged in as a synthetic `user-added` pack and included in backups; they go straight into daily review as new cards.
- **Grammar:** units with a cheat-sheet page and a static exercise bank (currently Wechselpräpositionen, Perfekt vs. Präteritum, adjective endings, dative verbs, fixed-case prepositions). Practised per unit or in a weakness-weighted mixed quiz. Five exercise types, all rendered by `exerciseRenderer.js`.
- **Phrases & idioms:** literal translation, meaning, register, situations; quizzed situation-first (currently one set, `classic-idioms`).
- **Games** (matching game was removed as unengaging). Details and per-game settings in *ARCHITECTURE.md § Games*.
  - *Main:* der/die/das sorting (Timed 30/45/60s + Streak, best score per mode; timed flashes a large X + correct-answer banner ~1s on misses; streak ends on first miss), Fill-in-the-blank stories, **Wordfall** (promoted from beta; German↔English direction toggle, mid-screen remaining-miss indicator, correction on each miss).
  - *All vocab games* (sorting, Wordfall, Type it, Verb forms sprint) share one word pool and the same "extra packs" picker under Advanced settings; if the pool is too small the start screen says so and links to pack activation.
  - *Also main (promoted from beta; the Beta section is currently empty and hidden):* **Type it** (Timed/Streak, best scores, "Genus prüfen" toggle requiring the article, "so close" diff for capitalisation/umlaut/article near-misses), **Case detective** (bare choices like "den"/"dem"; draws its sentences from grammar units' bare-option exercises rather than its own content; recency tracking via `stats.gameBests` so rounds vary; "Why?" only after answering), **Verb forms sprint** (build the Perfekt incl. hat/ist; instant green check; corrections as `infinitive: Perfekt form`).
- **Test me:** configurable mixed quizzes, weighted toward weak/new material, with a "what to review" list at the end.
- **Settings:** theme (Light/Dark/System), interface language, daily new-card limit, review session size, throttle thresholds, vocab pack activation, Export/Import, snapshot restore, backup reminder after 7+ days, approximate storage used, snapshot-failure warning, danger zone. A save-failure banner shows on every screen while saving fails.
- **Update notes:** `/updates` (More → "Neuigkeiten") lists `src/updateNotes.js`; Home shows a one-time dismissible alert when the newest note hasn't been seen on this device.
- **Navigation:** bottom bar = Home, Spiele, Teste mich, More. "Aktive Inhalte" (in More, and one button on Home) holds grammar management, vocab pack management, and Add content.

## Owner's taste — how to make judgement calls

- **Less coaching, always.** When unsure whether to show help, put it behind Hint. Answer choices are bare forms; the choice itself is the test.
- **Explicit, snappy feedback.** Clear confirmation on correct answers, full corrections on wrong ones, complete summaries after rounds.
- **New game ideas start in Beta** (`BETA_GAMES` in `hub.js`, file in `games/beta/`; the Beta section is hidden while empty). Expect later prompts to promote or delete them; promotion steps are in *ARCHITECTURE.md § Games*.
- **Content accuracy matters.** Validation checks JSON shape only, not German. Re-check genders, plurals, principal parts, and German UI-label spelling by hand. Generate vocab in passes of **at most ~100 entries**.

## Working in this repo

1. Read CLAUDE.md, then the relevant ARCHITECTURE.md section, then the actual code before editing. Prefer small, targeted changes.
2. For common changes (new game, new setting, new UI text, new content, storage change, theming), start from *ARCHITECTURE.md § Common tasks*.
3. After changes run `npm run test` (includes the word-order checker tests) and, for any content change, `npm run validate`. Make sure `npm run build` still succeeds, since deploys run on every push to `main`.
4. Progress-schema change → migration + version bump + test (invariant 1).
5. New UI text → `LABELS` entry in German and English.
6. New screens → check dark mode, safe-area insets, and phone-width layout manually (`npm run dev`). Return a cleanup function from `render()` if the screen uses timers.
7. Every user-visible change adds an entry (newest first, stable id) to `src/updateNotes.js` in the same commit. Notes are plain English; see *ARCHITECTURE.md § Persistence* for how the "updated" alert works.

## Keeping docs true

If a change alters architecture, data formats, navigation, conventions, or the feature set, update in the same session:
- **ARCHITECTURE.md** for how the code works,
- **CONTENT_GUIDE.md** for content formats and generation rules,
- **this file** only for invariants, product rules, taste, and the feature snapshot.

Don't copy detail from the other two docs into this one; point to the section instead.
