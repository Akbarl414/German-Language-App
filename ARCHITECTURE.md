# Architecture Guide

A from-scratch orientation to this repo — written so a new Claude Code session (or a human) with zero prior context can pick up work immediately. Read [CLAUDE.md](./CLAUDE.md) first (the one non-negotiable rule: user progress data is sacred), then [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) before touching any content file, then this document for everything else: how the app is built, why it's built that way, and where to make common changes.

## What this is

A personal, offline-capable PWA for German vocabulary/grammar/phrase practice (A2–B1 level), built to supplement in-person lessons. The owner plus about four other people use the deployed app. Each has their own progress on their own device; nothing is shared, and every push to `main` reaches all of them. No accounts, no server, no backend of any kind — it's a static site that happens to remember things in the browser.

- **Why these choices:** each person's progress is private to their own device → no auth/sync/multi-device complexity needed. No backend → zero hosting cost, deploys for free to GitHub Pages, works offline once cached. Vanilla JS, no framework → nothing to learn/upgrade, every behavior is traceable by reading the file, bundle stays tiny.
- **Content vs. progress, the core split:** all *learning content* (vocab, grammar, phrases, stories) is versioned JSON in `content/`, checked into git, the same for everyone who clones the repo. All *progress* (SRS scheduling state, streaks, settings, which packs are active, user-typed-in words) lives only in the browser's `localStorage` on the user's device. Nothing round-trips to a server. This split is why there are two separate "sacred rules" documents — CLAUDE.md for the localStorage shape, CONTENT_GUIDE.md for the content JSON shape — and why changes to either have very different blast radii.

## Tech stack

- **Build tool:** Vite (`vite.config.js` — relative `base: './'` so the production build works at any GitHub Pages sub-path with zero config).
- **Framework:** none. Every screen is a plain JS module exporting `async function render(container, params)` that sets `container.innerHTML` and wires up event listeners by hand. See "Routing" below.
- **Styling:** one global stylesheet, `src/style.css`, CSS custom properties for theming, no preprocessor, no CSS modules.
- **Testing:** Node's built-in test runner (`node --test src`, no Jest/Vitest/etc. — see `package.json`'s `test` script). Four test files exist today: `src/db/storage.test.js`, `src/db/dayKey.test.js`, `src/i18n.test.js`, `src/modules/grammar/reorderChecker.test.js`.
- **Content validation:** a hand-rolled script (`scripts/validate-content.js`) using `ajv` (a devDependency; the app has no runtime dependencies — check `package.json`) against JSON Schemas in `content/schemas/`.
- **PWA:** hand-written `public/manifest.webmanifest` + `public/sw.js` (no Workbox/`vite-plugin-pwa`). Per the project memory, this was a Node-version workaround at initial build time (the machine ran Node 18 then, and those tools needed Node 20+) — the machine has since moved to a much newer Node (v26 as of this writing), so that constraint may no longer apply if you ever want to revisit it, but the hand-rolled worker is simple enough (cache-first for hashed build assets, network-first-with-fallback for navigations) that there's no pressing need to. Its `activate` handler deletes only caches named `deutsch-trainer-*` other than the current `CACHE_NAME`: Cache Storage is shared with every other app on the same github.io origin, so never widen that filter, and keep the `deutsch-trainer-` prefix when bumping `CACHE_NAME`.
- **Deploy:** GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys `dist/` to GitHub Pages on every push to `main`. The repo's remote is already configured (`github.com/Akbarl414/German-Language-App`) and this workflow is live.

## Data flow, top to bottom

```
content/**/*.json  →  src/db/contentLoader.js  →  src/srs/queue.js  →  UI modules (src/modules/**)
  (versioned,          (auto-discovers via         (maps content items                    ↓
   read-only,           import.meta.glob,           onto SRS "cards",              reads/writes
   git-tracked)         merges in user-added         builds the daily                      ↓
                        content from storage)        review queue, etc.)       src/db/storage.js
                                                                                (one localStorage
                                                                                 blob, the only
                                                                                 thing that persists)
```

