# CLAUDE.md

Project-specific guidance for working in this repo. See also [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) for the content-generation pipeline (vocab packs, grammar units, phrase sets, stories).

## User progress data is sacred

All on-device progress lives in `localStorage` under `src/db/storage.js` (SRS card states, streaks, activated packs, user-added content, settings). **No change may reset, wipe, or silently break compatibility with data already on the user's device** — this is a personal-use app with no server backup; a data loss bug there is permanent for the user.

Concretely:
- If you change the shape of anything under `defaultData()` in `storage.js`, add a migration step to `MIGRATIONS` (keyed by the version it upgrades from) rather than relying on defaults to paper over it. Bump `STORAGE_VERSION` when you do.
- Never replace `localStorage.getItem/setItem` calls with logic that can silently start from an empty/default state when existing data fails to parse in an unexpected shape — fail loud (console.error) and fall back to the safest non-destructive option, not a wipe.
- The additive merge in `migrate()` (spread defaults, then overlay real data) is a safety net for missing fields, not a substitute for a real migration when a value's meaning or shape changes.
- Don't touch `store.resetAll()` or the "Erase all progress" Settings button's behavior without being explicitly asked to.
