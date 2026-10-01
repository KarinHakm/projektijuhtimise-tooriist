import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMove, focusAfterMove, movedMessage, sizeCounts } from '../src/backlog/order.js';

// Backlog'i järjestamise loogika (L07) ilma brauseri, serveri ja AI-ta.
const stories = [{ id: 7, size: 'M' }, { id: 3, size: 'S' }, { id: 9, size: 'M' }, { id: 4, size: 'L' }];

test('sizeCounts loeb lood suuruse kaupa; tundmatut suurust ei loeta', () => {
  assert.deepEqual(sizeCounts(stories), { S: 1, M: 2, L: 1 });
  assert.deepEqual(sizeCounts([]), { S: 0, M: 0, L: 0 });
  assert.deepEqual(sizeCounts([{ size: 'XL' }]), { S: 0, M: 0, L: 0 });
});

test('canMove: esimest ei saa üles, viimast ei saa alla; ainukest ei saa kuhugi', () => {
  assert.equal(canMove(0, 4, 'up'), false);
  assert.equal(canMove(0, 4, 'down'), true);
  assert.equal(canMove(3, 4, 'up'), true);
  assert.equal(canMove(3, 4, 'down'), false);
  assert.equal(canMove(0, 1, 'up'), false);
  assert.equal(canMove(0, 1, 'down'), false);
});

test('focusAfterMove: fookus jääb sama suuna nupule, kui see on veel lubatud', () => {
  assert.equal(focusAfterMove(stories, 3, 'up'), 'up'); // teisel kohal
  assert.equal(focusAfterMove(stories, 9, 'down'), 'down'); // kolmandal kohal
});

test('focusAfterMove: äärde jõudes liigub fookus vastasnupule', () => {
  assert.equal(focusAfterMove(stories, 7, 'up'), 'down'); // nüüd esimene
  assert.equal(focusAfterMove(stories, 4, 'down'), 'up'); // nüüd viimane
});

test('focusAfterMove: puuduva või ainsa loo korral null', () => {
  assert.equal(focusAfterMove(stories, 999, 'up'), null);
  assert.equal(focusAfterMove([{ id: 1, size: 'S' }], 1, 'up'), null);
});

test('movedMessage nimetab loo uue koha loendis', () => {
  assert.equal(movedMessage(stories, 9), 'Lugu tõsteti kohale 3.');
  assert.equal(movedMessage(stories, 7), 'Lugu tõsteti kohale 1.');
});
