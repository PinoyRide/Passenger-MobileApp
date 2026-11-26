import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../accountDeletion.js';
const { canDelete, stage } = mod;

test('deleting needs the whole code and DELETE typed out exactly', () => {
  assert.equal(canDelete({ code: '123456', confirm: 'DELETE' }), true);
  assert.equal(canDelete({ code: ' 123456 ', confirm: ' DELETE ' }), true);
  assert.equal(canDelete({ code: '12345', confirm: 'DELETE' }), false);
  assert.equal(canDelete({ code: '123456', confirm: 'delete' }), false);
  assert.equal(canDelete({ code: '123456', confirm: '' }), false);
  assert.equal(canDelete({}), false);
});

test('what stands in the way is shown before any code is sent', () => {
  assert.equal(stage({ blockers: ['You have a booking that is not finished (BK-1).'] }), 'blocked');
  assert.equal(stage({ blockers: [], channels: ['sms'] }), 'choose');
  assert.equal(stage(null), 'choose');
});
