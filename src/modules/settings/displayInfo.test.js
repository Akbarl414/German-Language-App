import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIosVersion } from './displayInfo.js';

test('parseIosVersion reads iPhone user agents', () => {
  assert.equal(parseIosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X)'), '18.3.1');
  assert.equal(parseIosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), '17.5');
});

test('parseIosVersion is null off iOS', () => {
  assert.equal(parseIosVersion('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), null);
  assert.equal(parseIosVersion(''), null);
});
