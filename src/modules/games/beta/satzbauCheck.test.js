import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAnswer, matchedOrder } from './satzbauCheck.js';

const sentence = {
  tokens: ['wir', 'fahren', 'nach Berlin', 'am Wochenende'],
  answerOrders: [
    ['Am Wochenende', 'fahren', 'wir', 'nach Berlin.'],
    ['Wir', 'fahren', 'am Wochenende', 'nach Berlin.'],
  ],
  alsoAccepted: [['Wir', 'fahren', 'nach Berlin', 'am Wochenende.']],
};

test('a neutral order is usual', () => {
  assert.equal(classifyAnswer(['Wir', 'fahren', 'am Wochenende', 'nach Berlin'], sentence), 'usual');
  assert.equal(classifyAnswer(['am Wochenende', 'fahren', 'wir', 'nach Berlin'], sentence), 'usual'); // first word's capital is ignored
});

test('an alsoAccepted order is "also"', () => {
  assert.equal(classifyAnswer(['wir', 'fahren', 'nach Berlin', 'am Wochenende'], sentence), 'also');
});

test('anything else is wrong', () => {
  assert.equal(classifyAnswer(['fahren', 'wir', 'nach Berlin', 'am Wochenende'], sentence), 'wrong');
});

test('a sentence without alsoAccepted still classifies', () => {
  const plain = { answerOrders: sentence.answerOrders };
  assert.equal(classifyAnswer(['wir', 'fahren', 'nach Berlin', 'am Wochenende'], plain), 'wrong');
  assert.equal(classifyAnswer(['wir', 'fahren', 'am Wochenende', 'nach Berlin'], plain), 'usual');
});

test('matchedOrder returns the order with its punctuation, from either list', () => {
  assert.deepEqual(matchedOrder(['wir', 'fahren', 'nach Berlin', 'am Wochenende'], sentence), ['Wir', 'fahren', 'nach Berlin', 'am Wochenende.']);
  assert.deepEqual(matchedOrder(['Wir', 'fahren', 'am Wochenende', 'nach Berlin'], sentence), sentence.answerOrders[1]);
  assert.equal(matchedOrder(['fahren', 'wir', 'nach Berlin', 'am Wochenende'], sentence), null);
});