Nothing else talks to `localStorage` directly — every read/write goes through `store` (the exported singleton in `storage.js`). That's a deliberate chokepoint: it's what makes the "sacred data" migration discipline enforceable at all.

## Routing

`src/router.js` is a ~70-line hand-rolled hash router. `route('/vocab/pack/:packId', () => import('./modules/vocab/pack.js'))` registers a pattern; `:param` segments become `params.packId`. `main.js` registers every route up front (see the full list there — it's the fastest way to see every screen in the app at a glance).

Each route module's contract:
```js
export async function render(container, params) {
  container.innerHTML = `...`;
  // wire up event listeners
  return cleanupFn; // optional — called before navigating away (clear timers, etc.)
}
```
The router calls the previous screen's returned cleanup function before swapping in the new one — games that use `setInterval`/`setTimeout` (timed modes, Wordfall's falling-word animation) rely on this to not leak timers across navigation.

`src/components/nav.js` renders the bottom tab bar (Home / Games / Test me / More) and highlights the active top-level section.

## Persistence: `src/db/storage.js`

Single `localStorage` key (`german-app-data-v1`), structured as one JSON blob:

```js
{
  version,              // STORAGE_VERSION (currently 2; MIGRATIONS has one step, 1→2: theme 'auto' → 'system') — bumped + migrated when shape changes meaningfully
  srsCards: {},          // cardId -> CardState (see srs/engine.js) — the actual spaced-repetition state
  packs: {},             // "vocab:core-verbs-1" -> { active, triaged } — pack-level on/off + triage progress
  settings: {},          // theme, uiLanguage, daily limits, per-game settings (typeItCheckGender, wordfallDirection, ...)
  stats: {},             // streak, bestStreak, history (per-day reviewed/newSeen/gamesPlayed), gameBests
  userContent: {},       // vocab/phrases/notes typed in-app (Path A — see Content Pipeline below)
  meta: {},              // createdAt, lastExportAt
}
```

**The one rule that matters more than anything else in this repo** (full text in CLAUDE.md, repeated here because it's load-bearing for every change you make): each person's progress is the only copy of their work, on a device nobody else can inspect, with no server backup. Changes must be safe for stored data that nobody working in this repo can see. Changing the *meaning* or *shape* of anything under `defaultData()` requires a real entry in `MIGRATIONS` (keyed by the version it upgrades *from*) and a `STORAGE_VERSION` bump. Purely *additive* new fields (a new setting with a sensible default) don't need a migration — `migrate()`'s spread-defaults-then-overlay-real-data merge already backfills those for free (see `storage.test.js` for exactly this scenario tested). The distinction: "this key didn't exist before, now it does, old data doesn't need to change" is safe; "this key existed and meant something different, or its values need transforming" is not — that's what `MIGRATIONS` is for. Never touch `resetAll()` or the Settings "erase all progress" button without being explicitly asked.

**Day keys and the 04:00 cutoff.** Every "today" (`stats.history` keys, `lastStudyDate`/streak, daily snapshot dates, `getTodayNewSeenCount()`, the backup filename) comes from `localDayKey()` in `src/db/dayKey.js`: the *local* calendar date, where the day rolls over at `DAY_START_HOUR = 4` rather than midnight, so a 1am session counts toward the previous day. "Yesterday" for the streak is `previousDayKey(today)`, a calendar-day subtraction (never `- 86400000` ms), so DST changes can't break it. Never compute a day key with `toISOString().slice(0, 10)` (that's UTC); full ISO timestamps (`createdAt`, `lastExportAt`, ids) are unaffected. History keys written before this change (UTC-based) were left as-is, no migration.

