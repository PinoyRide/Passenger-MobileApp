import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The line of AlertBoxes (Utils/alertQueue.js): one at a time, in the order
// asked, except a priority box (a booking offer, about 20 s), which goes in
// front. The same file in both apps (sharedUi.test.mjs).

const require = createRequire(import.meta.url);
const { createAlertQueue } = require('../alertQueue.js');
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

let nextId = 0;
const box = (title, extra = {}) => {
  nextId += 1;
  return { id: nextId, title, ...extra };
};

const line = () => {
  const drawn = [];
  const queue = createAlertQueue(shown => drawn.push(shown?.title ?? null));
  const titles = () => [
    queue.current()?.title ?? null,
    ...queue.waiting().map(b => b.title),
  ];
  return { queue, drawn, titles };
};

test('boxes show one at a time, in the order asked', () => {
  const { queue, titles } = line();
  const first = box('first');
  queue.add(first);
  queue.add(box('second'));
  queue.add(box('third'));
  assert.deepEqual(titles(), ['first', 'second', 'third']);
  queue.close(first.id);
  assert.deepEqual(titles(), ['second', 'third']);
});

test('a priority box goes in front of the box shown, which shows again after it', () => {
  const { queue, titles, drawn } = line();
  const cancelled = box('Booking Cancelled');
  queue.add(cancelled);
  queue.add(box('later'));
  const offer = box('New booking', { priority: true, key: 'offer:9' });
  queue.add(offer);
  assert.deepEqual(titles(), ['New booking', 'Booking Cancelled', 'later']);
  assert.deepEqual(drawn, ['Booking Cancelled', 'New booking']);
  // the box put back in line is not closed by its old close
  queue.close(cancelled.id);
  assert.deepEqual(titles(), ['New booking', 'Booking Cancelled', 'later']);
  // the offer runs out (dismissAlert by its key): the cancelled box returns
  queue.dismiss('offer:9');
  assert.deepEqual(titles(), ['Booking Cancelled', 'later']);
});

test('nothing shown: a priority box simply shows', () => {
  const { queue, titles } = line();
  queue.add(box('New booking', { priority: true }));
  assert.deepEqual(titles(), ['New booking']);
});

test('behind a priority box shown, the next priority box is next in line, ahead of the others', () => {
  const { queue, titles } = line();
  const first = box('offer 1', { priority: true });
  queue.add(first);
  queue.add(box('notice'));
  queue.add(box('offer 2', { priority: true }));
  queue.add(box('offer 3', { priority: true }));
  assert.deepEqual(titles(), ['offer 1', 'offer 2', 'offer 3', 'notice']);
  queue.close(first.id);
  assert.deepEqual(titles(), ['offer 2', 'offer 3', 'notice']);
});

test('dismiss takes back the boxes with that key, shown or waiting', () => {
  const { queue, titles } = line();
  queue.add(box('a', { key: 'k' }));
  queue.add(box('b'));
  queue.add(box('c', { key: 'k' }));
  queue.dismiss('k');
  assert.deepEqual(titles(), ['b']);
  queue.dismiss(undefined);
  assert.deepEqual(titles(), ['b']);
});

test('the last box closed leaves nothing shown', () => {
  const { queue, drawn } = line();
  const only = box('only');
  queue.add(only);
  queue.close(only.id);
  assert.equal(queue.current(), null);
  assert.deepEqual(drawn, ['only', null]);
});

test('appAlert keeps its line in alertQueue and takes options.priority', () => {
  const src = readFileSync(resolve(app, 'src/Utils/appAlert.js'), 'utf8');
  assert.match(src, /createAlertQueue/);
  assert.match(src, /options\?\.priority === true/);
  assert.doesNotMatch(src, /waiting\.push/);
});
