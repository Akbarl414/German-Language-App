// Tests for englishPrompt(): prompt_en when present, meaning_en otherwise.

import test from 'node:test';
import assert from 'node:assert/strict';
import { englishPrompt } from './englishPrompt.js';

const der = { id: 'der', lemma: 'der', meaning_en: 'the (definite article: der/die/das); also: that one, who, which' };

test('uses prompt_en when present', () => {
  const w = { ...der, prompt_en: 'the (masculine); that one, who, which' };
  assert.equal(englishPrompt(w), 'the (masculine); that one, who, which');
  assert.equal(w.meaning_en, der.meaning_en); // meaning_en untouched
});

test('falls back to meaning_en when prompt_en is absent, empty or blank', () => {
  assert.equal(englishPrompt(der), der.meaning_en);
  assert.equal(englishPrompt({ ...der, prompt_en: '' }), der.meaning_en);
  assert.equal(englishPrompt({ ...der, prompt_en: '   ' }), der.meaning_en);
  assert.equal(englishPrompt({ ...der, prompt_en: null }), der.meaning_en);
});

test('trims prompt_en and copes with a missing word', () => {
  assert.equal(englishPrompt({ meaning_en: 'x', prompt_en: '  house ' }), 'house');
  assert.equal(englishPrompt(undefined), '');
});
