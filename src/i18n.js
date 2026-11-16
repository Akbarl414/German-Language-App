// Central label map for the app's UI chrome (nav, buttons, tabs, common
// in-game actions) — every string that got translated to German gets one
// entry here with both a `de` and `en` version, so Settings > Sprache der
// Oberfläche / Interface language can flip the whole app at once. New
// screens: add a key here instead of hardcoding text, and both languages
// come for free.
//
// Deep content (grammar explanations, exercise prompts, settings help text,
// vocab/phrase data, near-miss diff messages) was never translated and
// stays hardcoded English regardless of this toggle — only entries below
// are language-aware.
//
// A value may be a plain string or a function `(...args) => string` for
// labels that need interpolation (counts, scores, etc.) — `t(key, ...args)`
// calls it with whatever arguments the call site passes.

import { store } from './db/storage.js';

const LABELS = {
  // --- Nav / top-level screens ---
  navHome: { de: 'Start', en: 'Home' },
  navGames: { de: 'Spiele', en: 'Games' },
  navTestMe: { de: 'Teste mich', en: 'Test me' },
  navCore: { de: 'Kern 1000', en: 'Core 1000' },
  navMore: { de: 'Mehr', en: 'More' },

  moreTitle: { de: 'Mehr', en: 'More' },
  morePhrases: { de: 'Phrasen &amp; Redewendungen', en: 'Phrases &amp; Idioms' },
  moreActiveContent: { de: 'Aktive Inhalte', en: 'Active content' },
  moreUpdates: { de: 'Neuigkeiten', en: 'Update notes' },
  moreSettings: { de: 'Einstellungen', en: 'Settings' },

  activeContentTitle: { de: 'Aktive Inhalte', en: 'Active content' },
  activeContentGrammar: { de: 'Grammatik', en: 'Grammar' },
  activeContentVocab: { de: 'Vokabeln', en: 'Vocabulary' },
  activeContentAdd: { de: 'Inhalt hinzufügen', en: 'Add content' },

  // --- Module labels (shared across dashboard, testme, review, weakest spots) ---
  moduleVocab: { de: 'Vokabeln', en: 'Vocabulary' },
  modulePhrase: { de: 'Phrasen', en: 'Phrases' },
  moduleGrammar: { de: 'Grammatik', en: 'Grammar' },

  // --- Dashboard ---
  dueToday: { de: 'Heute fällig', en: 'Due today' },
  streak: { de: 'Serie', en: 'Streak' },
  bestStreak: { de: 'Beste Serie', en: 'Best streak' },
  cardsTracked: { de: 'Karten erfasst', en: 'Cards tracked' },
  startReview: {
    de: (n, total) => `Wiederholung starten (${n}${total && total > n ? ` von ${total}` : ''})`,
    en: (n, total) => `Start review (${n}${total && total > n ? ` of ${total}` : ''})`,
  },
  nothingDueReviewAnyway: { de: 'Nichts fällig — trotzdem wiederholen', en: 'Nothing due — review anyway' },
  strengthByModule: { de: 'Stärke nach Bereich', en: 'Strength by module' },
  weakestSpots: { de: 'Schwächste Bereiche', en: 'Weakest spots' },
  activeContentBtn: { de: '🗂️ Aktive Inhalte', en: '🗂️ Active content' },

  // --- Review session ---
  reviewTitle: { de: 'Wiederholen', en: 'Review' },
  sessionDone: { de: 'Runde geschafft! 🎉', en: 'Session done! 🎉' },
  reviewed: { de: 'Wiederholt', en: 'Reviewed' },
  remembered: { de: 'Gewusst', en: 'Remembered' },
  backToDashboard: { de: 'Zurück zum Start', en: 'Back to dashboard' },
  anotherRound: { de: (n) => `Weitere Runde (${n})`, en: (n) => `Another round (${n})` },

  // --- Throttle note ---
  throttlePaused: { de: '⏸️ Neue Wörter pausiert, bis deine Warteschlange kleiner wird.', en: '⏸️ New words paused until your queue shrinks.' },
  throttleReduced: { de: '🐢 Neue Wörter verlangsamt, bis deine Warteschlange kleiner wird.', en: '🐢 New words slowed down until your queue shrinks.' },

  // --- Shared results / review chrome ---
  roundResults: { de: 'Rundenergebnisse', en: 'Round results' },
  practicingYourMisses: { de: (i, total) => `${i} / ${total} · Du übst deine Fehler`, en: (i, total) => `${i} / ${total} · Practicing your misses` },
  backToGames: { de: 'Zurück zu den Spielen', en: 'Back to games' },
  playAgain: { de: 'Nochmal spielen', en: 'Play again' },
  practiceMyMisses: { de: (n) => `Meine Fehler üben (${n})`, en: (n) => `Practice my misses (${n})` },
  newBest: { de: 'Neuer Bestwert!', en: 'New best!' },
  newBestScore: { de: 'Neue Bestpunktzahl!', en: 'New best score!' },
  wordfallNewBest: { de: 'Neuer Bestwert!', en: 'New best score!' },
  bestValue: { de: (n) => `Bestwert: ${n}`, en: (n) => `Best: ${n}` },
  bestScoreValue: { de: (n) => `Bestwert: ${n}`, en: (n) => `Best score: ${n}` },
  bestStreakValue: { de: (n) => `Beste Serie: ${n}`, en: (n) => `Best streak: ${n}` },
  noBestYet: { de: 'Noch kein Bestwert', en: 'No best yet' },
  score: { de: 'Punkte', en: 'Score' },
  correct: { de: 'Richtig', en: 'Correct' },
  wordsSeen: { de: 'Wörter gesehen', en: 'Words seen' },
  timesUp: { de: 'Zeit abgelaufen! ⏱️', en: "Time's up! ⏱️" },
  streakEnded: { de: 'Serie beendet', en: 'Streak ended' },
  streakNoTimer: { de: 'Serie (ohne Timer)', en: 'Streak (no timer)' },
  scoreStreakHeader: { de: (score, streak) => `Punkte ${score} · Serie ${streak}`, en: (score, streak) => `Score ${score} · Streak ${streak}` },
  streakColon: { de: (n) => `Serie: ${n}`, en: (n) => `Streak: ${n}` },
  hintBtn: { de: '💡 Tipp', en: '💡 Hint' },
  hintWord: { de: 'Tipp', en: 'Hint' },
  whyBtn: { de: '🔍 Warum?', en: '🔍 Why?' },
  bestScoreOutOf: { de: (s, tot) => `Bestwert: ${s}/${tot}`, en: (s, tot) => `Best: ${s}/${tot}` },
  checkBtn: { de: 'Prüfen', en: 'Check' },
  continueBtn: { de: 'Weiter', en: 'Continue' },
  nextBtn: { de: 'Weiter', en: 'Next' },
  seeResultsBtn: { de: 'Ergebnisse ansehen', en: 'See results' },

  // --- Flip card (daily review SRS grading) ---
  showAnswer: { de: 'Antwort zeigen', en: 'Show answer' },
  gradeAgain: { de: 'Nochmal', en: 'Again' },
  gradeHard: { de: 'Schwer', en: 'Hard' },
  gradeGood: { de: 'Gut', en: 'Good' },
  gradeEasy: { de: 'Leicht', en: 'Easy' },

  // --- Grammar exercise renderer ---
  correctExclaim: { de: 'Richtig!', en: 'Correct!' },
  correctCheckFlash: { de: '✓ Richtig!', en: '✓ Correct!' },
  correctAnswerValue: { de: (a) => `Richtige Antwort: ${a}`, en: (a) => `Correct answer: ${a}` },
  correctValue: { de: (a) => `Richtig: ${a}`, en: (a) => `Correct: ${a}` },
  correctOrderValue: { de: (a) => `Richtige Reihenfolge: ${a}`, en: (a) => `Correct order: ${a}` },
  fillInTheBlank: { de: 'Lücke ausfüllen', en: 'Fill in the blank' },
  findAndCorrect: { de: 'Fehler finden und korrigieren', en: 'Find and correct the error' },

  // --- Test me ---
  testMeTitle: { de: 'Teste mich', en: 'Test me' },
  numberOfQuestions: { de: 'Anzahl der Fragen', en: 'Number of questions' },
  startTest: { de: 'Test starten', en: 'Start test' },
  testComplete: { de: 'Test abgeschlossen', en: 'Test complete' },
  questions: { de: 'Fragen', en: 'Questions' },
  whatToReview: { de: 'Was du wiederholen solltest', en: 'What to review' },
  testMeAgain: { de: 'Nochmal testen', en: 'Test me again' },

  // --- Games hub ---
  gamesTitle: { de: 'Spiele', en: 'Games' },
  gamesHubIntro: {
    de: 'Ergebnisse zählen für Wörter, die schon in deinen Wiederholungen sind. Andere Wörter sind nur zum Üben.',
    en: 'Results count for words already in your reviews; other words are practice only.',
  },
  betaHeading: { de: 'Beta', en: 'Beta' },
  betaBlurb: {
    de: 'Neue Spiele, die noch abgestimmt werden. Probier sie aus und sag mir, was bleiben soll.',
    en: 'New games still being tuned. Play them and tell me what to keep.',
  },
  gameSortingName: { de: 'der/die/das-Sortieren', en: 'der/die/das sorting' },
  gameStoriesName: { de: 'Lückengeschichte', en: 'Fill-in-the-blank story' },
  gameWordfallName: { de: 'Wordfall', en: 'Wordfall' },
  gameTypeItName: { de: 'Type it', en: 'Type it' },
  gameCaseDetectiveName: { de: 'Kasus-Detektiv', en: 'Case detective' },
  gameVerbSprintName: { de: 'Verbformen-Sprint', en: 'Verb forms sprint' },
  gameSatzbauName: { de: 'Satzbau', en: 'Satzbau' },
  satzbauInstruction: { de: 'Tippe die Wörter in die richtige Reihenfolge.', en: 'Tap the words into the right order.' },
  satzbauAlsoPossible: { de: 'Richtig! Auch möglich.', en: 'Correct! Also possible.' },
  satzbauMoreUsual: { de: (o) => `Üblicher: ${o}`, en: (o) => `More usual: ${o}` },
  satzbauAlsoTag: { de: 'auch möglich', en: 'also possible' },
  satzbauMissed: { de: 'Falsch', en: 'Missed' },

  // --- Game titles, instructions and buttons ---
  startGame: { de: 'Start', en: 'Start' },
  sortingChooseMode: { de: 'Wähle einen Modus.', en: 'Choose a mode.' },
  storiesTitle: { de: 'Lückengeschichten', en: 'Fill-in-the-blank stories' },
  storiesIntro: {
    de: 'Leseübung mit deinem aktuellen Wortschatz und deiner Grammatik.',
    en: 'Reading practice using your current vocab and grammar.',
  },
  storiesNone: { de: 'Noch keine Geschichten.', en: 'No stories yet.' },
  wordfallIntro: {
    de: 'Tippe die richtige Bedeutung, bevor das Wort landet. Es wird immer schneller. Bei 3 Fehlern ist Schluss.',
    en: 'Tap the right meaning before the word lands. Speed ramps up. 3 misses ends the run.',
  },
  wordfallOver: { de: 'Wordfall vorbei', en: 'Wordfall over' },
  typeItIntro: {
    de: 'Du siehst das Englische, tippe das Deutsche. Auf die genaue Schreibweise kommt es an: Nomen werden großgeschrieben.',
    en: 'You see the English, type the German. Exact spelling counts — nouns need capital letters.',
  },
  typeItGenderHelp: {
    de: 'Wenn aktiv, muss die Antwort bei Nomen den Artikel enthalten (z. B. "der Löffel"). Sonst wird das Nomen ohne Artikel akzeptiert.',
    en: 'When on, noun answers must include the article (e.g. "der Löffel"). When off, the bare noun is accepted.',
  },
  typeItSoClose: { de: 'Knapp daneben! 🤏', en: 'So close! 🤏' },
  typeItNotQuite: { de: 'Nicht ganz', en: 'Not quite' },
  typeItYouWrote: { de: 'Du hast geschrieben', en: 'You wrote' },
  typeItCorrectLabel: { de: 'Richtig', en: 'Correct' },
  typeItInputLabel: { de: 'Das deutsche Wort eintippen', en: 'Type the German word' },
  typeItHintText: {
    de: (first, len, isNoun) => `Beginnt mit "${first}" · ${len} Buchstaben${isNoun ? ' · Nomen werden großgeschrieben' : ''}`,
    en: (first, len, isNoun) => `Starts with "${first}" · ${len} letters${isNoun ? ' · nouns are always capitalized' : ''}`,
  },
  caseIntro: {
    de: 'Wähle den Artikel oder die Endung, die passt. Tippe jederzeit auf "Warum?", wenn du die Regel sehen willst.',
    en: 'Pick the article or ending that fits. Tap "Why?" any time you want the rule spelled out.',
  },
  caseNotEnough: { de: 'Noch nicht genug Kasus-Übungen vorhanden.', en: 'Not enough case exercises available yet.' },
  caseStart: { de: (n) => `Start (${n} Fragen)`, en: (n) => `Start (${n} questions)` },
  caseClosed: { de: 'Fall abgeschlossen', en: 'Case closed' },
  verbSprintIntro: {
    de: 'Bilde das Perfekt: wähle hat/ist, dann das Partizip.',
    en: 'Build the Perfekt: pick hat/ist, then the participle.',
  },
  extraPacksHelp: {
    de: 'Wörter aus deinen aktiven Vokabelpaketen sind immer dabei. Wähle Zusatzpakete, um auch deren Wörter zu üben. Zusatzwörter sind nur zum Üben: Sie kommen nie in deine tägliche Wiederholung.',
    en: 'Words from your active vocab packs are always included. Tick extra packs to practise their words too. Extra words are practice only: they never go into your daily review.',
  },
  extraPacksNone: { de: 'Alle Vokabelpakete sind bereits aktiv.', en: 'All vocab packs are already active.' },
  poolTooSmallHelp: {
    de: 'Aktiviere weitere Vokabelpakete oder wähle unten unter Erweiterte Einstellungen Zusatzpakete.',
    en: 'Activate more vocab packs, or choose extra packs under Advanced settings below.',
  },

  // --- Sorting / timed / stories ---
  hintGenderMeaning: { de: '💡 Tipp (zeigt Bedeutung, nicht Genus)', en: '💡 Hint (shows meaning, not gender)' },
  backToStories: { de: '&larr; Geschichten', en: '&larr; Stories' },
  checkStory: { de: 'Geschichte prüfen', en: 'Check story' },

  // --- Add content ---
  addContentTitle: { de: 'Inhalt hinzufügen', en: 'Add content' },
  tabWord: { de: 'Wort', en: 'Word' },
  tabPhrase: { de: 'Phrase', en: 'Phrase' },
  tabNote: { de: 'Notiz', en: 'Note' },
  saveWord: { de: 'Wort speichern', en: 'Save word' },
  savePhrase: { de: 'Phrase speichern', en: 'Save phrase' },
  saveNote: { de: 'Notiz speichern', en: 'Save note' },

  // --- Vocab / Grammar list ---
  vocabTitle: { de: 'Vokabeln', en: 'Vocabulary' },
  addAWord: { de: '➕ Wort hinzufügen', en: '➕ Add a word' },
  packActive: { de: 'Aktiv', en: 'Active' },
  packOff: { de: 'Aus', en: 'Off' },
  grammarTitle: { de: 'Grammatik', en: 'Grammar' },
  mixedQuiz: { de: 'Gemischtes Quiz (alle Einheiten)', en: 'Mixed quiz (all units)' },
  phrasesTitle: { de: 'Phrasen &amp; Redewendungen', en: 'Phrases &amp; Idioms' },

  // --- Settings ---
  settingsTitle: { de: 'Einstellungen', en: 'Settings' },
  appearance: { de: 'Erscheinungsbild', en: 'Appearance' },
  themeLight: { de: 'Hell', en: 'Light' },
  themeDark: { de: 'Dunkel', en: 'Dark' },
  themeSystem: { de: 'System folgen', en: 'Follow system' },
  dailyNewCards: { de: 'Neue Karten pro Tag', en: 'Daily new cards' },
  reviewSessions: { de: 'Wiederholungsrunden', en: 'Review sessions' },
  coreNewPerDayHeading: { de: 'Kern 1000: neue Wörter pro Tag', en: 'Core 1000: new words per day' },
  autoThrottle: { de: 'Automatische Drosselung neuer Karten', en: 'Auto-throttle new cards' },
  vocabPacksHeading: { de: 'Vokabelpakete', en: 'Vocabulary packs' },
  tryAgain: { de: 'Erneut versuchen', en: 'Try again' },
  exportBackup: { de: 'Backup exportieren', en: 'Export backup' },
  importBackup: { de: 'Backup importieren', en: 'Import backup' },
  automaticSnapshots: { de: 'Automatische Schnappschüsse', en: 'Automatic snapshots' },
  restore: { de: 'Wiederherstellen', en: 'Restore' },
  dangerZone: { de: 'Gefahrenzone', en: 'Danger zone' },
  displayInfo: { de: 'Anzeigeinfo', en: 'Display info' },
  displayInsets: { de: 'Rand oben/rechts/unten/links', en: 'Insets T/R/B/L' },
  displayStandalone: { de: 'Standalone (Modus/Safari)', en: 'Standalone (mode/navigator)' },
  displayWindow: { de: 'Fenster', en: 'Window' },
  displayScreenHeight: { de: 'Bildschirmhöhe', en: 'Screen height' },
  displayViewport: { de: 'Viewport Höhe/oben', en: 'Visual viewport height/offsetTop' },
  displayAppTop: { de: 'App oben', en: 'App top' },
  displayYes: { de: 'ja', en: 'yes' },
  displayNo: { de: 'nein', en: 'no' },
  snapshotsFailingWarning: {
    de: 'Der heutige Schnappschuss konnte nicht gespeichert werden (Speicher voll). Exportiere regelmäßig ein Backup.',
    en: "Today's snapshot couldn't be saved (storage full). Export a backup regularly.",
  },
  storageUsed: {
    de: (main, snaps) => `Speicherbelegung: Daten ${main} · Schnappschüsse ${snaps}`,
    en: (main, snaps) => `Storage used: data ${main} · snapshots ${snaps}`,
  },

  // --- Save-failure banner (every screen, while saving fails) ---
  saveFailedBanner: {
    de: 'Speichern fehlgeschlagen: Der Speicher ist voll. Exportiere jetzt ein Backup, sonst geht neuer Fortschritt beim Schließen verloren.',
    en: 'Saving failed: storage is full. Export a backup now, or new progress will be lost when you close the app.',
  },
  saveFailedGoToSettings: { de: 'Zu den Einstellungen', en: 'Go to Settings' },
  // --- Update notes ---
  updatesTitle: { de: 'Neuigkeiten', en: 'Update notes' },
  updatesAlertText: { de: 'Die App wurde aktualisiert.', en: 'The app has been updated.' },
  updatesAlertLink: { de: 'Neuigkeiten ansehen', en: 'See what’s new' },
  updatesDismiss: { de: 'Schließen', en: 'Dismiss' },
  // --- Recovery screen (shown when saved data fails to load) ---
  recoveryTitle: { de: 'Gespeicherte Daten wiederherstellen', en: 'Recover saved data' },
  recoveryDownloadRaw: { de: 'Rohdaten herunterladen', en: 'Download raw saved data' },
  recoveryNoSnapshots: { de: 'Keine Schnappschüsse vorhanden.', en: 'No snapshots available.' },
  recoveryStartFresh: { de: 'Neu beginnen', en: 'Start fresh' },
  eraseAllProgress: { de: 'Gesamten Fortschritt auf diesem Gerät löschen', en: 'Erase all progress on this device' },

  perfektAuxQuestion: { de: 'Perfekt: Hilfsverb?', en: 'Perfekt: auxiliary?' },

  // --- Type it: gender-check toggle (new) ---
  checkGenderToggle: { de: 'Genus prüfen', en: 'Check gender' },

  // --- Wordfall ---
  direction: { de: 'Richtung', en: 'Direction' },
  directionDeToEn: { de: 'Deutsch → Englisch', en: 'German → English' },
  directionEnToDe: { de: 'Englisch → Deutsch', en: 'English → German' },
  advancedSettings: { de: 'Erweiterte Einstellungen', en: 'Advanced settings' },

  // --- Game word pool (all vocab games) ---
  notEnoughWordsToPlay: { de: 'Zu wenige Wörter zum Spielen.', en: 'Not enough words to play.' },
  activatePacksLink: { de: 'Wortpakete aktivieren', en: 'Activate vocab packs' },

  // --- Core 1000 tab ---
  coreTitle: { de: 'Kern 1000', en: 'Core 1000' },
  coreSubtitle: { de: 'Die 1.000 häufigsten Wörter, in Blöcken zu je 50.', en: 'The 1,000 most frequent words, in bands of 50.' },
  coreRecognised: { de: 'Erkannt', en: 'Recognised' },
  coreMastered: { de: 'Gemeistert', en: 'Mastered' },
  coreDueNow: { de: 'Jetzt fällig', en: 'Due now' },
  coreNewToday: { de: 'Neu heute', en: 'New today' },
  coreStartReview: { de: (n) => `Wiederholen (${n})`, en: (n) => `Review (${n})` },
  coreNothingToReview: { de: 'Gerade nichts zu wiederholen', en: 'Nothing to review right now' },
  coreUnlockBand: {
    de: (band, from, to) => `🔓 Block ${band} freischalten (${from}–${to})`,
    en: (band, from, to) => `🔓 Unlock band ${band} (${from}–${to})`,
  },
  coreAllUnlocked: { de: 'Alle Blöcke freigeschaltet', en: 'All bands unlocked' },
  coreContinueTriage: { de: (n) => `Sortieren fortsetzen (${n})`, en: (n) => `Continue triage (${n})` },
  coreBands: { de: 'Blöcke', en: 'Bands' },
  coreStartHint: { de: 'Schalte Block 1 frei, um zu beginnen.', en: 'Unlock band 1 to begin.' },
  coreTriageProgress: { de: (i, n, band) => `${i} / ${n} · Block ${band}`, en: (i, n, band) => `${i} / ${n} · Band ${band}` },
  coreShowMeaning: { de: 'Bedeutung zeigen', en: 'Show meaning' },
  coreKnowIt: { de: '✓ Kenne ich', en: '✓ I know it' },
  corePractise: { de: 'Üben', en: 'Practise' },
  coreTriageDone: { de: 'Sortieren fertig', en: 'Triage done' },
  coreTriageDoneText: {
    de: 'Wörter mit „Üben“ kommen nach und nach in deine Kern-1000-Wiederholung.',
    en: 'Words marked “Practise” come into your Core 1000 review a few at a time.',
  },
  coreBackToCore: { de: 'Zurück zu Kern 1000', en: 'Back to Core 1000' },
  coreNothingDue: { de: 'Gerade nichts fällig. Schalte einen Block frei oder komm später wieder.', en: 'Nothing due right now. Unlock a band or come back later.' },
};

export function getUiLanguage() {
  return store.getSettings().uiLanguage === 'en' ? 'en' : 'de';
}

export function setUiLanguage(lang) {
  store.updateSettings({ uiLanguage: lang === 'en' ? 'en' : 'de' });
  listeners.forEach((fn) => fn());
}

export function t(key, ...args) {
  const entry = LABELS[key];
  if (!entry) return key;
  const lang = getUiLanguage();
  const val = entry[lang] ?? entry.de;
  return typeof val === 'function' ? val(...args) : val;
}

const listeners = new Set();
/** Subscribe to be notified after the UI language changes (e.g. to repaint nav / the current view). Returns an unsubscribe function. */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
