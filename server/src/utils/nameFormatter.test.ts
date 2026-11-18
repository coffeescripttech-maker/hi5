import test from 'node:test';
import assert from 'node:assert/strict';
import { parseName, formatName, namesMatch } from './nameFormatter';

test('parseName: comma form keeps the last name intact', () => {
  assert.deepEqual(parseName('Villaruel, Arlan Bert Jr.'), {
    last: 'Villaruel',
    first: 'Arlan',
    middle: 'Bert',
    ext: 'Jr.'
  });
});

test('parseName: comma form without suffix', () => {
  assert.deepEqual(parseName('Dela Cruz, Juan Pedro'), {
    last: 'Dela Cruz',
    first: 'Juan',
    middle: 'Pedro',
    ext: ''
  });
});

test('parseName: natural form moves the last word to last', () => {
  assert.deepEqual(parseName('Juan Dela Cruz'), {
    last: 'Cruz',
    first: 'Juan',
    middle: 'Dela',
    ext: ''
  });
});

test('parseName: natural form with a suffix', () => {
  assert.deepEqual(parseName('Juan Dela Cruz Jr.'), {
    last: 'Cruz',
    first: 'Juan',
    middle: 'Dela',
    ext: 'Jr.'
  });
});

test('parseName: single word', () => {
  assert.deepEqual(parseName('Cher'), {
    last: 'Cher',
    first: '',
    middle: '',
    ext: ''
  });
});

test('parseName: empty-ish input', () => {
  assert.deepEqual(parseName('   '), { last: '', first: '', middle: '', ext: '' });
});

test('formatName: prints Last, First Middle Ext', () => {
  assert.equal(
    formatName({ last: 'Dela Cruz', first: 'Juan', middle: 'Pedro', ext: 'Jr.' }),
    'Dela Cruz, Juan Pedro Jr.'
  );
  assert.equal(formatName({ last: 'Cruz', first: 'Juan' }), 'Cruz, Juan');
  assert.equal(formatName({ first: 'Only' }), 'Only');
});

test('namesMatch: case and suffix insensitive', () => {
  assert.equal(namesMatch('Dela Cruz, Juan Jr.', 'DELA CRUZ, JUAN JR.'), true);
  assert.equal(namesMatch('Cruz, Juan', 'Cruz, Juan P.'), false);
});

test('namesMatch: natural form matches itself across case', () => {
  // A bare natural name ("Juan Dela Cruz Jr.") cannot be reliably matched
  // against the comma form when the surname is multi-word — that is exactly
  // what the LIS mismatch flow is for. Like-case and case-only differences
  // must match.
  assert.equal(namesMatch('JUAN DELA CRUZ JR.', 'Juan Dela Cruz Jr.'), true);
});

test('namesMatch: different birth-order names do not match', () => {
  assert.equal(namesMatch('Cruz, Juan Pedro', 'Pedro, Juan Cruz'), false);
});
