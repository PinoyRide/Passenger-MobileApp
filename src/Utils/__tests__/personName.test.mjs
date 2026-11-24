import test from 'node:test';
import assert from 'node:assert/strict';
import { fullNameOf, titleCase } from '../personName.js';

test('lowercase words get a capital', () => {
  assert.equal(titleCase('juan'), 'Juan');
  assert.equal(titleCase('maria clarissa josephine'), 'Maria Clarissa Josephine');
});

test('all-capital words become Capitalised', () => {
  assert.equal(titleCase('DELA CRUZ'), 'Dela Cruz');
  assert.equal(titleCase('JOHN roe'), 'John Roe');
  assert.equal(titleCase('A'), 'A');
});

test('capitals inside a word stay as typed', () => {
  assert.equal(titleCase('DeGuzman'), 'DeGuzman');
  assert.equal(titleCase('McArthur'), 'McArthur');
  assert.equal(titleCase('mcArthur'), 'McArthur');
});

test('every part after a hyphen gets a capital (ACC-19)', () => {
  assert.equal(titleCase('Dela Cruz-villanueva'), 'Dela Cruz-Villanueva');
  assert.equal(titleCase('dela cruz-villanueva'), 'Dela Cruz-Villanueva');
  assert.equal(titleCase('DELA CRUZ-VILLANUEVA'), 'Dela Cruz-Villanueva');
  assert.equal(titleCase('Dela Cruz-Villanueva'), 'Dela Cruz-Villanueva');
});

test('a letter and an apostrophe start: capital after it too', () => {
  assert.equal(titleCase("o'neil"), "O'Neil");
  assert.equal(titleCase("D'souza"), "D'Souza");
  assert.equal(titleCase("O'NEIL"), "O'Neil");
  assert.equal(titleCase('o’neil'), 'O’Neil');
  assert.equal(titleCase("mary's"), "Mary's");
});

test('trims and collapses spaces, empty stays empty', () => {
  assert.equal(titleCase('  juan   dela  cruz '), 'Juan Dela Cruz');
  assert.equal(titleCase(''), '');
  assert.equal(titleCase(null), '');
  assert.equal(titleCase(undefined), '');
});

test('fullNameOf shows the name as the Account page does', () => {
  assert.equal(
    fullNameOf({ fname: 'Maria Clarissa Josephine', lname: 'Dela Cruz-villanueva' }),
    'Maria Clarissa Josephine Dela Cruz-Villanueva',
  );
  assert.equal(fullNameOf({ first_name: 'JUAN', last_name: 'DeGuzman' }), 'Juan DeGuzman');
  assert.equal(fullNameOf({}), '');
});
