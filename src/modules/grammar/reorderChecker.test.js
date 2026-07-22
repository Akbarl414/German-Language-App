import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReorderAnswer, acceptedOrders } from './reorderChecker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('sentence-initial word matches regardless of case', () => {
  const exercise = { tokens: ['heute', 'gehe', 'ich'], answerOrder: ['Heute', 'gehe', 'ich'] };
  assert.equal(checkReorderAnswer(['heute', 'gehe', 'ich'], exercise), true);
  assert.equal(checkReorderAnswer(['Heute', 'gehe', 'ich'], exercise), true);
});

test('non-initial nouns still require correct capitalization', () => {
  const exercise = { answerOrder: ['Die', 'Familie', 'hat', 'eine', 'Wohnung'] };
  // "familie" lowercase in a non-initial slot must be rejected.
  assert.equal(checkReorderAnswer(['Die', 'familie', 'hat', 'eine', 'Wohnung'], exercise), false);
  assert.equal(checkReorderAnswer(['Die', 'Familie', 'hat', 'eine', 'Wohnung'], exercise), true);
});

test('wrong order is rejected', () => {
  const exercise = { answerOrder: ['Wir', 'kaufen', 'jeden', 'Tag', 'frisches', 'Brot'] };
  assert.equal(checkReorderAnswer(['Wir', 'Tag', 'kaufen', 'jeden', 'frisches', 'Brot'], exercise), false);
});

test('wrong length is rejected', () => {
  const exercise = { answerOrder: ['Die', 'Sonne', 'schien', 'hell'] };
  assert.equal(checkReorderAnswer(['Die', 'Sonne', 'schien'], exercise), false);
});

test('punctuation glued to a tile does not cause a mismatch', () => {
  const exercise = { answerOrder: ['Die', 'Sonne', 'schien', 'hell.'] };
  assert.equal(checkReorderAnswer(['Die', 'Sonne', 'schien', 'hell'], exercise), true);
  assert.equal(checkReorderAnswer(['Die,', 'Sonne', 'schien', 'hell.'], exercise), true);
});

test('supports multiple accepted alternate orders', () => {
  const exercise = {
    answerOrders: [
      ['Wir', 'kaufen', 'jeden', 'Tag', 'frisches', 'Brot'],
      ['Jeden', 'Tag', 'kaufen', 'wir', 'frisches', 'Brot'],
    ],
  };
  assert.equal(checkReorderAnswer(['Wir', 'kaufen', 'jeden', 'Tag', 'frisches', 'Brot'], exercise), true);
  assert.equal(checkReorderAnswer(['jeden', 'Tag', 'kaufen', 'wir', 'frisches', 'Brot'], exercise), true);
  assert.equal(checkReorderAnswer(['Tag', 'jeden', 'kaufen', 'wir', 'frisches', 'Brot'], exercise), false);
});

test('acceptedOrders prefers answerOrders over legacy answerOrder', () => {
  const exercise = { answerOrder: ['A', 'B'], answerOrders: [['C', 'D']] };
  assert.deepEqual(acceptedOrders(exercise), [['C', 'D']]);
});

test('acceptedOrders falls back to legacy answerOrder', () => {
  const exercise = { answerOrder: ['A', 'B'] };
  assert.deepEqual(acceptedOrders(exercise), [['A', 'B']]);
});

// --- Integration check: every authored reorder exercise must be solvable by
// rearranging its own scrambled `tokens` pool into each of its accepted orders. ---

function loadGrammarUnits() {
  const dir = join(__dirname, '..', '..', '..', 'content', 'grammar', 'units');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}

/** Rearrange `pool` tokens (case as authored) into the word sequence of `order`, matching case-insensitively. */
function rearrangePoolInto(pool, order) {
  const remaining = [...pool];
  return order.map((word) => {
    const idx = remaining.findIndex((t) => t.toLowerCase() === word.toLowerCase());
    if (idx === -1) throw new Error(`Token "${word}" not found in pool [${pool.join(', ')}]`);
    return remaining.splice(idx, 1)[0];
  });
}

test('every authored reorder exercise is solvable from its own token pool', () => {
  const units = loadGrammarUnits();
  let checked = 0;
  for (const unit of units) {
    for (const ex of unit.exercises) {
      if (ex.type !== 'reorder') continue;
      for (const order of acceptedOrders(ex)) {
        const submitted = rearrangePoolInto(ex.tokens, order);
        assert.equal(
          checkReorderAnswer(submitted, ex),
          true,
          `${unit.id}/${ex.id}: pool ${JSON.stringify(ex.tokens)} rearranged into ${JSON.stringify(order)} should be accepted`
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'expected at least one reorder exercise to be checked');
});
