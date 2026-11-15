// localDayKey / previousDayKey: local-time day keys with a 04:00 cutoff.
// All test dates are built with the local-time Date constructor, so results
// don't depend on the machine's timezone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { localDayKey, previousDayKey, DAY_START_HOUR } from './dayKey.js';

test('cutoff is 04:00', () => {
  assert.equal(DAY_START_HOUR, 4);
});

test('03:59 local counts as the previous day, 04:00 as the new day', () => {
  assert.equal(localDayKey(new Date(2026, 4, 12, 3, 59, 59, 999)), '2026-05-11');
  assert.equal(localDayKey(new Date(2026, 4, 12, 4, 0, 0, 0)), '2026-05-12');
  assert.equal(localDayKey(new Date(2026, 4, 12, 0, 0)), '2026-05-11');
  assert.equal(localDayKey(new Date(2026, 4, 12, 23, 59)), '2026-05-12');
});

test('early-morning cutoff rolls back across month and year boundaries', () => {
  assert.equal(localDayKey(new Date(2026, 2, 1, 2, 0)), '2026-02-28');
  assert.equal(localDayKey(new Date(2027, 0, 1, 1, 30)), '2026-12-31');
  assert.equal(localDayKey(new Date(2028, 2, 1, 3, 0)), '2028-02-29'); // leap year
});

test('"yesterday" across month and year boundaries', () => {
  assert.equal(previousDayKey('2026-03-01'), '2026-02-28');
  assert.equal(previousDayKey('2028-03-01'), '2028-02-29');
  assert.equal(previousDayKey('2026-05-01'), '2026-04-30');
  assert.equal(previousDayKey('2027-01-01'), '2026-12-31');
});

test('"yesterday" across both DST changes (EU and US 2026 transition dates)', () => {
  // EU: spring forward 2026-03-29, fall back 2026-10-25. US: 2026-03-08, 2026-11-01.
  assert.equal(previousDayKey('2026-03-30'), '2026-03-29');
  assert.equal(previousDayKey('2026-03-29'), '2026-03-28');
  assert.equal(previousDayKey('2026-10-26'), '2026-10-25');
  assert.equal(previousDayKey('2026-10-25'), '2026-10-24');
  assert.equal(previousDayKey('2026-03-09'), '2026-03-08');
  assert.equal(previousDayKey('2026-11-02'), '2026-11-01');
});

test('streak-style "today vs yesterday" holds on DST-change days in local time', () => {
  // The day after each transition, at 04:00 and at noon: yesterday must be exactly the transition day.
  for (const [y, m, d, expectedYesterday] of [
    [2026, 2, 30, '2026-03-29'],
    [2026, 9, 26, '2026-10-25'],
    [2026, 2, 9, '2026-03-08'],
    [2026, 10, 2, '2026-11-01'],
  ]) {
    for (const hour of [4, 12, 23]) {
      assert.equal(previousDayKey(localDayKey(new Date(y, m, d, hour))), expectedYesterday);
    }
  }
});

test('every hour across a DST-change day maps to a consistent day key', () => {
  for (const [y, m, d] of [
    [2026, 2, 29],
    [2026, 9, 25],
    [2026, 2, 8],
    [2026, 10, 1],
  ]) {
    const key = localDayKey(new Date(y, m, d, 12));
    for (let h = DAY_START_HOUR; h < 24; h++) assert.equal(localDayKey(new Date(y, m, d, h, 30)), key);
    assert.equal(localDayKey(new Date(y, m, d + 1, 2, 30)), key);
  }
});
