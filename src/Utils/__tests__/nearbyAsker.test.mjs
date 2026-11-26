import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../nearbyAsker.js';
const { makeNearbyAsker } = mod;

// a backend that counts its calls and answers when told to
const backend = () => {
  const calls = [];
  const pending = [];
  return {
    calls,
    fetchSpot: spot =>
      new Promise(resolve => {
        calls.push(spot);
        pending.push(() => resolve({ count: 1, riders: [], spot }));
      }),
    answerAll: () => pending.splice(0).forEach(answer => answer()),
  };
};

test('one call per press', async () => {
  const api = backend();
  let clock = 0;
  const asker = makeNearbyAsker({ ...api, reuseMs: 15000, now: () => clock });
  const first = asker.ask('a');
  api.answerAll();
  assert.equal((await first).spot, 'a');
  assert.deepEqual(api.calls, ['a']);
  // a press half a minute later asks again, once
  clock = 30000;
  const second = asker.ask('a');
  api.answerAll();
  await second;
  assert.deepEqual(api.calls, ['a', 'a']);
});

test('presses while the call is out wait for it: still one call', async () => {
  const api = backend();
  const asker = makeNearbyAsker({ ...api, reuseMs: 15000, now: () => 0 });
  const presses = [asker.ask('a'), asker.ask('a'), asker.ask('a')];
  api.answerAll();
  const answers = await Promise.all(presses);
  assert.equal(api.calls.length, 1);
  assert.ok(answers.every(answer => answer === answers[0]));
});

test('a press soon after an answer takes it, with no call', async () => {
  const api = backend();
  let clock = 0;
  const asker = makeNearbyAsker({ ...api, reuseMs: 15000, now: () => clock });
  const first = asker.ask('a');
  api.answerAll();
  await first;
  clock = 14000;
  assert.ok(asker.fresh('a'));
  await asker.ask('a');
  assert.equal(api.calls.length, 1);
  // another spot is asked for itself
  const elsewhere = asker.ask('b');
  api.answerAll();
  await elsewhere;
  assert.deepEqual(api.calls, ['a', 'b']);
});

test('no answer is kept, so the next press asks again', async () => {
  let calls = 0;
  const asker = makeNearbyAsker({
    fetchSpot: async () => {
      calls += 1;
      return null;
    },
    reuseMs: 15000,
    now: () => 0,
  });
  assert.equal(await asker.ask('a'), null);
  assert.equal(await asker.ask('a'), null);
  assert.equal(calls, 2);
});
