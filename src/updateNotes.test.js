import test from 'node:test';
import assert from 'node:assert/strict';
import { UPDATE_NOTES, newestUpdateId, shouldShowUpdateAlert } from './updateNotes.js';

test('shouldShowUpdateAlert: shown only when a newest id exists and differs', () => {
  assert.equal(shouldShowUpdateAlert(null, 'a'), true);
  assert.equal(shouldShowUpdateAlert(undefined, 'a'), true);
  assert.equal(shouldShowUpdateAlert('old', 'a'), true);
  assert.equal(shouldShowUpdateAlert('a', 'a'), false);
  assert.equal(shouldShowUpdateAlert(null, null), false);
});

test('update notes have unique ids and non-empty lines; newest id is the first', () => {
  const ids = UPDATE_NOTES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(newestUpdateId(), ids[0]);
  for (const n of UPDATE_NOTES) assert.ok(n.date && n.lines.length > 0);
});