**Failed-load recovery.** A missing key (first run) starts from `defaultData()`. But if a blob *exists* and can't be loaded — `JSON.parse` fails, `migrate()` throws, or it isn't a plain object whose `srsCards`/`settings`/`stats` (where present) are plain objects — `load()` never falls back to saving defaults over it. Instead it copies the raw string untouched to `german-app-recovery-v1` (an appended array of `{ savedAt, error, raw }`; identical raws aren't duplicated, and an unreadable recovery key is left alone with the copy going to a timestamped sibling key), sets an in-memory failed state (`store.loadFailed`), and goes read-only: `persist()` and `maybeSnapshot()` are no-ops. `main.js` checks `store.loadFailed` before starting the router and, if set, renders `src/modules/recovery/index.js` instead of any normal screen or nav — download the raw data, restore a daily snapshot, import a backup, or (after confirmation) `store.startFreshAfterFailedLoad()`. Any of those clears the failed state and saving resumes; the recovery copy is always kept. `importBackup()` validates shape before replacing anything (must be a plain object with object-typed `srsCards`, `settings`, and `stats`) and throws on anything else, leaving current data untouched.

Also in `storage.js`: daily snapshots (one JSON copy per day, 7-day rolling retention, separate `localStorage` key so a bad write to one can't corrupt the other) and the Export/Import backup feature (downloads/restores the whole blob as JSON — this is the user's actual backup strategy since there's no server; Settings nags them about it after 7 days).

## The SRS engine: `src/srs/engine.js` + `src/srs/queue.js`

**`engine.js`** is pure functions, no I/O — a simplified SM-2 spaced-repetition algorithm. Key exports:
- `Grade = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 }`
- `grade(card, gradeValue, now)` → next card state. New/learning cards step through two learning intervals (10 min, then 1 day) before graduating to day-granularity review scheduling; review cards use ease-factor scheduling (ease adjusts ±0.15–0.2 per grade, interval multiplies by ease).
- `gradeFromCorrectness(correct, hintUsed)` — the bridge every game/quiz uses: wrong → AGAIN, right-with-hint → capped at HARD (needing a hint means it's not fully known), right-without-hint → GOOD. This is why using a hint anywhere in the app never lets a card schedule as far out as a clean answer would.
- `FACETS` — the heart of the content design. Each part-of-speech/content-type tracks separate recall "facets" so the app can notice "always knows the meaning, never the gender" rather than one blended score per word:

  | type | facets |
  |---|---|
  | noun | `meaning_de_en`, `meaning_en_de`, `gender`, `plural` |
  | verb | `meaning`, `principal_parts` |
  | adjective / adverb / other | `meaning` |
  | phrase | `phrase_to_meaning`, `situation_to_phrase` |
  | grammar | `default` (one card per exercise) |

**`queue.js`** is the only module that knows how content items map onto SRS card ids. Card id format: `` `${type}:${sourceId}::${itemId}:${facet}` `` (e.g. `vocab:core-verbs-1::gehen:meaning`) via `vocabCardId()`/`phraseCardId()`/`grammarCardId()` — never build these strings by hand elsewhere. Also here:
- Pack activation/triage (`activateVocabPack`, `getPendingTriageWords`, `triageWord`) — vocab packs default **off** until the user activates one in Settings and triages its words ("already know it" → scheduled far out; "drill it" → enters the queue as new); grammar units and phrase sets default **on** (no triage step, small curated content).
- `buildReviewSession()` — today's actual due queue: all overdue/weak cards (most urgent first) plus new cards up to the daily allowance, interleaved across vocab/phrase/grammar so one module doesn't dominate a session.
- `throttleStatus()` — auto-slows (then pauses) new-card intake once the due backlog crosses configurable thresholds, so a big backlog can't snowball.
- `weightedSample()` — weighted-random selection biased toward weak/new cards, used by Test-me and the mixed grammar quiz (not the daily queue, which is strictly most-urgent-first).
- `getAllVocabWords()` (in `contentLoader.js`, re-exported-in-spirit here) **ignores pack activation entirely** — it's the full word list across every pack, used by the games (sorting, timed, Wordfall, etc.) regardless of what's "active." Activation only gates the *daily SRS review queue*, not game content. This is a real, intentional asymmetry — don't assume "not activated" means "not drillable."

## Content pipeline: `src/db/contentLoader.js`

Every JSON file under `content/{vocab/packs,grammar/units,phrases/sets,stories}/*.json` is auto-discovered at build time via `import.meta.glob(..., { eager: true })` — **there is no manifest/index file to register a new one.** Drop a valid file in the right folder with `id` matching the filename, run `npm run validate`, done.

- **Path A** (in-app manual entry, right after a lesson): the `/add` screen (`src/modules/addcontent/index.js`) saves words/phrases/notes straight into `storage.js`'s `userContent`. `contentLoader.js` merges these into the same lists at runtime under a synthetic `"user-added"` pack/set id, so the rest of the app can't tell a user-typed word from a repo-authored one. These never touch the filesystem and ride along in Export/Import.
- **Path B** (bulk generation via a Claude Code session): fully documented in **CONTENT_GUIDE.md** — schemas, the facet-design rationale, per-content-type field requirements, and hard quality rules (never >100 items per generation pass; validation only checks JSON shape, *not* German grammatical correctness — gender/plural/principal-parts need manual re-checking every time). Read that file before generating or editing any content JSON; don't duplicate its rules here.
- `scripts/validate-content.js` (via `npm run validate`, which also runs automatically before `npm run build`) checks every file against its schema, confirms `id` matches the filename, and checks for duplicate ids within and across files of the same type.

**Content as of this writing:** 8 vocab packs (470 words), 5 grammar units (`wechselpraepositionen`, `perfekt-vs-praeteritum`, `adjective-endings`, `dative-verbs`, `fixed-case-prepositions`), 1 phrase set (`classic-idioms`, 25 phrases), 2 stories. Treat this as a snapshot — `ls content/*/*/` to get the current truth.

## i18n: `src/i18n.js`

A single flat `LABELS` map, each key holding `{ de: ..., en: ... }` (a value may be a function for interpolated strings, e.g. counts). `t(key, ...args)` resolves against `store.getSettings().uiLanguage` (toggled in Settings, persisted, default `'de'`). `onLanguageChange(fn)` lets `main.js` re-paint the nav + current screen in place when the toggle flips.

**Important scope limit, stated in the file's own header comment:** only UI *chrome* (nav, buttons, tab labels, common in-game strings like "Hint"/"Check"/"Play again") goes through this system. Deep content — grammar explanations, exercise prompts, settings help paragraphs, all vocab/phrase/story data, near-miss diff messages — is intentionally hardcoded English always, regardless of the toggle. When adding a new screen's UI chrome, add a `LABELS` entry instead of hardcoding text; when writing a help paragraph or content string, hardcoding English is the existing convention, not an oversight.

## UI conventions worth knowing before you add a screen

- **Escaping:** `escapeHtml()` is reimplemented locally in several files (`components/gender.js`, `grammar/exerciseRenderer.js`, `games/stories.js`, etc.) rather than imported from one place — it's a tiny pure function and the duplication is an accepted existing pattern, not a bug to "fix" by refactoring into a shared import (several modules already import the one in `components/gender.js` where convenient; others just inline their own). Follow whichever the file you're editing already does.
- **`shuffle()`** (Fisher-Yates) is likewise copy-pasted into basically every game module rather than factored out. Same deal — match the surrounding file.
- **German-first hint convention:** prompts that carry a grammar cue author it as a trailing parenthetical, e.g. `"Das Buch liegt auf ___ Tisch. (wo?)"`. `resolveHint()` in `src/modules/grammar/exerciseRenderer.js` strips that parenthetical from the default display and only reveals it via the Hint button — so by default the learner sees bare German with no coaching. (There is no coaching on/off setting.) **Current exception:** fill-in-the-blank exercises always show `translation_en` (an English translation of the full sentence) above the prompt before the learner answers (`renderFillBlank` in `exerciseRenderer.js`; required by the grammar-unit schema). This is the current behavior and a later task will change it. This convention is reused by Case detective and is the reason CONTENT_GUIDE.md insists option text itself must never leak the answer (cues belong in the stripped parenthetical, never in a multiple-choice option string).
- **Hint discipline everywhere:** using any hint caps that answer's grade at HARD (`gradeFromCorrectness`), so the SRS always schedules a hinted-but-correct answer sooner than a clean one.
- **Shared building blocks** (`src/modules/shared/`): `itemRenderer.js` (dispatches a resolved SRS queue item to the right interaction — flip-card or multiple-choice — based on its `facet`), `flipCard.js` (tap-to-reveal + 4-grade self-assessment), `resultsSummary.js` (the "round results" list every game's end screen uses), `missesReview.js` (the "practice my misses" button's mini review loop, reusing `itemRenderer.js`), `labels.js` (human-readable labels for a queue item, used by dashboard/review/Test-me).
- **Theming:** CSS custom properties on `:root` in `src/style.css`, flipped by `data-theme="light"|"dark"` on `<html>` (set by `src/theme.js` from the persisted `settings.theme`; absent = follow `prefers-color-scheme`). Follow the existing `@media (prefers-color-scheme: light)` + `[data-theme="light"]` + `[data-theme="dark"]` triple-block pattern if you ever add a new themed color.
- **Gender color-coding** (`der`/`die`/`das`) is centralized in `src/components/gender.js` (`genderBadgeHTML`, `nounHTML`) and in CSS vars `--der`/`--die`/`--das` — reuse these rather than hardcoding colors when a noun's gender is shown.

## The modules tour (`src/modules/`)

- **`dashboard/`** — `index.js` (home screen: due count, streak, strength-by-module, weakest spots), `review.js` (the daily SRS review session, chunked by `settings.reviewSessionSize`), `more.js` (the "More" tab's link list).
- **`active/`** — the "Active content" hub linking to vocab/grammar management and Add content.
- **`vocab/`** — `browse.js` (pack list + activate/deactivate toggle), `pack.js` (word list within a pack), `triage.js` (the "already know it" vs "drill it" sweep after activating a pack).
- **`grammar/`** — `list.js`, `unit.js` (explanation + table rendering), `practice.js` (drill one unit's exercises in order), `quiz.js` (weighted mixed quiz across all units), `exerciseRenderer.js` (the shared renderer for all 5 exercise types — read this before adding a 6th type), `reorderChecker.js` (pure, unit-tested token-order matching for `reorder` exercises).
- **`phrases/`** — `list.js`, `quiz.js` (situation→phrase context quiz).
- **`testme/`** — `index.js` (module/length picker), `run.js` (runs a weighted-sampled mixed quiz across chosen modules, shows a "what to review" list of misses at the end).
- **`addcontent/`** — Path A manual entry (word/phrase/note tabs).
- **`settings/`** — theme, UI language, daily limits, auto-throttle thresholds, vocab pack activation checkboxes, Export/Import backup, snapshot restore, danger zone (erase all progress).
- **`games/`** — see below, it's the most actively-growing part of the app.
- **`shared/`** — covered above.

## Games (`src/modules/games/`)

Main list (linked from the Games hub, `hub.js`): **der/die/das sorting** (`sorting.js` — Timed + Streak modes), **Timed challenge** (`timed.js` — 60s meaning quiz), **Fill-in-the-blank story** (`stories.js` — reads from `content/stories/`), **Wordfall** (`wordfall.js` — promoted out of beta; see below).

Beta list (still being tuned, tagged `<span class="tag">beta</span>` in the hub): **Type it** (`beta/typeit.js` — type the German spelling from an English prompt, with a "check gender" toggle requiring the article), **Case detective** (`beta/caseDetective.js` — pulls directly from grammar units' bare-option exercises rather than having its own content, see CONTENT_GUIDE.md's dedicated section on it), **Verb forms sprint** (`beta/verbSprint.js` — build the Perfekt: pick hat/ist then the participle).

**Promoting a beta game to the main list** (precedent: Wordfall) is: move the file from `games/beta/` to `games/`, fix its now-one-level-shallower relative imports, update the route in `main.js`, move its hub link out of the Beta section and drop the `<span class="tag">beta</span>`.

**Wordfall specifically** (`games/wordfall.js`) is the newest/most featured game and a good template for "a game with a pre-round menu": falling-word tap-the-meaning game with a pre-game menu offering (1) a German↔English **direction toggle** persisted as `settings.wordfallDirection`, and (2) an **Advanced settings** `<details>` disclosure to scope practice to specific vocab packs, persisted as `settings.wordfallPackIds` (empty array = every pack). Direction changes which SRS facet gets graded: German→English keeps the game's original unconditional `meaning_de_en` facet (so existing progress isn't orphaned by the redesign); English→German reuses Type it's existing noun-vs-other split (`meaning_en_de` for nouns, `meaning` otherwise) rather than inventing a third facet set.

**Per-game best-score shape:** `stats.gameBests[gameId]` — shape varies by game (`{ score }` for Wordfall, `{ score, streak }` for timed-duration games, `{ score, total, recentIds }` for Case detective's pool-rotation tracking). If you add a new game, pick a new `gameId` key and whatever shape makes sense for it; nothing enforces a common shape across games.

## Testing & validation

- `npm run test` → `node --test src` (recursively finds every `*.test.js`). No test framework dependency — plain `node:test` + `node:assert/strict`. Tests that touch `storage.js`/`i18n.js` stub `globalThis.localStorage` with a tiny in-memory class (copy that pattern for new tests needing storage).
- `npm run validate` → content schema validation (see Content Pipeline above). Runs automatically as part of `npm run build`.
- There is no UI/browser test runner in this repo (no Playwright/Cypress) — UI changes need manual verification via `npm run dev` (or ask a human/agent with real browser access to check).

## Common tasks — where to start

- **Add vocab/grammar/phrases/stories** → read CONTENT_GUIDE.md, drop a JSON file, `npm run validate`.
- **Add a new game** → copy the shape of the most similar existing game (`timed.js` for a simple timed quiz, `sorting.js`/`typeit.js` for a Timed+Streak mode pair, `wordfall.js` for a pre-game settings menu), register its route in `main.js`, add a hub link in `games/hub.js` (start it in the Beta section unless told otherwise).
- **Add a new setting** → add a default under `settings` in `storage.js`'s `defaultData()` (purely additive, no migration needed), read/write it via `store.getSettings()`/`store.updateSettings()`, surface a control for it in `settings/index.js` or wherever is contextually relevant (per-game settings live in that game's own pre-round screen, e.g. Wordfall's direction/pack picker, Type it's gender-check toggle).
- **Add UI chrome text** → add a `LABELS` entry in `i18n.js`, call `t('yourKey')`.
- **Change the storage shape** → stop and read the "sacred data" section above and CLAUDE.md in full before touching anything under `defaultData()`.
- **Change theming/colors** → CSS vars in `src/style.css`'s `:root` + the light/dark override blocks.

## Known quirks / things that look like bugs but aren't

- `getAllVocabWords()` draws from every pack regardless of activation — games are not gated by the "activate a pack" flow that gates the SRS review queue. (See SRS section above.)
- `escapeHtml`/`shuffle` are duplicated across many files rather than centralized — intentional, low-stakes duplication, not an oversight.
- The service worker is hand-rolled instead of using Workbox — originally a Node-version workaround (see Tech Stack above); the underlying Node constraint has since changed, but there's no open need to revisit it.
- Vocab packs default **inactive**; grammar units and phrase sets default **active**. This is intentional (vocab needs a triage pass first; grammar/phrases are small and curated enough not to need one) — see `queue.js`'s `isActiveByDefault`.
