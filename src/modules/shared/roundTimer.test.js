import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundTimer } from './roundTimer.js';

test('ticks every second and ends once at zero', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const ticks = [];
  let ended = 0;
  const timer = createRoundTimer({ seconds: 3, onTick: (s) => ticks.push(s), onEnd: () => ended++ });
  timer.start();
  t.mock.timers.tick(5000);
  assert.deepEqual(ticks, [2, 1, 0]);
  assert.equal(ended, 1);
  assert.equal(timer.remaining(), 0);
});

test('pause holds the time, resume continues', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const timer = createRoundTimer({ seconds: 10 });
  timer.start();
  t.mock.timers.tick(3000);
  timer.pause();
  t.mock.timers.tick(5000);
  assert.equal(timer.remaining(), 7);
  timer.resume();
  t.mock.timers.tick(2000);
  assert.equal(timer.remaining(), 5);
  timer.stop();
});

test('stop is idempotent and prevents any further tick or end', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let calls = 0;
  const timer = createRoundTimer({ seconds: 2, onTick: () => calls++, onEnd: () => calls++ });
  timer.start();
  timer.stop();
  timer.stop();
  t.mock.timers.tick(10000);
  timer.resume();
  t.mock.timers.tick(10000);
  assert.equal(calls, 0);
});
