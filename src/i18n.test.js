import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryLocalStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

globalThis.localStorage = new MemoryLocalStorage();

const { t, getUiLanguage, setUiLanguage, onLanguageChange } = await import('./i18n.js');

test('defaults to German', () => {
  assert.equal(getUiLanguage(), 'de');
  assert.equal(t('navGames'), 'Spiele');
});

test('toggling to English flips plain-string labels', () => {
  setUiLanguage('en');
  assert.equal(getUiLanguage(), 'en');
  assert.equal(t('navGames'), 'Games');
  assert.equal(t('navTestMe'), 'Test me');
  setUiLanguage('de'); // restore for subsequent tests
});

test('function-valued labels interpolate correctly in both languages', () => {
  setUiLanguage('de');
  assert.equal(t('practiceMyMisses', 5), 'Meine Fehler üben (5)');
  setUiLanguage('en');
  assert.equal(t('practiceMyMisses', 5), 'Practice my misses (5)');
  setUiLanguage('de');
});

test('startReview only appends the "of total" suffix when the session is capped', () => {
  assert.equal(t('startReview', 30, 30), 'Wiederholung starten (30)');
  assert.equal(t('startReview', 30, 82), 'Wiederholung starten (30 von 82)');
});

test('unknown keys fall back to the key itself rather than throwing', () => {
  assert.equal(t('thisKeyDoesNotExist'), 'thisKeyDoesNotExist');
});

test('onLanguageChange listeners fire on toggle and can unsubscribe', () => {
  let calls = 0;
  const unsubscribe = onLanguageChange(() => calls++);
  setUiLanguage('en');
  assert.equal(calls, 1);
  unsubscribe();
  setUiLanguage('de');
  assert.equal(calls, 1); // did not fire after unsubscribing
});
