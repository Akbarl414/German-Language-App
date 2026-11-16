import test from 'node:test';
import assert from 'node:assert/strict';
import { pickWrongOptions } from './wrongOptions.js';

const pool = [
  { lemma: 'Haus', pos: 'noun' },
  { lemma: 'Baum', pos: 'noun' },
  { lemma: 'Tisch', pos: 'noun' },
  { lemma: 'gehen', pos: 'verb' },
  { lemma: 'laufen', pos: 'verb' },
  { lemma: 'schön', pos: 'adj' },
];

test('prefers the same part of speech', () => {
  for (let i = 0; i < 20; i++) {
    const out = pickWrongOptions(pool[0], pool, 2);
    assert.equal(out.length, 2);
    assert.ok(out.every((w) => w.pos === 'noun' && w.lemma !== 'Haus'));
  }
});

test('tops up from other parts of speech when too few match', () => {
  const out = pickWrongOptions(pool[5], pool, 2); // the only adjective
  assert.equal(out.length, 2);
  assert.ok(out.every((w) => w.lemma !== 'schön'));
});

test('never repeats a label, or the target label', () => {
  const dup = [...pool, { lemma: 'Haus', pos: 'noun' }, { lemma: 'Baum', pos: 'noun' }];
  for (let i = 0; i < 20; i++) {
    const labels = pickWrongOptions(pool[0], dup, 5).map((w) => w.lemma);
    assert.equal(new Set(labels).size, labels.length);
    assert.ok(!labels.includes('Haus'));
  }
});

test('custom same-field and label', () => {
  const items = [
    { en: 'a', kind: 1 },
    { en: 'b', kind: 1 },
    { en: 'c', kind: 2 },
  ];
  const out = pickWrongOptions(items[0], items, 1, { same: 'kind', label: (x) => x.en });
  assert.equal(out[0].en, 'b');
});
