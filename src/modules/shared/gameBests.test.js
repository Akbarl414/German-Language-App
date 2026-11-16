import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryLocalStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
globalThis.localStorage = new MemoryLocalStorage();

const { store } = await import('../../db/storage.js');
const { getBest, recordBest } = await import('./gameBests.js');

const higher = (e, prev) => !prev || e.score > prev.score;

test('first result is a best; a lower one is not; a higher one replaces it', () => {
  assert.equal(getBest('kit-test'), null);
  assert.equal(recordBest('kit-test', { score: 5 }, higher), true);
  assert.deepEqual(getBest('kit-test'), { score: 5 });
  assert.equal(recordBest('kit-test', { score: 3 }, higher), false);
  assert.deepEqual(getBest('kit-test'), { score: 5 });
  assert.equal(recordBest('kit-test', { score: 8 }, higher), true);
  assert.deepEqual(getBest('kit-test'), { score: 8 });
});

test("recording leaves other games' bests untouched", () => {
  store.updateStats({ gameBests: { ...store.getStats().gameBests, 'sorting-streak': { streak: 11 } } });
  recordBest('kit-test-2', { score: 1 }, higher);
  assert.deepEqual(getBest('sorting-streak'), { streak: 11 });
  assert.deepEqual(getBest('kit-test'), { score: 8 });
});
