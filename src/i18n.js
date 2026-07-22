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
  navMore: { de: 'Mehr', en: 'More' },

  moreTitle: { de: 'Mehr', en: 'More' },
  morePhrases: { de: 'Phrasen &amp; Redewendungen', en: 'Phrases &amp; Idioms' },
  moreActiveContent: { de: 'Aktive Inhalte', en: 'Active content' },
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
  autoThrottle: { de: 'Automatische Drosselung neuer Karten', en: 'Auto-throttle new cards' },
  vocabPacksHeading: { de: 'Vokabelpakete', en: 'Vocabulary packs' },
  tryAgain: { de: 'Erneut versuchen', en: 'Try again' },
  exportBackup: { de: 'Backup exportieren', en: 'Export backup' },
  importBackup: { de: 'Backup importieren', en: 'Import backup' },
  automaticSnapshots: { de: 'Automatische Schnappschüsse', en: 'Automatic snapshots' },
  restore: { de: 'Wiederherstellen', en: 'Restore' },
  dangerZone: { de: 'Gefahrenzone', en: 'Danger zone' },
  eraseAllProgress: { de: 'Gesamten Fortschritt auf diesem Gerät löschen', en: 'Erase all progress on this device' },

  perfektAuxQuestion: { de: 'Perfekt: Hilfsverb?', en: 'Perfekt: auxiliary?' },

  // --- Type it: gender-check toggle (new) ---
  checkGenderToggle: { de: 'Genus prüfen', en: 'Check gender' },
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
