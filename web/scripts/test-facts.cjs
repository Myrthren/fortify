const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const facts = load('lib/facts.ts');
// Copy out of the loader's VM realm so deepEqual compares plain arrays.
const unsupportedFigures = (...args) => [...facts.unsupportedFigures(...args)];

const offer = 'A done-for-you online booking page for small fitness studios, £250 one-off, live in 3 days';
const prospect = 'Harbourline Pilates, a fictional studio in Bristol with two locations';

test('flags invented percentages, multipliers and money seen in live drafts', () => {
  assert.deepEqual(unsupportedFigures('47 unread InMails, a 250% increase in lead flow', prospect, offer), ['250%']);
  assert.deepEqual(unsupportedFigures('Every empty slot costs $237', 'test topic'), ['$237']);
  assert.deepEqual(unsupportedFigures('Your competitors book 3× more classes', 'test topic'), ['3×']);
});

test('accepts figures the user supplied', () => {
  assert.deepEqual(unsupportedFigures('Flat £250, live in 3 days, no ongoing fees.', prospect, offer), []);
  assert.deepEqual(unsupportedFigures('A 15-minute call tomorrow?', prospect, offer), []);
  assert.deepEqual(unsupportedFigures('We cut churn by 20%', 'we cut churn by 20% last year'), []);
});
